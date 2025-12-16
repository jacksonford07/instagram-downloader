#!/usr/bin/env python3
"""
Instagram Mass Link Downloader
Downloads media (images/videos) from multiple Instagram post/reel URLs using yt-dlp.
"""

import os
import sys
import subprocess
import argparse
import re
import csv
from pathlib import Path


def get_cookies_path():
    """Get the default cookies file path."""
    return Path(__file__).parent / "cookies.txt"


def get_content_id(url):
    """Extract reel/post ID from Instagram URL."""
    match = re.search(r'/(reel|p)/([^/?]+)', url)
    return match.group(2) if match else url


def check_ytdlp():
    """Check if yt-dlp is installed."""
    try:
        # Try command line first
        subprocess.run(['yt-dlp', '--version'], capture_output=True, check=True)
        return 'cli'
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass

    # Try as Python module
    try:
        subprocess.run([sys.executable, '-m', 'yt_dlp', '--version'], capture_output=True, check=True)
        return 'module'
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def download_single(url, output_dir, counter, ytdlp_mode='cli', cookies_file=None):
    """Download a single URL using yt-dlp."""
    output_template = str(output_dir / f"{counter}.%(ext)s")

    if ytdlp_mode == 'cli':
        cmd = ['yt-dlp']
    else:
        cmd = [sys.executable, '-m', 'yt_dlp']

    cmd.extend([
        '-o', output_template,
        '--no-playlist',
        '--quiet',
        '--no-warnings',
    ])

    # Add cookies if available
    if cookies_file:
        if isinstance(cookies_file, Path):
            cmd.extend(['--cookies', str(cookies_file)])
        else:
            # Browser name passed directly
            cmd.extend(['--cookies-from-browser', cookies_file])

    cmd.append(url)

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            return True, f"Downloaded as {counter}"
        else:
            error = result.stderr.strip() or "Unknown error"
            return False, error[:100]
    except subprocess.TimeoutExpired:
        return False, "Timeout"
    except Exception as e:
        return False, str(e)


def interactive_mode():
    """Let user paste links directly."""
    print(f"\n{'='*50}")
    print("Instagram Mass Downloader - Interactive Mode")
    print(f"{'='*50}")
    print("Paste your Instagram links below (one per line)")
    print("When done, type 'done' or press Enter twice")
    print(f"{'='*50}\n")

    urls = []
    empty_count = 0

    while True:
        try:
            line = input()
            line = line.strip()

            if line.lower() == 'done':
                break
            elif line == '':
                empty_count += 1
                if empty_count >= 2:
                    break
            else:
                empty_count = 0
                if 'instagram.com' in line:
                    urls.append(line)
                    print(f"  Added ({len(urls)})")
        except EOFError:
            break

    return urls


def load_urls_from_file(filepath):
    """Load URLs from a text file (one per line)."""
    urls = []
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                urls.append(line)
    return urls


def main():
    parser = argparse.ArgumentParser(
        description='Download media from Instagram posts, reels, and more.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                              (interactive mode - paste links)
  %(prog)s https://instagram.com/p/ABC123/
  %(prog)s -f links.txt
  %(prog)s -f links.txt -o my_downloads
  %(prog)s url1 url2 url3
        """
    )

    parser.add_argument('urls', nargs='*', help='Instagram URLs to download')
    parser.add_argument('-f', '--file', help='File containing URLs (one per line)')
    parser.add_argument('-o', '--output', default='downloads', help='Output directory (default: downloads)')
    parser.add_argument('-s', '--start', type=int, default=1, help='Starting number for file naming (default: 1)')
    parser.add_argument('-c', '--cookies', help='Path to cookies.txt file (Netscape format)')
    parser.add_argument('--browser', help='Extract cookies from browser (chrome, firefox, safari, edge)')
    parser.add_argument('--check', action='store_true', help='Only check for duplicates, do not download')

    args = parser.parse_args()

    # Check for yt-dlp
    ytdlp_mode = check_ytdlp()
    if not ytdlp_mode:
        print("Error: yt-dlp is not installed.")
        print("Install it with: pip install yt-dlp")
        print("Or: brew install yt-dlp")
        sys.exit(1)

    # Collect URLs
    urls = list(args.urls)

    if args.file:
        if os.path.exists(args.file):
            urls.extend(load_urls_from_file(args.file))
        else:
            print(f"Error: File not found: {args.file}")
            sys.exit(1)

    # If no URLs provided, go interactive
    if not urls:
        urls = interactive_mode()

    if not urls:
        print("\nNo URLs provided. Exiting.")
        sys.exit(1)

    # Remove duplicates based on content ID
    seen_ids = {}
    unique_urls = []
    duplicates = []

    for i, url in enumerate(urls):
        content_id = get_content_id(url)
        if content_id in seen_ids:
            duplicates.append((i + 1, content_id, seen_ids[content_id] + 1))
        else:
            seen_ids[content_id] = len(unique_urls)
            unique_urls.append(url)

    if duplicates:
        print(f"\nFound {len(duplicates)} duplicate(s) - will skip:")
        for line_num, content_id, first_occurrence in duplicates:
            print(f"  Line {line_num}: {content_id} (duplicate of line {first_occurrence})")
        print()

    # If check mode, just report and exit
    if args.check:
        print(f"Total URLs: {len(urls)}")
        print(f"Unique URLs: {len(unique_urls)}")
        print(f"Duplicates: {len(duplicates)}")
        if not duplicates:
            print("NO DUPLICATES - list is clean!")
        else:
            print("\n" + "="*50)
            print("CLEAN LIST (copy this):")
            print("="*50)
            for url in unique_urls:
                print(url)
            print("="*50)
        sys.exit(0)

    # Create output directory
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Handle cookies
    cookies_file = None
    if args.cookies:
        cookies_file = Path(args.cookies)
        if not cookies_file.exists():
            print(f"Warning: Cookies file not found: {args.cookies}")
            cookies_file = None
    elif args.browser:
        # Use browser cookies directly via yt-dlp
        cookies_file = args.browser  # Will be handled specially
    else:
        # Check for default cookies.txt
        default_cookies = get_cookies_path()
        if default_cookies.exists():
            cookies_file = default_cookies

    print(f"\n{'='*50}")
    print(f"Instagram Mass Downloader (yt-dlp)")
    print(f"{'='*50}")
    print(f"URLs to process: {len(unique_urls)}")
    print(f"Output directory: {args.output}")
    if cookies_file:
        if isinstance(cookies_file, Path):
            print(f"Using cookies: {cookies_file}")
        else:
            print(f"Using cookies from: {cookies_file} browser")
    else:
        print("No cookies (some content may fail)")
    print(f"{'='*50}\n")

    # Download
    results = []
    start_num = args.start
    for i, url in enumerate(unique_urls):
        file_num = start_num + i
        print(f"[{i+1}/{len(unique_urls)}] Downloading as {file_num}...", end=" ", flush=True)
        success, msg = download_single(url, output_dir, file_num, ytdlp_mode, cookies_file)

        status = "OK" if success else "FAIL"
        print(f"{status} - {msg}")

        results.append({
            'url': url,
            'success': success,
            'message': msg
        })

    # Summary
    successful = sum(1 for r in results if r['success'])
    failed = len(results) - successful

    print(f"\n{'='*50}")
    print(f"Complete! Downloaded: {successful}/{len(results)}")

    if failed > 0:
        print(f"\nFailed URLs ({failed}):")
        for r in results:
            if not r['success']:
                print(f"  - {r['url']}")
                print(f"    Error: {r['message']}")

    print(f"{'='*50}")
    print(f"\nFiles saved to: {output_dir.absolute()}")

    # Output numbered reference list
    print(f"\n{'='*50}")
    print("REEL LIST (number = filename):")
    print(f"{'='*50}")
    for i, url in enumerate(unique_urls):
        file_num = start_num + i
        content_id = get_content_id(url)
        print(f"{file_num}. {content_id}")
    print(f"{'='*50}")

    # Generate CSV file
    csv_path = output_dir / "reel_list.csv"
    with open(csv_path, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Video Number', 'Creator Name', 'Link'])
        for i, url in enumerate(unique_urls):
            file_num = start_num + i
            # Extract creator name from URL
            creator_match = re.search(r'instagram\.com/([^/]+)/', url)
            creator_name = creator_match.group(1) if creator_match and creator_match.group(1) not in ['reel', 'p'] else ''
            writer.writerow([file_num, creator_name, url])

    print(f"\nCSV saved to: {csv_path.absolute()}")


if __name__ == '__main__':
    main()
