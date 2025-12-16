'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Download,
  Loader2,
  AlertCircle,
  Key,
  Link,
  Settings,
  X,
  FolderDown,
  FileText,
  CheckCircle,
  XCircle,
  Hash,
} from 'lucide-react';
import JSZip from 'jszip';

interface DownloadState {
  loading: boolean;
  error: string | null;
  success: string | null;
  downloading: boolean;
}

interface BulkDownloadItem {
  url: string;
  status: 'pending' | 'downloading' | 'success' | 'error' | 'skipped';
  error?: string;
  filename?: string;
  fileNumber?: number;
}

type DownloadMode = 'single' | 'bulk';

export function DownloadForm() {
  const [mode, setMode] = useState<DownloadMode>('single');
  const [url, setUrl] = useState('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [folderName, setFolderName] = useState('instagram_downloads');
  const [startNumber, setStartNumber] = useState(1);
  const [sessionId, setSessionId] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [state, setState] = useState<DownloadState>({
    loading: false,
    error: null,
    success: null,
    downloading: false,
  });
  const [bulkItems, setBulkItems] = useState<BulkDownloadItem[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const abortRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('instagram_session_id');
    if (saved) {
      setSessionId(saved);
    }
  }, []);

  const saveSessionId = () => {
    if (sessionId.trim()) {
      localStorage.setItem('instagram_session_id', sessionId.trim());
      setState((s) => ({ ...s, success: 'Session ID saved!', error: null }));
      setTimeout(() => setState((s) => ({ ...s, success: null })), 2000);
    }
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setState((s) => ({ ...s, error: 'Please enter an Instagram URL' }));
      return;
    }

    setState({ loading: true, error: null, success: null, downloading: false });

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          sessionId: sessionId.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to fetch media');
      if (!data.media || data.media.length === 0) throw new Error('No media found');

      setState((s) => ({ ...s, downloading: true, success: 'Found media! Starting download...' }));

      const media = data.media[0];
      await downloadFile(media.url, media.id, media.type);

      setState({ loading: false, error: null, success: 'Download complete!', downloading: false });
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
  };

  const parseUrls = (text: string): string[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && line.includes('instagram.com'));
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = parseUrls(bulkUrls);

    if (urls.length === 0) {
      setState((s) => ({ ...s, error: 'Please enter at least one valid Instagram URL' }));
      return;
    }

    if (urls.length > 50) {
      setState((s) => ({ ...s, error: 'Maximum 50 URLs per batch' }));
      return;
    }

    abortRef.current = false;
    const items: BulkDownloadItem[] = urls.map((u) => ({ url: u, status: 'pending' }));
    setBulkItems(items);
    setBulkProgress({ current: 0, total: urls.length });
    setState({ loading: true, error: null, success: null, downloading: true });

    const zip = new JSZip();
    const folder = zip.folder(folderName.trim() || 'instagram_downloads');
    let successCount = 0;
    let errorCount = 0;
    let currentFileNumber = startNumber;

    for (let i = 0; i < items.length; i++) {
      if (abortRef.current) break;

      const item = items[i];
      if (!item) continue;

      setBulkItems((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, status: 'downloading' } : p))
      );
      setBulkProgress({ current: i + 1, total: urls.length });

      try {
        const response = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: item.url,
            sessionId: sessionId.trim() || undefined,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Failed');
        if (!data.media || data.media.length === 0) throw new Error('No media');

        const media = data.media[0];
        const proxyUrl = `/api/download/proxy?url=${encodeURIComponent(media.url)}`;
        const mediaResponse = await fetch(proxyUrl);
        if (!mediaResponse.ok) throw new Error('Download failed');

        const blob = await mediaResponse.blob();
        const ext = media.type === 'video' ? 'mp4' : 'jpg';
        const filename = `${currentFileNumber}.${ext}`;

        folder?.file(filename, blob);
        successCount++;

        setBulkItems((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: 'success', filename, fileNumber: currentFileNumber } : p
          )
        );

        // Only increment file number on success
        currentFileNumber++;
      } catch (error) {
        errorCount++;
        setBulkItems((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? { ...p, status: 'skipped', error: error instanceof Error ? error.message : 'Failed' }
              : p
          )
        );
        // Don't increment file number on error - skip this number
      }

      // Small delay to avoid rate limiting
      if (i < items.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (successCount > 0 && !abortRef.current) {
      try {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const downloadUrl = window.URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${folderName.trim() || 'instagram_downloads'}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
      } catch {
        setState((s) => ({ ...s, error: 'Failed to create ZIP file' }));
      }
    }

    setState({
      loading: false,
      error: errorCount > 0 ? `${errorCount} download(s) skipped` : null,
      success: successCount > 0 ? `Downloaded ${successCount} file(s)! (${startNumber}-${currentFileNumber - 1})` : null,
      downloading: false,
    });
  };

  const cancelBulkDownload = () => {
    abortRef.current = true;
  };

  const urlCount = parseUrls(bulkUrls).length;

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
            <label className="block text-sm font-medium mb-2">Instagram Session ID</label>
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
              <p>
                <strong>How to get your Session ID:</strong>
              </p>
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

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            mode === 'single'
              ? 'bg-gradient-to-r from-primary via-secondary to-accent text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Link className="w-4 h-4" />
          Single Link
        </button>
        <button
          type="button"
          onClick={() => setMode('bulk')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            mode === 'bulk'
              ? 'bg-gradient-to-r from-primary via-secondary to-accent text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Bulk Download
        </button>
      </div>

      {/* Single Download Form */}
      {mode === 'single' && (
        <form onSubmit={handleSingleSubmit} className="card mb-6">
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
        </form>
      )}

      {/* Bulk Download Form */}
      {mode === 'bulk' && (
        <form onSubmit={handleBulkSubmit} className="card mb-6">
          <div className="flex flex-col gap-4">
            {/* Folder Name and Start Number */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <FolderDown className="w-4 h-4 inline mr-2" />
                  Folder/ZIP Name
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="instagram_downloads"
                  className="input-field"
                  disabled={state.loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Hash className="w-4 h-4 inline mr-2" />
                  Start Numbering At
                </label>
                <input
                  type="number"
                  min="1"
                  value={startNumber}
                  onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="1"
                  className="input-field"
                  disabled={state.loading}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 -mt-2">
              Files will be named: {startNumber}.mp4, {startNumber + 1}.mp4, {startNumber + 2}.mp4...
            </p>

            {/* URLs Textarea */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Instagram URLs (one per line)
              </label>
              <textarea
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
                placeholder={`https://www.instagram.com/reel/ABC123/\nhttps://www.instagram.com/p/XYZ789/\nhttps://www.instagram.com/reel/DEF456/`}
                className="input-field min-h-[150px] font-mono text-sm"
                disabled={state.loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                {urlCount} valid URL{urlCount !== 1 ? 's' : ''} detected (max 50)
              </p>
            </div>

            {/* Progress */}
            {state.loading && bulkProgress.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    Downloading {bulkProgress.current} of {bulkProgress.total}
                  </span>
                  <span>{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit/Cancel Buttons */}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={state.loading || urlCount === 0}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {state.loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Download All ({urlCount})
                  </>
                )}
              </button>
              {state.loading && (
                <button
                  type="button"
                  onClick={cancelBulkDownload}
                  className="px-4 py-2 bg-error text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Bulk Download Results */}
      {mode === 'bulk' && bulkItems.length > 0 && (
        <div className="card mb-6 max-h-[300px] overflow-y-auto">
          <h3 className="font-medium mb-3">Download Progress</h3>
          <div className="space-y-2">
            {bulkItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-sm p-2 bg-gray-50 dark:bg-gray-700/50 rounded"
              >
                {item.status === 'pending' && (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                {item.status === 'downloading' && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                )}
                {item.status === 'success' && <CheckCircle className="w-4 h-4 text-success" />}
                {(item.status === 'error' || item.status === 'skipped') && (
                  <XCircle className="w-4 h-4 text-warning" />
                )}
                <span className="flex-1 truncate font-mono text-xs">{item.url}</span>
                {item.status === 'success' && item.filename && (
                  <span className="text-xs text-success font-medium">{item.filename}</span>
                )}
                {(item.status === 'error' || item.status === 'skipped') && item.error && (
                  <span className="text-xs text-warning">Skipped: {item.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
