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
    'X-IG-App-ID': '936619743392459',
  };

  if (sessionId) {
    headers['Cookie'] = `sessionid=${sessionId}; ds_user_id=${sessionId.split('%')[0]}`;
  }

  return headers;
}

function buildWebHeaders(sessionId?: string): HeadersInit {
  const headers: HeadersInit = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  };

  if (sessionId) {
    headers['Cookie'] = `sessionid=${sessionId}`;
  }

  return headers;
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

    // Try methods in order of reliability

    // 1. Try GraphQL API with session (most reliable)
    if (sessionId) {
      const graphqlResult = await tryGraphQLEndpoint(mediaId, sessionId);
      if (graphqlResult.success) {
        return graphqlResult;
      }
    }

    // 2. Try mobile API with session
    if (sessionId) {
      const apiResult = await tryApiEndpoint(mediaId, mediaType, sessionId);
      if (apiResult.success) {
        return apiResult;
      }
    }

    // 3. Try scraping the page (works for some public posts)
    const scrapeResult = await scrapeMediaPage(url, sessionId);
    if (scrapeResult.success) {
      return scrapeResult;
    }

    // 4. Try the ?__a=1&__d=dis endpoint
    const jsonResult = await tryJsonEndpoint(url, sessionId);
    if (jsonResult.success) {
      return jsonResult;
    }

    return {
      success: false,
      error: sessionId
        ? 'Could not fetch media. The post may be private or the session may have expired.'
        : 'Could not fetch media. Try adding your Instagram Session ID for private content.'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

async function tryGraphQLEndpoint(mediaId: string, sessionId: string): Promise<DownloadResult> {
  try {
    const variables = JSON.stringify({
      shortcode: mediaId,
      child_comment_count: 0,
      fetch_comment_count: 0,
      parent_comment_count: 0,
      has_threaded_comments: false,
    });

    const url = `https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64&variables=${encodeURIComponent(variables)}`;

    const response = await fetch(url, {
      headers: {
        ...buildWebHeaders(sessionId),
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      return { success: false, error: 'GraphQL request failed' };
    }

    const data = await response.json();
    const shortcodeMedia = data?.data?.shortcode_media;

    if (!shortcodeMedia) {
      return { success: false, error: 'No media in GraphQL response' };
    }

    return parseGraphQLMedia(shortcodeMedia);
  } catch {
    return { success: false, error: 'GraphQL endpoint failed' };
  }
}

function parseGraphQLMedia(media: Record<string, unknown>): DownloadResult {
  const result: MediaInfo[] = [];
  const isVideo = media['is_video'] as boolean;
  const typename = media['__typename'] as string;

  if (typename === 'GraphSidecar') {
    // Carousel
    const edges = (media['edge_sidecar_to_children'] as Record<string, unknown>)?.['edges'] as Array<Record<string, unknown>>;
    if (edges) {
      for (const edge of edges) {
        const node = edge['node'] as Record<string, unknown>;
        if (node['is_video']) {
          result.push({
            id: node['id'] as string,
            type: 'video',
            url: node['video_url'] as string,
            thumbnailUrl: node['display_url'] as string,
          });
        } else {
          result.push({
            id: node['id'] as string,
            type: 'image',
            url: node['display_url'] as string,
          });
        }
      }
    }
  } else if (isVideo) {
    result.push({
      id: media['id'] as string,
      type: 'video',
      url: media['video_url'] as string,
      thumbnailUrl: media['display_url'] as string,
      username: (media['owner'] as Record<string, unknown>)?.['username'] as string,
    });
  } else {
    result.push({
      id: media['id'] as string,
      type: 'image',
      url: media['display_url'] as string,
      username: (media['owner'] as Record<string, unknown>)?.['username'] as string,
    });
  }

  if (result.length > 0) {
    return { success: true, media: result };
  }

  return { success: false, error: 'Could not parse media' };
}

async function tryJsonEndpoint(url: string, sessionId?: string): Promise<DownloadResult> {
  try {
    // Clean the URL and add JSON suffix
    const cleanUrl = url.split('?')[0] ?? url;
    const jsonUrl = cleanUrl.endsWith('/')
      ? `${cleanUrl}?__a=1&__d=dis`
      : `${cleanUrl}/?__a=1&__d=dis`;

    const response = await fetch(jsonUrl, {
      headers: buildWebHeaders(sessionId),
    });

    if (!response.ok) {
      return { success: false, error: 'JSON endpoint failed' };
    }

    const data = await response.json();
    const items = data?.items;

    if (!items || items.length === 0) {
      return { success: false, error: 'No items in JSON response' };
    }

    return parseApiMedia(items[0]);
  } catch {
    return { success: false, error: 'JSON endpoint failed' };
  }
}

async function scrapeMediaPage(url: string, sessionId?: string): Promise<DownloadResult> {
  try {
    const response = await fetch(url, {
      headers: buildWebHeaders(sessionId),
      redirect: 'follow',
    });

    if (!response.ok) {
      return { success: false, error: 'Could not fetch page' };
    }

    const html = await response.text();

    // Try multiple patterns to find video/image URLs
    const media: MediaInfo[] = [];
    const mediaId = extractMediaId(url) ?? 'unknown';

    // Pattern 1: video_url in JSON
    const videoMatch = html.match(/"video_url":"([^"]+)"/);
    if (videoMatch?.[1]) {
      const videoUrl = videoMatch[1]
        .replace(/\\u0026/g, '&')
        .replace(/\\\//g, '/');
      media.push({
        id: mediaId,
        type: 'video',
        url: videoUrl,
      });
    }

    // Pattern 2: contentUrl in JSON-LD
    if (media.length === 0) {
      const contentUrlMatch = html.match(/"contentUrl":"([^"]+)"/);
      if (contentUrlMatch?.[1]) {
        const contentUrl = contentUrlMatch[1]
          .replace(/\\u0026/g, '&')
          .replace(/\\\//g, '/');
        media.push({
          id: mediaId,
          type: 'video',
          url: contentUrl,
        });
      }
    }

    // Pattern 3: og:video meta tag
    if (media.length === 0) {
      const ogVideoMatch = html.match(/<meta[^>]+property="og:video"[^>]+content="([^"]+)"/);
      if (ogVideoMatch?.[1]) {
        media.push({
          id: mediaId,
          type: 'video',
          url: ogVideoMatch[1].replace(/&amp;/g, '&'),
        });
      }
    }

    // Pattern 4: display_url for images
    if (media.length === 0) {
      const imageMatch = html.match(/"display_url":"([^"]+)"/);
      if (imageMatch?.[1]) {
        const imageUrl = imageMatch[1]
          .replace(/\\u0026/g, '&')
          .replace(/\\\//g, '/');
        media.push({
          id: mediaId,
          type: 'image',
          url: imageUrl,
        });
      }
    }

    // Pattern 5: og:image meta tag as fallback
    if (media.length === 0) {
      const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
      if (ogImageMatch?.[1]) {
        media.push({
          id: mediaId,
          type: 'image',
          url: ogImageMatch[1].replace(/&amp;/g, '&'),
        });
      }
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

    // First, we need to convert shortcode to media_id
    // The shortcode is base64-like, we need the numeric ID
    const numericId = shortcodeToMediaId(mediaId);

    // Try media info endpoint
    const apiUrl = `${INSTAGRAM_API_URL}/media/${numericId}/info/`;
    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      // Try with shortcode directly
      const altUrl = `${INSTAGRAM_API_URL}/media/${mediaId}/info/`;
      const altResponse = await fetch(altUrl, { headers });

      if (!altResponse.ok) {
        return { success: false, error: 'API request failed' };
      }

      const altData = await altResponse.json();
      return parseApiMedia(altData.items?.[0]);
    }

    const data = await response.json();
    return parseApiMedia(data.items?.[0]);
  } catch {
    return { success: false, error: 'API request failed' };
  }
}

function shortcodeToMediaId(shortcode: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let mediaId = BigInt(0);

  for (const char of shortcode) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    mediaId = mediaId * BigInt(64) + BigInt(index);
  }

  return mediaId.toString();
}

function parseApiMedia(item: Record<string, unknown> | undefined): DownloadResult {
  if (!item) {
    return { success: false, error: 'No media items found' };
  }

  const media: MediaInfo[] = [];

  const videoVersions = item['video_versions'] as Array<Record<string, unknown>> | undefined;
  const carouselMedia = item['carousel_media'] as Array<Record<string, unknown>> | undefined;
  const imageVersions = item['image_versions2'] as Record<string, unknown> | undefined;

  if (videoVersions && videoVersions.length > 0 && videoVersions[0]) {
    // Video content
    const bestVideo = videoVersions[0];
    const candidates = (imageVersions?.['candidates'] as Array<Record<string, unknown>>) ?? [];
    media.push({
      id: String(item['pk'] ?? 'unknown'),
      type: 'video',
      url: bestVideo['url'] as string,
      thumbnailUrl: candidates[0]?.['url'] as string | undefined,
      width: bestVideo['width'] as number | undefined,
      height: bestVideo['height'] as number | undefined,
      caption: (item['caption'] as Record<string, unknown>)?.['text'] as string | undefined,
      username: (item['user'] as Record<string, unknown>)?.['username'] as string | undefined,
    });
  } else if (carouselMedia && carouselMedia.length > 0) {
    // Carousel
    for (const carouselItem of carouselMedia) {
      const itemVideoVersions = carouselItem['video_versions'] as Array<Record<string, unknown>> | undefined;
      const itemImageVersions = carouselItem['image_versions2'] as Record<string, unknown> | undefined;

      if (itemVideoVersions && itemVideoVersions.length > 0 && itemVideoVersions[0]) {
        const candidates = (itemImageVersions?.['candidates'] as Array<Record<string, unknown>>) ?? [];
        media.push({
          id: String(carouselItem['pk'] ?? 'unknown'),
          type: 'video',
          url: itemVideoVersions[0]['url'] as string,
          thumbnailUrl: candidates[0]?.['url'] as string | undefined,
        });
      } else if (itemImageVersions) {
        const candidates = (itemImageVersions['candidates'] as Array<Record<string, unknown>>) ?? [];
        if (candidates[0]) {
          media.push({
            id: String(carouselItem['pk'] ?? 'unknown'),
            type: 'image',
            url: candidates[0]['url'] as string,
          });
        }
      }
    }
  } else if (imageVersions) {
    // Single image
    const candidates = (imageVersions['candidates'] as Array<Record<string, unknown>>) ?? [];
    if (candidates[0]) {
      media.push({
        id: String(item['pk'] ?? 'unknown'),
        type: 'image',
        url: candidates[0]['url'] as string,
        caption: (item['caption'] as Record<string, unknown>)?.['text'] as string | undefined,
        username: (item['user'] as Record<string, unknown>)?.['username'] as string | undefined,
      });
    }
  }

  if (media.length > 0) {
    return { success: true, media };
  }

  return { success: false, error: 'Could not parse media from API response' };
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
