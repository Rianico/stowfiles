---
name: excalidraw-diagram
description: Generate Excalidraw diagrams from text content. Triggers on "Excalidraw", "draw", "flowchart", "mindmap", "visualization", "diagram".
---

# Excalidraw Diagram Generator

Create Excalidraw diagrams from text content for Obsidian. If there are any ambiguous parts, confirm with users first.

## Output Format

All diagrams are generated in Obsidian format (`.md` files) that can be opened directly in Obsidian with the Excalidraw plugin.

## Workflow

1. Analyze content - identify concepts, relationships, hierarchy
2. Choose diagram type (see Diagram Types below)
3. Generate Excalidraw JSON
4. **Automatically save to current working directory**
5. Notify user with file path and usage instructions

## Format Specification

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
- **File naming**: `[theme].[type].md` (e.g., `business-model.relationship.md`)

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

### Text Inside Shape Alignment

When a text element is positioned inside a shape element (rectangle, ellipse, diamond), they must be horizontally centered relative to each other:

**Horizontal center alignment formula:**
- Shape center: `shapeCenterX = shape.x + shape.width / 2`
- Text position: `text.x = shapeCenterX - estimatedTextWidth / 2`
- Where `estimatedTextWidth = text.length * fontSize * 0.5` (CJK: `* 1.0`)

**Vertical positioning:**
- For single-line text: `text.y = shape.y + shape.height / 2` (approximately center)
- For multi-line text: adjust `text.y` to account for total text height

**Quick reference:**
| Shape | Shape Center X | Text X |
|-------|---------------|--------|
| Rectangle at (100, 100) w=200 | 100 + 200/2 = 200 | 200 - textWidth/2 |
| Ellipse at (100, 100) w=150 | 100 + 150/2 = 175 | 175 - textWidth/2 |
| Diamond at (100, 100) w=120 | 100 + 120/2 = 160 | 160 - textWidth/2 |

**Verification example (from real mindmap):**
```
Shape: x=1272.5, width=301.9 → centerX = 1423.45
Text: "Distributed system troubleshooting" (34 chars, fontSize 16)
estimatedWidth = 34 * 16 * 0.5 = 272
text.x = 1423.45 - 272/2 = 1287.45 ≈ 1286.3 ✓
```

### Element Sizing Guide

**Shape width calculation:**
- Formula: `shape.width = text.length * fontSize * 0.5 + 40` (minimum, for CJK: `* 1.0 + 40`)
- Recommended minimum: 120px for readability
- Shape width should provide 20-30px padding on each side of text

**Standard shape sizes:**
| Type | Width | Height | Use Case |
|------|-------|--------|----------|
| Small node | 100-120px | 36px | Simple labels ("point1") |
| Medium node | 160-180px | 50-57px | Headers, categories |
| Large node | 280-320px | 36-40px | Long titles |
| Ellipse (main) | 280-300px | 80-90px | Central topic |

**Shape height guidelines:**
- Single-line text: 36px minimum
- Emphasis/main topics: 50-57px
- Add 20px per additional line of text

### Mindmap Layout Spacing

**Hierarchical spacing (parent → children):**
- Horizontal gap: 50-90px between parent and child shapes
- Arrow length: 45-133px (adjust based on hierarchy depth)

**Sibling spacing:**
- Vertical gap: 30-70px between sibling nodes
- Group related items with 20-30px spacing

**Canvas organization:**
- Root/central topic: center-left (~470-500px from left edge)
- Level 1 children: 300-400px to the right of parent
- Level 2+ children: continue branching rightward with 150-200px spacing

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

**Note:** For automatic centering, bind text to shape using `containerId` (see [Element Binding](references/excalidraw-schema.md#element-binding)). For independent positioning, use the center alignment formula above.

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
- **Text not centered in shape** — When text is inside a shape, align horizontal centers: `text.x = (shape.x + shape.width/2) - textWidth/2`
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

Format: `[theme].[type].md` (e.g., `business-model.relationship.md`)


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

### Example Output Message

```
Excalidraw chart has been generated!

Saved location: business-model.relationship.md

Usage:
1. Open this file in Obsidian
2. Click the MORE OPTIONS menu in the upper right corner
3. Select Switch to EXCALIDRAW VIEW
```
