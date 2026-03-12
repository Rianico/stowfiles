#!/usr/bin/env python3
"""
Smart Web Fetch - Complete intelligent web page fetching tool
Automatically convert URLs + fetch cleaned Markdown content
"""

import sys
import urllib.parse
import urllib.request
import ssl
import json

# Ignore SSL verification
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE


def get_clean_content(url: str, timeout: int = 30) -> dict:
    """
    Fetch clean Markdown content from webpage
    Strategy: Jina → markdown.new → defuddle.md → original content

    Returns:
        {
            "success": bool,
            "url": str,           # Actual cleaning service URL used
            "content": str,       # Fetched content
            "source": str,        # Service used: jina/markdown-new/defuddle/original
            "error": str          # Error message when failed
        }
    """
    original_url = url.strip()

    # Cleaning services list (by priority)
    services = [
        ("jina", lambda u: f"https://r.jina.ai/http://{u.replace('https://', '').replace('http://', '')}"),
        ("markdown-new", lambda u: f"https://markdown.new/{u}"),
        ("defuddle", lambda u: f"https://defuddle.md/{u}"),
    ]

    # Try each service
    for service_name, url_builder in services:
        try:
            clean_url = url_builder(original_url)
            result = fetch_url(clean_url, timeout)

            if result["success"] and len(result["content"]) > 100:
                return {
                    "success": True,
                    "url": clean_url,
                    "content": result["content"],
                    "source": service_name,
                    "error": None
                }
        except Exception as e:
            continue

    # All cleaning services failed, try fetching original content directly
    try:
        result = fetch_url(original_url, timeout)
        if result["success"]:
            return {
                "success": True,
                "url": original_url,
                "content": result["content"],
                "source": "original",
                "error": None
            }
    except Exception as e:
        pass

    return {
        "success": False,
        "url": original_url,
        "content": "",
        "source": "none",
        "error": "All services failed to fetch content"
    }


def fetch_url(url: str, timeout: int = 30) -> dict:
    """Fetch URL content"""
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0'
        }
    )

    with urllib.request.urlopen(req, timeout=timeout, context=ssl_context) as response:
        content = response.read().decode('utf-8', errors='ignore')
        return {
            "success": response.status == 200,
            "content": content,
            "status": response.status
        }


def main():
    if len(sys.argv) < 2:
        print("Usage: fetch.py <url> [--json]", file=sys.stderr)
        print("  --json    Output as JSON", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    output_json = "--json" in sys.argv

    result = get_clean_content(url)

    if output_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if result["success"]:
            print(f"# Source: {result['source']}")
            print(f"# URL: {result['url']}")
            print()
            print(result["content"])
        else:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
