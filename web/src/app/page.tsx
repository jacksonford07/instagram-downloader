import { DownloadForm } from '@/components/DownloadForm';
import { Instagram, Shield, Zap, Download } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent mb-6">
            <Instagram className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Instagram Downloader
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl mx-auto">
            Download videos and images from Instagram posts, reels, and stories. Fast, free, and
            no watermarks.
          </p>
        </div>

        {/* Download Form */}
        <DownloadForm />

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <div className="card text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Fast Downloads</h3>
            <p className="text-sm text-gray-500">
              Get your media in seconds with our optimized servers
            </p>
          </div>

          <div className="card text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-success/10 mb-4">
              <Shield className="w-6 h-6 text-success" />
            </div>
            <h3 className="font-semibold mb-2">Private & Secure</h3>
            <p className="text-sm text-gray-500">
              We don&apos;t store your data or downloaded content
            </p>
          </div>

          <div className="card text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-secondary/10 mb-4">
              <Download className="w-6 h-6 text-secondary" />
            </div>
            <h3 className="font-semibold mb-2">HD Quality</h3>
            <p className="text-sm text-gray-500">
              Download in original quality without compression
            </p>
          </div>
        </div>

        {/* How to use */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-center mb-8">How to Use</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary text-white font-bold flex items-center justify-center mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Copy the URL</h3>
              <p className="text-sm text-gray-500">
                Open Instagram and copy the link to the post, reel, or story
              </p>
            </div>

            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-secondary text-white font-bold flex items-center justify-center mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">Paste & Fetch</h3>
              <p className="text-sm text-gray-500">
                Paste the URL above and click the download button
              </p>
            </div>

            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-accent text-white font-bold flex items-center justify-center mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">Download</h3>
              <p className="text-sm text-gray-500">
                Click download to save the media to your device
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500">
          <p>
            This tool is for personal use only. Please respect copyright and Instagram&apos;s
            terms of service.
          </p>
        </footer>
      </div>
    </main>
  );
}
