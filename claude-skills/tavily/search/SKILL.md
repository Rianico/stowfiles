---
name: search
description: "Search the web by Tavily's LLM-optimized search API. Return relevant results with content snippets, scores, and metadata. Use when you need to find web content on any topic."
---

# Search Skill

Use script to search the web and get relevant results optimized for LLM consumption.

## Quick Start

### Using the Script

```bash
./scripts/search.sh '<json>'
```

**Examples:**
```bash
# Basic search
./scripts/search.sh '{"query": "python async patterns"}'

# With options
./scripts/search.sh '{"query": "React hooks tutorial", "max_results": 10}'

# Advanced search with filters
./scripts/search.sh '{"query": "AI news", "time_range": "week", "max_results": 10}'

# Domain-filtered search
./scripts/search.sh '{"query": "machine learning", "include_domains": ["arxiv.org", "github.com"], "search_depth": "advanced"}'

# Include raw content
./scripts/search.sh '{"query": "machine learning", "include_raw_content": true, "search_depth": "advanced"}'
```

## API Reference

### Request Body

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `query` | string | Required | Search query (keep under 400 chars) |
| `max_results` | integer | 10 | Maximum results (0-20) |
| `search_depth` | string | `"basic"` | `ultra-fast`, `fast`, `basic`, `advanced` |
| `topic` | string | `"general"` | Search topic (general only) |
| `time_range` | string | null | `day`, `week`, `month`, `year` |
| `start_date` | string | null | Return results after this date (`YYYY-MM-DD`) |
| `end_date` | string | null | Return results before this date (`YYYY-MM-DD`) |
| `include_domains` | array | [] | Domains to include (max 300) |
| `exclude_domains` | array | [] | Domains to exclude (max 150) |
| `country` | string | null | Boost results from a specific country (general topic only) |
| `include_raw_content` | boolean | false | Include full page content |
| `include_images` | boolean | false | Include image results |
| `include_image_descriptions` | boolean | false | Include descriptions for images |
| `include_favicon` | boolean | false | Include favicon URL for each result |

### Response Format

```json
{
  "query": "latest developments in quantum computing",
  "results": [
    {
      "title": "Page Title",
      "url": "https://example.com/page",
      "content": "Extracted text snippet...",
      "score": 0.85
    }
  ],
  "response_time": 1.2
}
```

## Search Depth

| Depth | Latency | Relevance | Content Type |
|-------|---------|-----------|--------------|
| `ultra-fast` | Lowest | Lower | NLP summary |
| `fast` | Low | Good | Chunks |
| `basic` | Medium | High | NLP summary |
| `advanced` | Higher | Highest | Chunks |

**When to use each:**
- `ultra-fast`: Real-time chat, autocomplete
- `fast`: Need chunks but latency matters
- `basic`: General-purpose, balanced
- `advanced`: Precision matters (default recommendation)

## Tips

- **Keep queries under 400 characters** - Think search query, not prompt
- **Break complex queries into sub-queries** - Better results than one massive query
- **Use `include_domains`** to focus on trusted sources
- **Use `time_range`** for recent information
- **Filter by `score`** (0-1) to get highest relevance results
