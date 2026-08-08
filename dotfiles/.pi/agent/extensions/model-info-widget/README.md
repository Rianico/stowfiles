# Model Info Border

A theme extension for [pi](https://github.com/earendil-works/pi-coding-agent) that
embeds the active **model** (provider/id) and its **thinking level** into the
**top-left of the input editor's border**, and colors the border with a "glow"
whose intensity scales with the thinking level — the higher the level, the
brighter/hotter the border becomes.

```text
── anthropic/deepseek-v4-flash · high · 128k ───────────────────
│ > type here...                                            │
└────────────────────────────────────────────────────────────┘
```

## Features

- **Model id, not display name** — shows `deepseek-v4-flash`, not
  `DeepSeek V4 Flash (2x usage)`. No emoji anywhere.
- **Padded label** — one space of padding on each side of the label, so it
  doesn't touch the border dashes (`── label ──`); padding collapses
  gracefully on very narrow terminals.
- **Context window** — the model's `contextWindow` shown compactly after the
  thinking level (`· 128k`, `· 32.8k`, `· 1m`), omitted when unknown.
- **Thinking-level glow** — the border color is derived from the theme's
  per-level thinking colors (`thinkingOff` … `thinkingMax`) and blended toward
  white proportionally to the level:

  `off < minimal < low < medium < high < xhigh < max` (brightness)

  `off` is the dimmest, `max` the most intense.
- **Live updates** — refreshes on `/model`, `Ctrl+P` model cycling, and any
  thinking-level change.
- **Theme-native & theme-live** — colors come from the active theme via the
  live `ctx.ui.theme` getter, read at render time (no caching), so `/theme`
  swaps apply immediately, in truecolor or 256-color mode.
- **Scroll-safe** — when the editor scrolls, the label yields to pi's scroll
  indicator and the border keeps its glow.
- **Toggleable** — `/model-info` shows/hides the label + glow (off restores
  pi's stock thinking-colored border).

## Install

```bash
cp -r model-info-widget ~/.pi/agent/extensions/
```

Then run `/reload` inside pi (or restart pi).

## Usage

| Action | Result |
| ------ | ------ |
| `/model` / `Ctrl+P` | label + glow update to the new model |
| change thinking level | border glow intensity updates |
| `/theme` | glow recolors instantly (truecolor + 256-color) |
| `/model-info` | toggle the label + glow on/off |

## How it works

- `session_start` installs a `CustomEditor` subclass via
  `ctx.ui.setEditorComponent()`. The factory closes over `ctx`, and the
  editor reads `ctx.ui.theme` (a live getter) on every `render()` — so it
  always styles with the current theme.
- `model_select` and `thinking_level_select` events push `provider`, `model.id`
  and the level into the editor and request a re-render.
- `render()` re-stamps the editor's top/bottom border lines:
  - top border: label embedded at the left
    (`provider/model · level · contextWindow`);
  - border characters colored with `buildGlow()` — the theme's per-level
    thinking color parsed back to RGB and brightened toward white by
    `levelIndex / 6 × 0.55`;
  - scroll-indicator borders (`─── ↑ N more …`) are recolored but keep the
    indicator text.
- The label is clamped with `truncateToWidth()` so it never overflows the
  terminal width.
