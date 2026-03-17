---
name: excalidraw-diagram
description: Generate Excalidraw diagrams from text content. Supports three output modes - Obsidian (.md), Standard (.excalidraw), and Animated (.excalidraw with animation order). Triggers on "Excalidraw", "draw", "flowchart", "mindmap", "visualization", "diagram", "standard Excalidraw", "standard excalidraw", "Excalidraw animation", "animated chart", "animate".
---

# Excalidraw Diagram Generator

Create Excalidraw diagrams from text content with multiple output formats. If there are any ambiguous part, confirm with users at first.

## Output Modes

Select output mode based on user trigger words:

| Trigger Word | Output Mode | File Format | Purpose |
|--------|----------|----------|------|
| `Excalidraw`, `draw`, `flowchart`, `mindmap` | **Obsidian** (default) | `.md` | Open directly in Obsidian |
| `standard Excalidraw`, `standard excalidraw` | **Standard** | `.excalidraw` | Open/edit/share in excalidraw.com |
| `Excalidraw animation`, `animated chart`, `animate` | **Animated** | `.excalidraw` | Drag to excalidraw-animate to generate animation |

## Workflow

1. **Detect output mode** from trigger words (see Output Modes table above)
2. Analyze content - identify concepts, relationships, hierarchy
3. Choose diagram type (see Diagram Types below)
4. Generate Excalidraw JSON (add animation order if Animated mode)
5. Output in correct format based on mode
6. **Automatically save to current working directory**
7. Notify user with file path and usage instructions

## Output Formats

### Mode 1: Obsidian Format (Default)

**Strictly output according to the following structure, no modifications allowed:**

```markdown
---
excalidraw-plugin: parsed
tags: [excalidraw]
---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'

# Excalidraw Data

## Text Elements
%%
## Drawing
\`\`\`json
{Complete JSON data}
\`\`\`
%%
```

**Key Points:**
- Frontmatter must include `tags: [excalidraw]`
- Warning information must be complete
- JSON must be surrounded by `%%` markers
- Cannot use any other frontmatter settings besides `excalidraw-plugin: parsed`
- **File extension**: `.md`

### Mode 2: Standard Excalidraw Format

Directly output pure JSON file that can be opened in excalidraw.com:

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [...],
  "appState": {
    "gridSize": null,
    "viewBackgroundColor": "#ffffff"
  },
  "files": {}
}
```

**Key Points:**
- `source` uses `https://excalidraw.com` (not Obsidian plugin)
- Pure JSON, no Markdown wrapper
- **File extension**: `.excalidraw`

### Mode 3: Animated Excalidraw Format

Same as Standard format, but each element adds `customData.animate` field to control animation order:

```json
{
  "id": "element-1",
  "type": "rectangle",
  "customData": {
    "animate": {
      "order": 1,
      "duration": 500
    }
  },
  ...other standard fields
}
```

**Animation Order Rules:**
- `order`: Animation playback order (1, 2, 3...), smaller numbers appear first
- `duration`: Element drawing duration (milliseconds), default 500
- Elements with the same `order` appear simultaneously
- Recommended order: Title → Main frame → Connection lines → Detail text

**Usage Method:**
1. Generate `.excalidraw` file
2. Drag to https://dai-shi.github.io/excalidraw-animate/
3. Click Animate to preview, then export SVG or WebM

**File extension**: `.excalidraw`

---

## Diagram Types & Selection Guide

Choose appropriate chart forms to enhance comprehension and visual appeal.

| Type | English | Use Cases | Approach |
|------|------|---------|------|
| **Flowchart** | Flowchart | Step instructions, workflow, task execution order | Connect steps with arrows, clearly express flow direction |
| **Mind Map** | Mind Map | Concept brainstorming, topic classification, inspiration capture | Radiate from center outward, radial structure |
| **Hierarchy Chart** | Hierarchy | Organizational structure, content grading, system decomposition | Build hierarchical nodes from top to bottom or left to right |
| **Relationship Chart** | Relationship | Influence, dependency, interaction between elements | Connect graphics with lines showing association, arrows and annotations |
| **Comparison Chart** | Comparison | Comparative analysis of two or more schemes or viewpoints | Two-column or table format, indicate comparison dimensions |
| **Timeline Chart** | Timeline | Event development, project progress, model evolution | Time axis with key time points and events marked |
| **Matrix Chart** | Matrix | Two-dimensional classification, task priority, positioning | Establish X and Y dimensions, arrange on coordinate plane |
| **Freeform** | Freeform | Scattered content, inspiration recording, preliminary information collection | No structural constraints, freely place blocks and arrows |

## Design Rules

### Text & Format
- **All text elements must use** `fontFamily: 5` (Excalifont handwritten font)
- **Text double quote replacement rule**: Replace `"` with `『』`
- **Text parenthesis replacement rule**: Replace `()` with `「」`
- **Font size rules** (hard minimum, text below this is unreadable at normal zoom):
  - Titles: 20-28px (minimum 20px)
  - Subtitles: 18-20px
  - Body text/labels: 16-18px (minimum 16px)
  - Secondary notes: 14px (only for unimportant auxiliary explanations, use sparingly)
  - **Absolutely prohibited below 14px**
- **Line height**: All text uses `lineHeight: 1.25`
- **Text centering estimation**: Independent text elements have no automatic centering, calculate x coordinate manually:
  - Estimate text width: `estimatedWidth = text.length * fontSize * 0.5` (for CJK characters use `* 1.0`)
  - Center formula: `x = centerX - estimatedWidth / 2`
  - Example: Text "Hello" (5 chars, fontSize 20) centered at x=300 → `estimatedWidth = 5 * 20 * 0.5 = 50` → `x = 300 - 25 = 275`
- **Icon**: Select icons from the icon library under `libraries`

### Layout & Design
- **Canvas range**: Recommend all elements stay within 0-1200 x 0-800 region
- **Minimum shape size**: Rectangles/ellipses with text should not be smaller than 120x60px
- **Element spacing**: Minimum 20-30px spacing to prevent overlap
- **Clear hierarchy**: Use different colors and shapes to distinguish different levels of information
- **Graphic elements**: Appropriately use rectangles, circles, arrows, etc. to organize information
- **Prohibited Emoji**: Do not use any emoji symbols in chart text, use simple graphics (circles, squares, arrows) or color differentiation for visual markers

### Color Palette

**Text color (strokeColor for text):**

| Purpose | Value | Description |
|------|------|------|
| Title | `#1e40af` | Dark blue |
| Subtitle/connection lines | `#3b82f6` | Light blue |
| Body text | `#374151` | Dark gray (on white background, lightest not below `#757575`) |
| Emphasis/highlight | `#f59e0b` | Gold |

**Shape fill color (backgroundColor, fillStyle: "solid"):**

| Value | Semantics | Application Scenario |
|------|------|---------|
| `#a5d8ff` | Light blue | Input, data source, main node |
| `#b2f2bb` | Light green | Success, output, completed |
| `#ffd8a8` | Light orange | Warning, pending, external dependency |
| `#d0bfff` | Light purple | Processing, middleware, special items |
| `#ffc9c9` | Light red | Error, critical, alert |
| `#fff3bf` | Light yellow | Note, decision, planning |
| `#c3fae8` | Light cyan | Storage, data, cache |
| `#eebefa` | Light pink | Analysis, metrics, statistics |

**Area background color (large rectangles + opacity: 30, for layered charts):**

| Value | Semantics |
|------|------|
| `#dbe4ff` | Frontend/UI layer |
| `#e5dbff` | Logic/processing layer |
| `#d3f9d8` | Data/tool layer |

**Contrast rules:**
- Text on white background should not be lighter than `#757575`, otherwise it's unreadable
- Light colored backgrounds use darker variant text (e.g., light green background uses `#15803d`, not `#22c55e`)
- Avoid light gray text (`#b0b0b0`, `#999`) on white background

Reference: [references/excalidraw-schema.md](references/excalidraw-schema.md)

## JSON Structure

**Obsidian mode:**
```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://github.com/zsviczian/obsidian-excalidraw-plugin",
  "elements": [...],
  "appState": { "gridSize": null, "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```

**Standard / Animated mode:**
```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [...],
  "appState": { "gridSize": null, "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```

## Element Template

Each element requires these fields (do NOT add extra fields like `frameId`, `index`, `versionNonce`, `rawText` -- they may cause issues on excalidraw.com. `boundElements` must be `null` not `[]`, `updated` must be `1` not timestamps):

```json
{
  "id": "unique-id",
  "type": "rectangle",
  "x": 100, "y": 100,
  "width": 200, "height": 50,
  "angle": 0,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 1,
  "opacity": 100,
  "groupIds": [],
  "roundness": {"type": 3},
  "seed": 123456789,
  "version": 1,
  "isDeleted": false,
  "boundElements": null,
  "updated": 1,
  "link": null,
  "locked": false
}
```

`strokeStyle` values: `"solid"` (solid line, default) | `"dashed"` (dashed line) | `"dotted"` (dotted line). Dashed lines are suitable for optional paths, asynchronous flows, weak associations, etc.

Text elements add:
```json
{
  "text": "Display text",
  "fontSize": 20,
  "fontFamily": 5,
  "textAlign": "center",
  "verticalAlign": "middle",
  "containerId": null,
  "originalText": "Display text",
  "autoResize": true,
  "lineHeight": 1.25
}
```

**Animated mode additionally adds** `customData` field:
```json
{
  "id": "title-1",
  "type": "text",
  "customData": {
    "animate": {
      "order": 1,
      "duration": 500
    }
  },
  ...other fields
}
```

See [references/excalidraw-schema.md](references/excalidraw-schema.md) for all element types.

---

## Additional Technical Requirements

### Text Elements processing
- `## Text Elements` section in Markdown **must be left empty**, only use `%%` as separator
- Obsidian ExcaliDraw plugin will **automatically populate text elements** based on JSON data
- No need to manually list all text content

### Coordinates and Layout
- **Coordinate system**: Top-left corner as origin (0,0)
- **Recommended range**: All elements within 0-1200 x 0-800 pixel range
- **Element ID**: Each element needs a unique `id` (can be string like "title", "box1", etc.)

### Required Fields for All Elements

**IMPORTANT**: Do NOT include `frameId`, `index`, `versionNonce`, or `rawText` fields. Use `boundElements: null` (not `[]`), and `updated: 1` (not timestamps).

```json
{
  "id": "unique-identifier",
  "type": "rectangle|text|arrow|ellipse|diamond",
  "x": 100, "y": 100,
  "width": 200, "height": 50,
  "angle": 0,
  "strokeColor": "#color-hex",
  "backgroundColor": "transparent|#color-hex",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid|dashed|dotted",
  "roughness": 1,
  "opacity": 100,
  "groupIds": [],
  "roundness": {"type": 3},
  "seed": 123456789,
  "version": 1,
  "isDeleted": false,
  "boundElements": null,
  "updated": 1,
  "link": null,
  "locked": false
}
```

### Text-Specific Properties
Text elements (type: "text") need additional properties (do NOT include `rawText`):
```json
{
  "text": "Display text",
  "fontSize": 20,
  "fontFamily": 5,
  "textAlign": "center",
  "verticalAlign": "middle",
  "containerId": null,
  "originalText": "Display text",
  "autoResize": true,
  "lineHeight": 1.25
}
```

### appState configuration
```json
"appState": {
  "gridSize": null,
  "viewBackgroundColor": "#ffffff"
}
```

### files field
```json
"files": {}
```

## Common Mistakes to Avoid

- **Text offset** — Independent text elements `x` is the left edge, not the center. Must calculate manually with centering formula, otherwise text will drift to one side
- **Element overlap** — Elements with similar y coordinates tend to stack. Check before placing new elements that there is at least 20px spacing from surrounding elements
- **Insufficient canvas padding** — Content shouldn't touch the edges of the canvas. Leave 50-80px padding on all sides
- **Title not centered relative to chart** — Title should be centered on the overall width of the chart below, not fixed at x=0
- **Arrow label overflow** — Long text labels (like "ATP + NADPH") will exceed short arrows. Keep labels short or increase arrow length
- **Insufficient contrast** — Light text on white background is almost invisible. Text color should not be lighter than `#757575`, use darker variants for colored text
- **Font size too small** — Below 14px is unreadable at normal zoom, minimum 16px for body text

## Implementation Notes

### Auto-save & File Generation Workflow

When generating Excalidraw charts, **must automatically perform the following steps**:

#### 1. Select appropriate chart type
- Based on characteristics of user-provided content, refer to above "Diagram Types & Selection Guide" table
- Analyze core requirements of content, choose the most appropriate visualization form

#### 2. Generate meaningful filename

According to output mode select file extension:

| Mode | Filename format | Example |
|------|-----------|------|
| Obsidian | `[theme].[type].md` | `business-model.relationship.md` |
| Standard | `[theme].[type].excalidraw` | `business-model.relationship.excalidraw` |
| Animated | `[theme].[type].animate.excalidraw` | `business-model.relationship.animate.excalidraw` |


#### 3. Use Write tool to automatically save file
- **Save path**: Prioritize following user's project regulations. If no regulations, use default path: `{current_directory}/[filename].md`

#### 4. Ensure Markdown structure is completely correct
**Must generate in the following format** (no modifications allowed):

```markdown
---
excalidraw-plugin: parsed
tags: [excalidraw]
---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'

# Excalidraw Data

## Text Elements
%%
## Drawing
\`\`\`json
{Complete JSON data}
\`\`\`
%%
```

#### 5. JSON data requirements
- Include complete Excalidraw JSON structure
- All text elements use `fontFamily: 5`
- Replace `"` in text with `『』`
- Replace `()` in text with `「」`
- JSON format must be valid, pass syntax checking
- All elements have unique `id`
- Include `appState` and `files: {}` fields

#### 6. User feedback and confirmation
Report to user:
- Chart has been generated
- Exact save location
- How to view in Obsidian
- Explanation of design choices (what type of chart was chosen, why)
- Whether adjustments or modifications are needed

### Example Output Messages

**Obsidian mode:**
```
Excalidraw chart has been generated!

Saved location: business-model.relationship.md

Usage:
1. Open this file in Obsidian
2. Click the MORE OPTIONS menu in the upper right corner
3. Select Switch to EXCALIDRAW VIEW
```

**Standard mode:**
```
Excalidraw chart has been generated!

Saved location: business-model.relationship.excalidraw

Usage:
1. Open https://excalidraw.com
2. Click upper left menu → Open → Select this file
3. Or drag and drop the file directly onto the excalidraw.com page
```

**Animated mode:**
```
Excalidraw animated chart has been generated!

Saved location: business-model.relationship.animate.excalidraw

Animation sequence: Title(1) → Main frame(2-4) → Connection lines(5-7) → Explanation text(8-10)

Generate animation:
1. Open https://dai-shi.github.io/excalidraw-animate/
2. Click Load File and select this file
3. Preview animation effects
4. Click Export to export SVG or WebM
```
