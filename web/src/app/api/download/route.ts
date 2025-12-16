import { NextRequest, NextResponse } from 'next/server';
import { DownloadRequestSchema } from '@/lib/validation';
import { getMediaInfo } from '@/lib/instagram';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = Number(process.env['RATE_LIMIT']) || 10;

const requestCounts = new Map<string, { count: number; resetTime: number }>();

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

    // Get media info
    const result = await getMediaInfo(url, sessionId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Failed to fetch media' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      media: result.media,
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
