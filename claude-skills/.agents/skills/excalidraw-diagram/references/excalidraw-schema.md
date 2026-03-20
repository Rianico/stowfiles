# Excalidraw JSON Schema Reference

Complete reference for Excalidraw elements in Obsidian format.

---

## Color Palette

### Text Colors
| Purpose | Hex | Description |
|---------|-----|-------------|
| Title | `#1e40af` | Dark blue |
| Subtitle/lines | `#3b82f6` | Medium blue |
| Body | `#374151` | Dark gray (min `#757575`) |
| Emphasis | `#f59e0b` | Orange |
| Success | `#10b981` | Green |
| Warning | `#ef4444` | Red |

### Shape Fill Colors
| Hex | Semantics | Use |
|-----|-----------|-----|
| `#a5d8ff` | Light blue | Input, data, main node |
| `#b2f2bb` | Light green | Success, output |
| `#ffd8a8` | Light orange | Warning, pending |
| `#d0bfff` | Light purple | Processing |
| `#ffc9c9` | Light red | Error, critical |
| `#fff3bf` | Light yellow | Note, decision |
| `#c3fae8` | Light cyan | Storage, cache |
| `#eebefa` | Light pink | Analysis, metrics |

### Area Background Colors (opacity: 30)
| Hex | Layer |
|-----|-------|
| `#dbe4ff` | Frontend/UI |
| `#e5dbff` | Logic/processing |
| `#d3f9d8` | Data/tool |

---

## Element Types

### Rectangle
```json
{
  "id": "aB3dE7xK",
  "type": "rectangle",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 80,
  "angle": 0,
  "strokeColor": "#1e40af",
  "backgroundColor": "#dbeafe",
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
  "boundElements": [{"type": "text", "id": "textId"}],
  "link": null,
  "locked": false,
  "frameId": null,
  "hasTextLink": false,
  "index": "aW"
}
```

### Ellipse
```json
{
  "id": "kL4mN7pQ",
  "type": "ellipse",
  "x": 100,
  "y": 100,
  "width": 120,
  "height": 120,
  "strokeColor": "#10b981",
  "backgroundColor": "#d1fae5",
  "fillStyle": "solid"
}
```

### Diamond
```json
{
  "id": "rT8sU2vW",
  "type": "diamond",
  "x": 100,
  "y": 100,
  "width": 150,
  "height": 100,
  "strokeColor": "#f59e0b",
  "backgroundColor": "#fef3c7",
  "fillStyle": "solid"
}
```

### Text
```json
{
  "id": "mN9pQ2rT",
  "type": "text",
  "x": 150,
  "y": 130,
  "width": 150,
  "height": 25,
  "text": "Content here",
  "fontSize": 20,
  "fontFamily": 5,
  "textAlign": "center",
  "verticalAlign": "middle",
  "strokeColor": "#1e40af",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 1,
  "opacity": 100,
  "roundness": null,
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
  "containerId": "shape-id-or-null",
  "originalText": "Content here",
  "rawText": "Content here",
  "lineHeight": 1.25,
  "autoResize": true,
  "index": "aX"
}
```

### Arrow
```json
{
  "id": "vW5xY8zL",
  "type": "arrow",
  "x": 300,
  "y": 140,
  "width": 100,
  "height": 0,
  "points": [[0, 0], [100, 0]],
  "elbowed": false,
  "lastCommittedPoint": null,
  "startBinding": {
    "elementId": "source-id",
    "mode": "orbit",
    "fixedPoint": [0.5001, 0.5001]
  },
  "endBinding": {
    "elementId": "target-id",
    "mode": "orbit",
    "fixedPoint": [0, 0.5001]
  },
  "startArrowhead": null,
  "endArrowhead": "triangle",
  "strokeColor": "#374151",
  "backgroundColor": "transparent",
  "fillStyle": "hachure",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 1,
  "opacity": 100,
  "roundness": null,
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
  "moveMidPointsWithElement": false,
  "index": "aY"
}
```

### Line
```json
{
  "id": "xY3zA5bC",
  "type": "line",
  "x": 100,
  "y": 100,
  "points": [[0, 0], [200, 100]],
  "strokeColor": "#374151",
  "strokeWidth": 2
}
```

---

## Full JSON Structure

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/2.21.0",
  "elements": [],
  "appState": {
    "theme": "light",
    "viewBackgroundColor": "#d2bab0",
    "currentItemStrokeColor": "#1e1e1e",
    "currentItemBackgroundColor": "transparent",
    "currentItemFillStyle": "solid",
    "currentItemStrokeWidth": 2,
    "currentItemStrokeStyle": "solid",
    "currentItemRoughness": 1,
    "currentItemOpacity": 100,
    "currentItemFontFamily": 1,
    "currentItemFontSize": 20,
    "currentItemTextAlign": "center",
    "currentItemStartArrowhead": null,
    "currentItemEndArrowhead": "arrow",
    "currentItemArrowType": "round",
    "scrollX": 0,
    "scrollY": 0,
    "zoom": {"value": 1},
    "currentItemRoundness": "round",
    "gridSize": 20,
    "gridStep": 5,
    "gridModeEnabled": false,
    "frameRendering": {
      "enabled": true,
      "clip": true,
      "name": true,
      "outline": true,
      "markerName": true,
      "markerEnabled": true
    },
    "objectsSnapModeEnabled": false,
    "bindingPreference": "enabled",
    "isBindingEnabled": true,
    "isMidpointSnappingEnabled": true,
    "activeTool": {
      "type": "selection",
      "customType": null,
      "locked": false,
      "fromSelection": false,
      "lastActiveTool": null
    },
    "disableContextMenu": false
  },
  "files": {}
}
```

---

## Property Reference

### Font Family Values
| Value | Font |
|-------|------|
| 1 | Virgil (hand-drawn) |
| 2 | Helvetica |
| 3 | Cascadia |
| 4 | Assistant |
| 5 | Excalifont (recommended) |

### Fill Styles
- `solid` - Solid fill
- `hachure` - Hatched lines
- `cross-hatch` - Cross-hatched
- `dots` - Dotted pattern

### Roundness Types
- `{ "type": 1 }` - Sharp corners
- `{ "type": 2 }` - Slight rounding
- `{ "type": 3 }` - Full rounding (recommended)

### strokeStyle Values
- `solid` - Solid line (default)
- `dashed` - Dashed line (optional paths, async flows)
- `dotted` - Dotted line (weak associations)

### Arrow Heads
- `null` - No arrowhead
- `triangle` - Triangle arrowhead
- `arrow` - Standard arrow

---

## Element Binding

### Text to Container
```json
{
  "type": "rectangle",
  "id": "dE7fG9hJ",
  "boundElements": [{"id": "kL2mN4pQ", "type": "text"}]
}
```

```json
{
  "type": "text",
  "id": "kL2mN4pQ",
  "containerId": "dE7fG9hJ"
}
```

### Arrow to Shapes
```json
{
  "type": "arrow",
  "startBinding": {
    "elementId": "rS6tU8vW",
    "mode": "orbit",
    "fixedPoint": [0.5001, 0.5001]
  },
  "endBinding": {
    "elementId": "xY1zA3bC",
    "mode": "orbit",
    "fixedPoint": [0, 0.5001]
  }
}
```

---

## Formulas & Calculations

### Text Width Estimation
- Latin: `width = chars * fontSize * 0.5`
- CJK: `width = chars * fontSize * 1.0`

### Center Alignment
- Text width: `estimatedWidth = text.length * fontSize * 0.5` (CJK: `* 1.0`)
- Shape center: `shapeCenterX = shape.x + shape.width / 2`
- Text X: `text.x = shapeCenterX - estimatedWidth`

### Shape Sizing
- Width: `text.length * fontSize * 0.5 + 40` (min 120px)
- Height (single line): 36px minimum
- Height (emphasis): 50-57px
- Add 20px per additional line

### Mindmap Spacing
- Parent → child gap: 50-90px
- Sibling vertical gap: 30-70px
- Root from left: 470-500px
- Level 1 from parent: 300-400px right
