import { z } from 'zod';

const INSTAGRAM_API_URL = 'https://i.instagram.com/api/v1';

export const InstagramUrlSchema = z.string().refine(
  (url) => {
    const patterns = [
      /instagram\.com\/(p|reel|reels)\/[\w-]+/,
      /instagram\.com\/stories\/[\w.]+\/\d+/,
    ];
    return patterns.some((pattern) => pattern.test(url));
  },
  { message: 'Invalid Instagram URL' }
);

export interface MediaInfo {
  id: string;
  type: 'video' | 'image' | 'carousel';
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  caption?: string;
  username?: string;
  displayUrl?: string;
}

export interface DownloadResult {
  success: boolean;
  media?: MediaInfo[];
  error?: string;
}

export function extractMediaId(url: string): string | null {
  const patterns = [
    /\/(p|reel|reels)\/([A-Za-z0-9_-]+)/,
    /\/stories\/[\w.]+\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[2] ?? match[1] ?? null;
    }
  }
  return null;
}

export function extractMediaType(url: string): 'post' | 'reel' | 'story' | null {
  if (url.includes('/reel/') || url.includes('/reels/')) return 'reel';
  if (url.includes('/p/')) return 'post';
  if (url.includes('/stories/')) return 'story';
  return null;
}

function buildHeaders(sessionId?: string): HeadersInit {
  const headers: HeadersInit = {
    'User-Agent':
      'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100)',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'X-IG-Capabilities': '3brTvw==',
    'X-IG-Connection-Type': 'WIFI',
  };

  if (sessionId) {
    headers['Cookie'] = `sessionid=${sessionId}`;
  }

  return headers;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      if (response.status === 429) {
        const waitTime = Math.pow(2, i) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw lastError ?? new Error('Failed after retries');
}

export async function getMediaInfo(
  url: string,
  sessionId?: string
): Promise<DownloadResult> {
  try {
    const mediaId = extractMediaId(url);
    if (!mediaId) {
      return { success: false, error: 'Could not extract media ID from URL' };
    }

    const mediaType = extractMediaType(url);

    // Try the embed endpoint first (no auth required for public posts)
    const embedResult = await tryEmbedEndpoint(url);
    if (embedResult.success) {
      return embedResult;
    }

    // Fall back to API with session
    if (sessionId) {
      return await tryApiEndpoint(mediaId, mediaType, sessionId);
    }

    return { success: false, error: 'Could not fetch media. Try with authentication.' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

async function tryEmbedEndpoint(url: string): Promise<DownloadResult> {
  try {
    // Use oembed endpoint
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      },
    });

    if (!response.ok) {
      return { success: false, error: 'Embed endpoint failed' };
    }

    // The oembed doesn't give us direct video URLs, so we need to scrape
    return await scrapeMediaPage(url);
  } catch {
    return { success: false, error: 'Embed endpoint failed' };
  }
}

async function scrapeMediaPage(url: string): Promise<DownloadResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return { success: false, error: 'Could not fetch page' };
    }

    const html = await response.text();

    // Look for video URL in the page
    const videoMatch = html.match(/"video_url":"([^"]+)"/);
    const imageMatch = html.match(/"display_url":"([^"]+)"/);

    const media: MediaInfo[] = [];

    if (videoMatch?.[1]) {
      const videoUrl = videoMatch[1].replace(/\\u0026/g, '&');
      media.push({
        id: extractMediaId(url) ?? 'unknown',
        type: 'video',
        url: videoUrl,
        displayUrl: imageMatch?.[1]?.replace(/\\u0026/g, '&'),
      });
    } else if (imageMatch?.[1]) {
      media.push({
        id: extractMediaId(url) ?? 'unknown',
        type: 'image',
        url: imageMatch[1].replace(/\\u0026/g, '&'),
      });
    }

    if (media.length > 0) {
      return { success: true, media };
    }

    return { success: false, error: 'No media found in page' };
  } catch {
    return { success: false, error: 'Failed to scrape page' };
  }
}

async function tryApiEndpoint(
  mediaId: string,
  _mediaType: 'post' | 'reel' | 'story' | null,
  sessionId: string
): Promise<DownloadResult> {
  try {
    const headers = buildHeaders(sessionId);

    // Try media info endpoint
    const apiUrl = `${INSTAGRAM_API_URL}/media/${mediaId}/info/`;
    const response = await fetchWithRetry(apiUrl, { headers });

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'No media items found' };
    }

    const media: MediaInfo[] = [];
    const item = data.items[0];

    if (item.video_versions) {
      // Video content
      const bestVideo = item.video_versions[0];
      media.push({
        id: item.pk,
        type: 'video',
        url: bestVideo.url,
        thumbnailUrl: item.image_versions2?.candidates?.[0]?.url,
        width: bestVideo.width,
        height: bestVideo.height,
        caption: item.caption?.text,
        username: item.user?.username,
      });
    } else if (item.carousel_media) {
      // Carousel
      for (const carouselItem of item.carousel_media) {
        if (carouselItem.video_versions) {
          media.push({
            id: carouselItem.pk,
            type: 'video',
            url: carouselItem.video_versions[0].url,
            thumbnailUrl: carouselItem.image_versions2?.candidates?.[0]?.url,
          });
        } else {
          media.push({
            id: carouselItem.pk,
            type: 'image',
            url: carouselItem.image_versions2?.candidates?.[0]?.url,
          });
        }
      }
    } else if (item.image_versions2) {
      // Single image
      media.push({
        id: item.pk,
        type: 'image',
        url: item.image_versions2.candidates[0].url,
        caption: item.caption?.text,
        username: item.user?.username,
      });
    }

    return { success: true, media };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'API request failed',
    };
  }
}

export async function downloadMedia(mediaUrl: string): Promise<Blob | null> {
  try {
    const response = await fetch(mediaUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://www.instagram.com/',
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.blob();
  } catch {
    return null;
  }
}
