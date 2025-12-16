# Instagram Downloader CLI

Command-line tool for batch downloading Instagram media using yt-dlp.

## Installation

```bash
pip install -r requirements.txt
pip install yt-dlp  # or: brew install yt-dlp
```

## Usage

```bash
# Interactive mode - paste links directly
python ig_downloader.py

# Download from file
python ig_downloader.py -f links.txt -o downloads

# Download specific URLs
python ig_downloader.py https://instagram.com/reel/ABC123/

# With cookies for private content
python ig_downloader.py -f links.txt -c cookies.txt

# Using browser cookies
python ig_downloader.py -f links.txt --browser chrome

# Check for duplicates only
python ig_downloader.py -f links.txt --check
```

## Options

- `-f, --file` - File containing URLs (one per line)
- `-o, --output` - Output directory (default: downloads)
- `-s, --start` - Starting number for file naming (default: 1)
- `-c, --cookies` - Path to cookies.txt file (Netscape format)
- `--browser` - Extract cookies from browser (chrome, firefox, safari, edge)
- `--check` - Only check for duplicates, don't download

## Output

- Numbered MP4/JPG files
- `reel_list.csv` with video mappings
