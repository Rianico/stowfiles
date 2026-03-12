#!/usr/bin/env python3
"""
Smart Web Fetch - URL Preprocessor
Automatically convert URLs to cleaning service addresses, supports multi-level fallback
"""

import sys
import urllib.parse
import urllib.request
import ssl

# Ignore SSL verification (needed by some services)
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE


def transform_url(original_url: str) -> str:
    """
    Convert original URL to intelligent cleaning URL
    Strategy: Jina → markdown.new → defuddle.md
    """
    encoded_url = urllib.parse.quote(original_url, safe='')

    # 1. Primary: Jina Reader (free, no API Key needed)
    jina_url = f"https://r.jina.ai/http://{original_url.replace('https://', '').replace('http://', '')}"
    if test_url(jina_url):
        return jina_url

    # 2. Fallback: markdown.new
    markdown_new_url = f"https://markdown.new/{original_url}"
    if test_url(markdown_new_url):
        return markdown_new_url

    # 3. Final fallback: defuddle.md
    defuddle_url = f"https://defuddle.md/{original_url}"
    return defuddle_url


def test_url(url: str, timeout: int = 10) -> bool:
    """Test if URL is accessible"""
    try:
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0'
            },
            method='HEAD'
        )
        with urllib.request.urlopen(req, timeout=timeout, context=ssl_context) as response:
            return response.status == 200
    except Exception:
        return False


def main():
    if len(sys.argv) < 2:
        print("Usage: smart-url.py <url>", file=sys.stderr)
        sys.exit(1)

    original_url = sys.argv[1]
    transformed = transform_url(original_url)
    print(transformed)


if __name__ == "__main__":
    main()
