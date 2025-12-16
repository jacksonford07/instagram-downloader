'use client';

import { useState } from 'react';
import { Download, Loader2, AlertCircle, CheckCircle, Link, Copy, X } from 'lucide-react';

interface MediaItem {
  id: string;
  type: 'video' | 'image' | 'carousel';
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  username?: string;
}

interface DownloadState {
  loading: boolean;
  error: string | null;
  media: MediaItem[] | null;
  copied: boolean;
}

export function DownloadForm() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<DownloadState>({
    loading: false,
    error: null,
    media: null,
    copied: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setState((s) => ({ ...s, error: 'Please enter an Instagram URL' }));
      return;
    }

    setState({ loading: true, error: null, media: null, copied: false });

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to fetch media');
      }

      setState({ loading: false, error: null, media: data.media, copied: false });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Something went wrong',
        media: null,
        copied: false,
      });
    }
  };

  const handleDownload = async (media: MediaItem) => {
    try {
      const proxyUrl = `/api/download/proxy?url=${encodeURIComponent(media.url)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `instagram_${media.id}.${media.type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setState((s) => ({
        ...s,
        error: error instanceof Error ? error.message : 'Download failed',
      }));
    }
  };

  const copyUrl = async (mediaUrl: string) => {
    await navigator.clipboard.writeText(mediaUrl);
    setState((s) => ({ ...s, copied: true }));
    setTimeout(() => setState((s) => ({ ...s, copied: false })), 2000);
  };

  const clearResults = () => {
    setState({ loading: false, error: null, media: null, copied: false });
    setUrl('');
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
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
              disabled={state.loading}
            />
          </div>

          <button
            type="submit"
            disabled={state.loading || !url.trim()}
            className="btn-primary flex items-center justify-center gap-2"
          >
            {state.loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Get Download Link
              </>
            )}
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-3 text-center">
          Supports posts, reels, and stories
        </p>
      </form>

      {state.error && (
        <div className="card mb-6 border-l-4 border-error bg-red-50 dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-error">Error</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{state.error}</p>
            </div>
          </div>
        </div>
      )}

      {state.media && state.media.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              <h3 className="font-semibold">
                Found {state.media.length} {state.media.length === 1 ? 'item' : 'items'}
              </h3>
            </div>
            <button
              onClick={clearResults}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Clear results"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {state.media.map((media, index) => (
              <div
                key={media.id ?? index}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex-shrink-0">
                  {media.thumbnailUrl ?? media.url ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-600">
                      {media.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-secondary">
                          <span className="text-white text-xs font-bold">VIDEO</span>
                        </div>
                      ) : (
                        <img
                          src={media.thumbnailUrl ?? media.url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium capitalize">{media.type}</p>
                  {media.username && (
                    <p className="text-sm text-gray-500">@{media.username}</p>
                  )}
                  {media.caption && (
                    <p className="text-sm text-gray-500 truncate">{media.caption}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => copyUrl(media.url)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    title="Copy URL"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDownload(media)}
                    className="btn-primary py-2 px-4 text-sm"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          {state.copied && (
            <div className="mt-4 p-3 bg-success/10 text-success rounded-lg text-sm text-center">
              URL copied to clipboard!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
