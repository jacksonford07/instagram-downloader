# Instagram Downloader - Project Guidelines

## Project Overview
Web-based Instagram media downloader built with Next.js 15 for Vercel deployment. Supports downloading posts, reels, and stories.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **Deployment**: Vercel

## Project Structure
```
ig downloader/
├── web/                      # Next.js application (Vercel)
│   ├── src/
│   │   ├── app/             # App router pages & API routes
│   │   │   ├── api/         # Backend API endpoints
│   │   │   │   └── download/
│   │   │   ├── page.tsx     # Homepage
│   │   │   └── layout.tsx   # Root layout
│   │   ├── components/      # React components
│   │   └── lib/             # Utility functions
│   │       ├── instagram.ts # Instagram API/scraping logic
│   │       └── validation.ts # Zod schemas
│   └── public/              # Static assets
├── cli/                      # Python CLI tool
│   ├── ig_downloader.py     # Batch downloader using yt-dlp
│   └── requirements.txt     # Python dependencies
├── CLAUDE.md                # This file
└── README.md                # Project documentation
```

## Key Development Rules

### Code Quality
1. **No `any` types** - Use proper TypeScript types
2. **Validate all inputs** with Zod schemas
3. **Handle all error states** - loading, error, empty, success
4. **Rate limit API endpoints** to prevent abuse

### API Structure
- `/api/download` - POST endpoint for fetching media info
- `/api/download/proxy` - GET endpoint for proxying media downloads (CORS bypass)

### Instagram Authentication
The app supports two methods:
1. **Session ID** (recommended): Set `INSTAGRAM_SESSION_ID` env var
2. **Public scraping**: Works for public posts without auth

### Environment Variables
```env
INSTAGRAM_SESSION_ID=your_session_id  # From Instagram cookies
RATE_LIMIT=10                          # Requests per minute per IP
```

## Deployment to Vercel

1. Push to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Getting Instagram Session ID
1. Log into Instagram in browser
2. Open DevTools > Application > Cookies
3. Find `sessionid` cookie value
4. Add to Vercel environment variables

## CLI Tool
The Python CLI in `cli/` is for local batch downloads using yt-dlp.

```bash
cd cli
python ig_downloader.py -f links.txt -o downloads
```
