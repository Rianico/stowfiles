---
name: excalidraw-diagram
description: Generate Excalidraw diagrams in Obsidian. Triggers on "Excalidraw", "draw", "flowchart", "mindmap", "visualization", "diagram".
---

# Excalidraw Diagram Generator

Create Obsidian Excalidraw diagrams. **Always confirm style with user before generating.** Finally use script `{skill_path}/scripts/excalidraw-validator.py` to check and fix the output drawing, then run `{skill_path}/scripts/excalidraw-compressor.py` to compress the JSON blocks.

---

## Quick Start (Read First)

1. **Present 4 style options** → Wait for user selection (see [Style Options](#style-options))
2. **Choose diagram type** based on content (see [Diagram Types](#diagram-types))
3. **Generate markdown file** with Excalidraw JSON (see [Format](#format-specification))
4. **Validate IDs** → Run `uv run {skill_path}/scripts/excalidraw-validator.py --check <file.md>` (see [Validation](#validation-required))
   - 4.1 Whenever IDs or link elements are involved, use the validator script instead of reading the whole content
   - 4.2 Run `--fix` if any errors are detected, then run `--check` again to verify. Repeat until no errors
5. **Compress** → Run `uv run {skill_path}/scripts/excalidraw-compressor.py <file.md>` to compress JSON blocks
6. **Notify user** with file path and usage instructions

---

## Style Options

**Present these 4 options and wait for user response:**

| # | Style | Best For |
|---|-------|----------|
| 1 | **Sketch Card** | Notes, summaries, concept cards |
| 2 | **MindMap** | Brainstorming, hierarchical topics |
| 3 | **FlowChart** | Workflows, processes, algorithms |
| 4 | **AI Select 3** | I'll recommend a style based on content |

### User Prompt Template

```
---
**Excalidraw Diagram - Style Selection**

I'll create a diagram for your content. Please select a style:

1. **Sketch Card** - Card-style elements, rounded corners, solid fills
   Best for: Notes, summaries, concept cards

2. **MindMap** - Radial branching from central topic
   Best for: Brainstorming, idea organization

3. **FlowChart** - Sequential flow with directional arrows
   Best for: Workflows, processes, algorithms

4. **{AI's recommanded Style}**(AI Recommanded) - {Recommanded Reason}
Reply with a number (1-4) or style name.
---
```

Analyze content and recommend the style based on [AI Selection](#ai-selection-guidelines).

---

## Diagram Types

| Type | Use Case |
|------|----------|
| Flowchart | Step instructions, workflows |
| MindMap | Concept brainstorming, topic classification |
| Hierarchy | Organizational structure, system decomposition |
| Relationship | Dependencies, interactions |
| Comparison | Two or more schemes/viewpoints |
| Timeline | Event progression, project milestones |
| Matrix | 2D classification, prioritization |
| Freeform | Scattered content, inspiration |

---

## Format Specification

**Output must match this exact structure:**

```markdown
---
excalidraw-plugin: parsed
tags: [excalidraw]
---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==

# Excalidraw Data

## Text Elements
Label Text ^KAB8XpXk

%%
## Drawing
\`\`\`compressed-json
{compressed-base64-data}
\`\`\`
%%
```

**File naming:** `[theme].[type].md` (e.g., `business-model.relationship.md`)

**CRITICAL - Never Generate:**
- The only sections allowed are: Frontmatter, warning line, `# Excalidraw Data`, `## Text Elements`, and `%% ## Drawing %%` block

---

## Key Requirements

### ID Format (Critical)
- All IDs must be **exactly 8 random alphanumeric characters**
- Text Elements: `^KAB8XpXk` (never `^title`, `^header`)
- JSON Elements: `"id": "aB3dE7xK"` (never `"id": "title"`)

### Validation (Required)

**Check for issues:**
```bash
uv run {skill_path}/scripts/excalidraw-validator.py --check <file.md>
```

**Fix issues automatically:**
```bash
uv run {skill_path}/scripts/excalidraw-validator.py --fix <file.md>
```

**Compress JSON blocks:**
```bash
uv run {skill_path}/scripts/excalidraw-compressor.py <file.md>
```

**Workflow:**
1. After generating the diagram, run `--check` to validate
2. If issues are found, run `--fix` to auto-correct
3. Run `--check` again to confirm all issues are resolved
4. Run the compressor to convert JSON blocks to compressed-json format (reduces file size by ~60-70%)

**What the validator checks/fixes:**
- Text Element IDs must be exactly 8 alphanumeric characters (`^XXXXXXXX`)
- JSON element IDs must be exactly 8 alphanumeric characters
- All `link` fields must be `null`
- No `## Element Links` section allowed
- Validates `boundElements`, `containerId`, `startBinding`, `endBinding` references
- Supports both `json` and `compressed-json` block formats

### Text & Typography
- **Font:** `fontFamily: 5` (Excalifont)
- **Sizes:** Title 20-28px, Body 16-18px, Minimum 14px
- **Line height:** `1.25`
- **Text width:** `estimatedWidth = text.length * fontSize * 0.5` (CJK: `* 1.0`)
- **Replace:** `"` → `『』`, `()` → `「」`

### Center Alignment
- **Shape center:** `shapeCenterX = shape.x + shape.width / 2`
- **Text X:** `text.x = shapeCenterX - estimatedTextWidth / 2`

### Canvas
- **Range:** 0-1200 x 0-800 (recommended)
- **Padding:** 50-80px from edges
- **Element spacing:** Minimum 20-30px

---

## Color Palette

### Text Colors
| Purpose | Hex |
|---------|-----|
| Title | `#1e40af` |
| Subtitle/lines | `#3b82f6` |
| Body | `#374151` (min `#757575`) |
| Emphasis | `#f59e0b` |

### Shape Fill Colors
| Color | Hex | Use |
|-------|-----|-----|
| Blue | `#a5d8ff` | Input, data, main node |
| Green | `#b2f2bb` | Success, output |
| Orange | `#ffd8a8` | Warning, pending |
| Purple | `#d0bfff` | Processing |
| Red | `#ffc9c9` | Error, critical |
| Yellow | `#fff3bf` | Note, decision |
| Cyan | `#c3fae8` | Storage, cache |
| Pink | `#eebefa` | Analysis, metrics |

---

## Style Characteristics

### Sketch Card
- Rounded rectangles (`roundness: {type: 3}`)
- Solid fills, card-like grouping
- Minimal arrows, focus on containment

### MindMap
- Central topic (ellipse/large rounded rect)
- Radiating branches with arrows
- Color-coded branches per topic

### FlowChart
- Standard shapes (rect, diamond, ellipse)
- Directional arrows with labels
- Diamonds for decisions (Yes/No branches)
- Semantic colors (green=success, red=error)

### AI Selection Guidelines

| Content Type | Recommend |
|--------------|-----------|
| Concept/definition | Sketch Card, MindMap, Comparison |
| Process/procedure | FlowChart, Timeline, Sequence |
| Brainstorming | MindMap, Freeform, Relationship |
| System/architecture | Hierarchy, Relationship, Matrix |
| Data/analytical | Matrix, Comparison, Timeline |

---

## JSON Quick Reference

### Root Structure
```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/2.21.0",
  "elements": [...],
  "appState": {...},
  "files": {}
}
```

### Shape Element (Required Fields)
```json
{
  "id": "aB3dE7xK",
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
  "roundness": {"type": 3},
  "seed": 123456789,
  "version": 1,
  "versionNonce": 987654321,
  "updated": 1773851292315,
  "isDeleted": false,
  "groupIds": [],
  "boundElements": [],
  "link": null,
  "locked": false,
  "frameId": null,
  "hasTextLink": false,
  "index": "aW"
}
```

**Note:** Always set `"link": null`, `"frameId": null`, `"hasTextLink": false` - never create element hyperlinks or inter-element link references.

### Text Element (Additional Fields)
```json
{
  "text": "Display text",
  "fontSize": 20,
  "fontFamily": 5,
  "textAlign": "center",
  "verticalAlign": "middle",
  "containerId": "shape-id-or-null",
  "originalText": "Display text",
  "rawText": "Display text",
  "lineHeight": 1.25,
  "autoResize": true
}
```

### Arrow Element (Additional Fields)
```json
{
  "points": [[0, 0], [50, -25]],
  "elbowed": false,
  "startBinding": {"elementId": "source-id", "mode": "orbit", "fixedPoint": [0.5001, 0.5001]},
  "endBinding": {"elementId": "target-id", "mode": "orbit", "fixedPoint": [0, 0.5001]},
  "startArrowhead": null,
  "endArrowhead": "triangle",
  "moveMidPointsWithElement": false
}
```

### strokeStyle Values
- `"solid"` - Default
- `"dashed"` - Optional paths, async flows
- `"dotted"` - Weak associations

---

## Shape Sizing

| Node Type | Width | Height | Use |
|-----------|-------|--------|-----|
| Small | 100-120px | 36px | Simple labels |
| Medium | 160-180px | 50-57px | Headers, categories |
| Large | 280-320px | 36-40px | Long titles |
| Ellipse (main) | 280-300px | 80-90px | Central topic |

**Shape width:** `text.length * fontSize * 0.5 + 40` (minimum 120px)

---

## Mindmap Spacing

| Spacing | Value |
|---------|-------|
| Parent → child gap | 50-90px |
| Arrow length | 45-133px |
| Sibling vertical gap | 30-70px |
| Root from left edge | 470-500px |
| Level 1 from parent | 300-400px right |

---

## Validation Checklist

- [ ] Frontmatter: `excalidraw-plugin: parsed`, `tags: [excalidraw]`
- [ ] Warning message after frontmatter
- [ ] Text Elements IDs: `^XXXXXXXX` (8 alphanumeric)
- [ ] JSON element IDs: 8 alphanumeric characters
- [ ] JSON wrapped in `%%` and triple backticks
- [ ] All elements have required fields
- [ ] Text uses `fontFamily: 5`, min 16px
- [ ] `files: {}` present
- [ ] Validator `--check` passes (run `--fix` if needed, then re-check)
- [ ] Compressor run successfully (JSON blocks converted to `compressed-json`)

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Text not centered | `estimatedWidth = text.length * fontSize * 0.5` (CJK: `* 1.0`), `shapeCenterX = shape.x + shape.width / 2`, `text.x = shapeCenterX - estimatedTextWidth / 2` |
| Element overlap | Check 20px+ spacing |
| Canvas edge touch | Leave 50-80px padding |
| Low contrast text | Use `#374151` or darker |
| Font < 14px | Minimum 16px body, 14px notes |
| Meaningful IDs | Use random 8-char IDs |

---

## References

- **Full schemas:** [references/excalidraw-schema.md](references/excalidraw-schema.md)
- **Example output:** [references/mindmap-example.md](references/mindmap-example.md)
- **Validator script:** `{skill_path}/scripts/excalidraw-validator.py`
- **Compressor script:** `{skill_path}/scripts/excalidraw-compressor.py`
