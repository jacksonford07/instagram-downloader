import { NextRequest, NextResponse } from 'next/server';
import { DownloadRequestSchema } from '@/lib/validation';
import { getMediaInfo, type DownloadResult } from '@/lib/instagram';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = Number(process.env['RATE_LIMIT']) || 10;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_CLEANUP_INTERVAL = 60 * 1000; // Clean up every minute

const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Cache for media info responses
interface CacheEntry {
  data: DownloadResult;
  expires: number;
}

const mediaCache = new Map<string, CacheEntry>();

// Map to deduplicate concurrent requests for the same URL
const pendingRequests = new Map<string, Promise<DownloadResult>>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

function getCacheKey(url: string, sessionId?: string): string {
  // Include session ID in cache key to avoid leaking private content
  return `${url}:${sessionId ? 'auth' : 'public'}`;
}

function getCachedMedia(cacheKey: string): DownloadResult | null {
  const cached = mediaCache.get(cacheKey);
  if (!cached) return null;

  if (Date.now() > cached.expires) {
    mediaCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

function setCachedMedia(cacheKey: string, data: DownloadResult): void {
  mediaCache.set(cacheKey, {
    data,
    expires: Date.now() + CACHE_TTL,
  });
}

// Cleanup expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of mediaCache.entries()) {
    if (now > entry.expires) {
      mediaCache.delete(key);
    }
  }
}, CACHE_CLEANUP_INTERVAL);

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validation = DownloadRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    const { url } = validation.data;
    // Use client-provided session ID or fall back to env var
    const sessionId = body.sessionId || process.env['INSTAGRAM_SESSION_ID'];

    const cacheKey = getCacheKey(url, sessionId);

    // Check cache first
    const cached = getCachedMedia(cacheKey);
    if (cached) {
      console.log('Cache hit for:', url);
      return NextResponse.json({
        success: cached.success,
        media: cached.media,
        cached: true,
      });
    }

    // Check if there's already a pending request for this URL
    let pendingRequest = pendingRequests.get(cacheKey);

    if (!pendingRequest) {
      // Create a new request and store it
      pendingRequest = getMediaInfo(url, sessionId);
      pendingRequests.set(cacheKey, pendingRequest);

      // Remove from pending requests when done (success or failure)
      pendingRequest.finally(() => {
        pendingRequests.delete(cacheKey);
      });
    } else {
      console.log('Deduplicating request for:', url);
    }

    // Wait for the result
    const result = await pendingRequest;

    // Cache successful results
    if (result.success && result.media) {
      setCachedMedia(cacheKey, result);
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Failed to fetch media' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      media: result.media,
      cached: false,
    });
  } catch (error) {
    console.error('Download API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Instagram Downloader API',
    endpoints: {
      POST: '/api/download - Download Instagram media',
    },
    usage: {
      method: 'POST',
      body: { url: 'https://instagram.com/reel/...' },
    },
  });
}
