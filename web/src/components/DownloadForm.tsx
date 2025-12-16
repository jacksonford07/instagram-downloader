'use client';

import { useState, useEffect } from 'react';
import { Download, Loader2, AlertCircle, Key, Link, Settings, X } from 'lucide-react';

interface DownloadState {
  loading: boolean;
  error: string | null;
  success: string | null;
  downloading: boolean;
}

export function DownloadForm() {
  const [url, setUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [state, setState] = useState<DownloadState>({
    loading: false,
    error: null,
    success: null,
    downloading: false,
  });

  // Load session ID from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('instagram_session_id');
    if (saved) {
      setSessionId(saved);
    }
  }, []);

  // Save session ID to localStorage
  const saveSessionId = () => {
    if (sessionId.trim()) {
      localStorage.setItem('instagram_session_id', sessionId.trim());
      setState((s) => ({ ...s, success: 'Session ID saved!', error: null }));
      setTimeout(() => setState((s) => ({ ...s, success: null })), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setState((s) => ({ ...s, error: 'Please enter an Instagram URL' }));
      return;
    }

    setState({ loading: true, error: null, success: null, downloading: false });

    try {
      // Pass session ID to API
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          sessionId: sessionId.trim() || undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to fetch media');
      }

      if (!data.media || data.media.length === 0) {
        throw new Error('No media found');
      }

      // Auto-download the first media item
      setState((s) => ({ ...s, downloading: true, success: 'Found media! Starting download...' }));

      const media = data.media[0];
      await downloadFile(media.url, media.id, media.type);

      setState({
        loading: false,
        error: null,
        success: 'Download complete!',
        downloading: false
      });

      // Clear success message after 3 seconds
      setTimeout(() => setState((s) => ({ ...s, success: null })), 3000);

    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Something went wrong',
        success: null,
        downloading: false,
      });
    }
  };

  const downloadFile = async (mediaUrl: string, id: string, type: string) => {
    try {
      const proxyUrl = `/api/download/proxy?url=${encodeURIComponent(mediaUrl)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `instagram_${id}.${type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      throw new Error('Failed to download file');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Settings Panel */}
      <div className="card mb-6">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-primary transition-colors w-full"
        >
          <Settings className="w-4 h-4" />
          <span>{showSettings ? 'Hide' : 'Show'} Authentication Settings</span>
          {sessionId && !showSettings && (
            <span className="ml-auto text-xs text-success">Session ID configured</span>
          )}
        </button>

        {showSettings && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium mb-2">
              Instagram Session ID
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="password"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Paste your session ID here..."
                  className="input-field pl-10 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={saveSessionId}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Save
              </button>
            </div>
            <div className="mt-3 text-xs text-gray-500 space-y-1">
              <p><strong>How to get your Session ID:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Log into Instagram in Chrome</li>
                <li>Press F12 to open DevTools</li>
                <li>Go to Application → Cookies → instagram.com</li>
                <li>Find &quot;sessionid&quot; and copy its value</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Download Form */}
      <form onSubmit={handleSubmit} className="card mb-6">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Link className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste Instagram URL here..."
              className="input-field pl-12"
              disabled={state.loading || state.downloading}
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={state.loading || state.downloading || !url.trim()}
            className="btn-primary flex items-center justify-center gap-2"
          >
            {state.loading || state.downloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {state.downloading ? 'Downloading...' : 'Fetching...'}
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download
              </>
            )}
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-3 text-center">
          Paste a link and click Download - file saves directly to your device
        </p>
      </form>

      {/* Error Message */}
      {state.error && (
        <div className="card mb-6 border-l-4 border-error bg-red-50 dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-error">Error</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{state.error}</p>
              {state.error.includes('authentication') && !sessionId && (
                <p className="text-sm text-gray-500 mt-2">
                  Try adding your Instagram Session ID above to access this content.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {state.success && (
        <div className="card mb-6 border-l-4 border-success bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-success" />
            <p className="text-success font-medium">{state.success}</p>
          </div>
        </div>
      )}
    </div>
  );
}
