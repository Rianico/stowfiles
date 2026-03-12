---
name: smart-web-fetch
description: Alternative web_fetch with intelligent content extraction that delivers clean Markdown. 
---

# Smart Web Fetch

Intelligent web content fetching skill that completely replaces web_fetch, automatically obtains clean Markdown through cleaning services.

## Core Features

- **Complete replacement of web_fetch**: Obtains cleaned Markdown directly, not raw HTML
- **Four-level fallback strategy**: Jina → markdown.new → defuddle.md → original content
- **Token optimization**: Cleaned content saves 50-80% tokens compared to raw HTML

## Usage

### Command line web content fetching

```bash
# Get cleaned Markdown (text output)
python3 {baseDir}/scripts/fetch.py "https://example.com/article"

# Get JSON format (with metadata)
python3 {baseDir}/scripts/fetch.py "https://example.com/article" --json
```

### Using in Agent

**When users need to fetch web content:**

```
User: "Help me check the content of https://example.com/article"

Agent should:
1. Run: python3 ~/.openclaw/skills/smart-web-fetch/scripts/fetch.py "https://example.com/article"
2. Directly obtain cleaned Markdown content
```

## JSON Output Format

```json
{
  "success": true,
  "url": "https://r.jina.ai/http://example.com/article",
  "content": "# Article Title\n\nClean markdown content here...",
  "source": "jina",
  "error": null
}
```

## Fallback Strategy

1. **Jina Reader** (Primary)
   - URL: `https://r.jina.ai/http://{target}`
   - Free, no API Key required, good Chinese support

2. **markdown.new** (Fallback)
   - URL: `https://markdown.new/{target}`

3. **defuddle.md** (Fallback)
   - URL: `https://defuddle.md/{target}`

4. **Original content** (Final fallback)
   - Directly fetch original HTML

## Advantages

- 🚀 **Save 50-80% tokens**: Remove noise like ads, navigation bars, etc.
- 🔄 **Automatic fault tolerance**: Four-level service fallback, ensuring availability
- 🆓 **Zero cost**: All free services
- 🔌 **Plug and play**: No API Keys required
- 📝 **Clean output**: Pure Markdown, no additional parsing needed
