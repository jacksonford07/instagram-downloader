# Instagram Downloader

A web-based Instagram media downloader with a beautiful UI, deployed on Vercel.

## Features

- Download Instagram posts, reels, and stories
- HD quality downloads
- No watermarks
- Fast and reliable
- Mobile-friendly interface

## Quick Start

### Local Development

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Setup

Create a `.env.local` file in the `web` directory:

```env
# Instagram authentication (optional but recommended)
INSTAGRAM_SESSION_ID=your_session_id_here

# Rate limiting
RATE_LIMIT=10
```

## Deployment

### Deploy to Vercel

1. Push this repository to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Set the root directory to `web`
5. Add environment variables:
   - `INSTAGRAM_SESSION_ID`: Your Instagram session ID
6. Deploy!

### Getting Your Instagram Session ID

1. Log into Instagram in your web browser
2. Open Developer Tools (F12)
3. Go to Application > Cookies > instagram.com
4. Find the `sessionid` cookie
5. Copy the value (it starts with a number)

## API Endpoints

### POST /api/download

Fetch media information from an Instagram URL.

**Request:**
```json
{
  "url": "https://www.instagram.com/reel/ABC123/"
}
```

**Response:**
```json
{
  "success": true,
  "media": [
    {
      "id": "123456789",
      "type": "video",
      "url": "https://...",
      "thumbnailUrl": "https://..."
    }
  ]
}
```

### GET /api/download/proxy?url=...

Proxy endpoint for downloading media (handles CORS).

## CLI Tool

For batch downloads, use the Python CLI in the `cli/` directory:

```bash
cd cli
python ig_downloader.py -f links.txt -o downloads
```

See [cli/README.md](cli/README.md) for full CLI documentation.

## Tech Stack

- [Next.js 15](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Zod](https://zod.dev/) - Validation
- [Vercel](https://vercel.com/) - Deployment

## License

For personal use only. Please respect Instagram's terms of service and copyright.
