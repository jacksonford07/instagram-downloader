import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
  }

  try {
    // Validate URL is from Instagram CDN
    const parsedUrl = new URL(url);
    const allowedHosts = [
      'scontent.cdninstagram.com',
      'video.cdninstagram.com',
      'instagram.com',
      'cdninstagram.com',
    ];

    const isAllowed = allowedHosts.some(
      (host) => parsedUrl.hostname.endsWith(host) || parsedUrl.hostname === host
    );

    if (!isAllowed) {
      return NextResponse.json({ error: 'Invalid media URL' }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.instagram.com/',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch media' },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    const blob = await response.blob();

    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="instagram_media.${contentType.includes('video') ? 'mp4' : 'jpg'}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
