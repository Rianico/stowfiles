/**
 * Model Info Border — a theme extension for pi
 *
 * Embeds the active model (provider/id) and its thinking level into the
 * TOP-LEFT of the input editor's border, and colors the border with a
 * "glow" whose intensity scales with the thinking level: the higher the
 * level, the brighter/hotter the border becomes.
 *
 *   ── anthropic/deepseek-v4-flash · high · 128k ─────────────────
 *   │ > type here...                                            │
 *
 * The glow is derived from the theme's per-level thinking colors
 * (`thinkingOff` … `thinkingMax`) and blended toward white by level, so it
 * stays theme-native and follows live theme changes (the theme is read at
 * render time via the live `ctx.ui.theme` getter — no caching).
 *
 * Behavior:
 *   - Model label uses the model ID (`deepseek-v4-flash`), not the display
 *     name (`DeepSeek V4 Flash (2x usage)`), and contains no emoji.
 *   - Context window size shown after the thinking level (`· 128k`).
 *   - Border glow: off < minimal < low < medium < high < xhigh < max.
 *   - Updates live on /model, Ctrl+P cycling, and thinking-level changes.
 *   - `/model-info` toggles the label + glow on/off (falls back to pi's
 *     stock thinking-colored border when off).
 *
 * Install: drop this directory at ~/.pi/agent/extensions/ and run /reload.
 */

import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type KeybindingsManager,
	type Theme,
	type ThemeColor,
} from "@earendil-works/pi-coding-agent";
import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import {
	truncateToWidth,
	visibleWidth,
	type EditorTheme,
	type TUI,
} from "@earendil-works/pi-tui";

// ---------------------------------------------------------------------------
// Thinking level → intensity mapping
// ---------------------------------------------------------------------------

const LEVEL_INDEX: Record<ModelThinkingLevel, number> = {
	off: 0,
	minimal: 1,
	low: 2,
	medium: 3,
	high: 4,
	xhigh: 5,
	max: 6,
};

const THINKING_COLORS: Record<ModelThinkingLevel, ThemeColor> = {
	off: "thinkingOff",
	minimal: "thinkingMinimal",
	low: "thinkingLow",
	medium: "thinkingMedium",
	high: "thinkingHigh",
	xhigh: "thinkingXhigh",
	max: "thinkingMax",
};

/** How much the glow brightens toward white at the top level (0..1). */
const GLOW_FACTOR = 0.55;

/** Space padding around the label inside the border (each side). */
const LABEL_PAD = 1;
// ---------------------------------------------------------------------------
// Color helpers: theme ANSI → RGB → boosted glow ANSI
// ---------------------------------------------------------------------------

function stripAnsi(s: string): string {
	return s.replace(/\x1b\[[0-9;]*m/g, "");
}

const BASIC16: Array<[number, number, number]> = [
	[0, 0, 0],
	[128, 0, 0],
	[0, 128, 0],
	[128, 128, 0],
	[0, 0, 128],
	[128, 0, 128],
	[0, 128, 128],
	[192, 192, 192],
	[128, 128, 128],
	[255, 0, 0],
	[0, 255, 0],
	[255, 255, 0],
	[0, 0, 255],
	[255, 0, 255],
	[0, 255, 255],
	[255, 255, 255],
];
const CUBE_VALUES = [0, 95, 135, 175, 215, 255];
const GRAY_VALUES = Array.from({ length: 24 }, (_, i) => 8 + i * 10);

function indexToRgb(n: number): { r: number; g: number; b: number } | null {
	if (n >= 0 && n < 16) {
		const [r, g, b] = BASIC16[n] ?? [0, 0, 0];
		return { r, g, b };
	}
	if (n >= 16 && n <= 231) {
		const v = n - 16;
		return {
			r: CUBE_VALUES[Math.floor(v / 36)] ?? 0,
			g: CUBE_VALUES[Math.floor(v / 6) % 6] ?? 0,
			b: CUBE_VALUES[v % 6] ?? 0,
		};
	}
	if (n >= 232 && n <= 255) {
		const gray = 8 + (n - 232) * 10;
		return { r: gray, g: gray, b: gray };
	}
	return null;
}

/** Parse a Theme.getFgAnsi() escape back into RGB. */
function parseFgAnsiToRgb(
	theme: Theme,
	color: ThemeColor,
): { r: number; g: number; b: number } | null {
	const ansi = theme.getFgAnsi(color);
	const trueColor = ansi.match(/38;2;(\d+);(\d+);(\d+)/);
	if (trueColor)
		return {
			r: Number(trueColor[1]),
			g: Number(trueColor[2]),
			b: Number(trueColor[3]),
		};
	const palette = ansi.match(/38;5;(\d+)/);
	if (palette) return indexToRgb(Number(palette[1]));
	return null;
}

function findClosestCubeIndex(value: number): number {
	let minDist = Infinity;
	let minIdx = 0;
	for (let i = 0; i < CUBE_VALUES.length; i++) {
		const dist = Math.abs(value - (CUBE_VALUES[i] ?? 0));
		if (dist < minDist) {
			minDist = dist;
			minIdx = i;
		}
	}
	return minIdx;
}

function findClosestGrayIndex(gray: number): number {
	let minDist = Infinity;
	let minIdx = 0;
	for (let i = 0; i < GRAY_VALUES.length; i++) {
		const dist = Math.abs(gray - (GRAY_VALUES[i] ?? 0));
		if (dist < minDist) {
			minDist = dist;
			minIdx = i;
		}
	}
	return minIdx;
}

function colorDistance(
	r1: number,
	g1: number,
	b1: number,
	r2: number,
	g2: number,
	b2: number,
): number {
	const dr = r1 - r2;
	const dg = g1 - g2;
	const db = b1 - b2;
	return dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
}

/** Quantize an RGB value to the closest xterm-256 index (same as the theme loader). */
function rgbTo256(r: number, g: number, b: number): number {
	const rIdx = findClosestCubeIndex(r);
	const gIdx = findClosestCubeIndex(g);
	const bIdx = findClosestCubeIndex(b);
	const cubeR = CUBE_VALUES[rIdx] ?? 0;
	const cubeG = CUBE_VALUES[gIdx] ?? 0;
	const cubeB = CUBE_VALUES[bIdx] ?? 0;
	const cubeIndex = 16 + 36 * rIdx + 6 * gIdx + bIdx;
	const cubeDist = colorDistance(r, g, b, cubeR, cubeG, cubeB);
	const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
	const grayIdx = findClosestGrayIndex(gray);
	const grayValue = GRAY_VALUES[grayIdx] ?? 0;
	const grayIndex = 232 + grayIdx;
	const grayDist = colorDistance(r, g, b, grayValue, grayValue, grayValue);
	const maxC = Math.max(r, g, b);
	const minC = Math.min(r, g, b);
	const spread = maxC - minC;
	if (spread < 10 && grayDist < cubeDist) return grayIndex;
	return cubeIndex;
}

/**
 * Build a border color function for a thinking level: takes the theme's
 * per-level color and brightens it toward white proportionally to the level,
 * so higher levels "glow" more intensely.
 */
function buildGlow(
	theme: Theme,
	level: ModelThinkingLevel,
): (s: string) => string {
	const base = parseFgAnsiToRgb(theme, THINKING_COLORS[level]) ?? {
		r: 140,
		g: 140,
		b: 140,
	};
	const t = (LEVEL_INDEX[level] / 6) * GLOW_FACTOR;
	const r = Math.round(base.r + (255 - base.r) * t);
	const g = Math.round(base.g + (255 - base.g) * t);
	const b = Math.round(base.b + (255 - base.b) * t);
	const ansi =
		theme.getColorMode() === "truecolor"
			? `\x1b[38;2;${r};${g};${b}m`
			: `\x1b[38;5;${rgbTo256(r, g, b)}m`;
	return (s: string) => `${ansi}${s}\x1b[39m`;
}

// ---------------------------------------------------------------------------
// Label
// ---------------------------------------------------------------------------

/** Format a context window size in tokens as a compact string (e.g. 128k, 32.8k, 2m). */
function formatContextWindow(tokens: number): string {
	if (!Number.isFinite(tokens) || tokens <= 0) return "";
	if (tokens >= 1_000_000) {
		const m = tokens / 1_000_000;
		return `${Number.isInteger(m) ? m : m.toFixed(1)}m`;
	}
	const k = tokens / 1000;
	return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

function buildLabel(
	theme: Theme,
	provider: string,
	modelId: string,
	level: ModelThinkingLevel,
	contextWindow: number,
): string {
	const providerPart = provider !== "" ? theme.fg("dim", `${provider}/`) : "";
	const modelPart = theme.fg(
		"accent",
		theme.bold(modelId !== "" ? modelId : "unknown"),
	);
	const levelPart = theme.getThinkingBorderColor(level)(level);
	const ctxText =
		formatContextWindow(contextWindow) !== ""
			? `${theme.fg("dim", " · ")}${theme.fg("muted", formatContextWindow(contextWindow))}`
			: "";
	return `${providerPart}${modelPart}${theme.fg("dim", " · ")}${levelPart}${ctxText}`;
}

// ---------------------------------------------------------------------------
// Border detection & label embedding
// ---------------------------------------------------------------------------

/** Plain border line: entirely ─. */
function isPlainBorder(line: string): boolean {
	return /^─+$/.test(stripAnsi(line));
}

/** Scroll-indicator border: `─── ↑ 5 more ─────…` (created by pi's Editor). */
function isScrollBorder(line: string): boolean {
	return /^─── [↑↓] \d+ more/.test(stripAnsi(line));
}

/** Replace the left part of a plain top border with the label. */
function embedLabel(
	width: number,
	label: string,
	glow: (s: string) => string,
): string {
	// Padding collapses gracefully on very narrow terminals.
	const padCount = Math.min(LABEL_PAD, Math.max(0, Math.floor((width - 1) / 2)));
	const padding = padCount * 2;
	// Reserve at least one border char on each side.
	const labelText = truncateToWidth(label, Math.max(0, width - 2 - padding), "");
	const lw = visibleWidth(labelText);
	const leftWidth = Math.max(0, Math.min(2, width - lw - padding));
	const rightWidth = Math.max(0, width - lw - leftWidth - padding);
	const pad = " ".repeat(padCount);
	return glow("─".repeat(leftWidth)) + pad + labelText + pad + glow("─".repeat(rightWidth));
}

// ---------------------------------------------------------------------------
// Custom editor
// ---------------------------------------------------------------------------

class ModelInfoEditor extends CustomEditor {
	private provider = "";
	private modelId = "";
	private level: ModelThinkingLevel = "off";
	private contextWindow = 0;
	private glowEnabled = true;
	private readonly getLiveTheme: () => Theme;

	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		getLiveTheme: () => Theme,
	) {
		super(tui, theme, keybindings);
		this.getLiveTheme = getLiveTheme;
	}

	setInfo(
		provider: string,
		modelId: string,
		level: ModelThinkingLevel,
		contextWindow: number,
	): void {
		this.provider = provider;
		this.modelId = modelId;
		this.level = level;
		this.contextWindow = contextWindow;
		this.tui.requestRender();
	}

	setGlowEnabled(enabled: boolean): void {
		this.glowEnabled = enabled;
		this.tui.requestRender();
	}

	override render(width: number): string[] {
		const lines = super.render(width);
		if (!this.glowEnabled || lines.length === 0) return lines;

		// Read the live theme every frame so theme swaps apply immediately.
		const theme = this.getLiveTheme();
		const glow = buildGlow(theme, this.level);
		const label = buildLabel(theme, this.provider, this.modelId, this.level, this.contextWindow);

		// Top border (always lines[0]): embed the label into plain borders,
		// keep scroll indicators but recolor them.
		const top = lines[0];
		lines[0] = isScrollBorder(top)
			? glow(stripAnsi(top))
			: embedLabel(width, label, glow);

		// Bottom border: the last border-like line (autocomplete lines may follow).
		for (let i = lines.length - 1; i >= 0; i--) {
			const line = lines[i];
			if (isPlainBorder(line) || isScrollBorder(line)) {
				lines[i] = glow(stripAnsi(line));
				break;
			}
		}

		return lines;
	}
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI): void {
	let editor: ModelInfoEditor | null = null;
	let glowEnabled = true;

	function applyInfo(ctx: ExtensionContext): void {
		if (!editor) return;
		const provider = ctx.model?.provider ?? "";
		const modelId = ctx.model?.id ?? "unknown";
		const level = ctx.thinkingLevel ?? "off";
		const contextWindow = ctx.model?.contextWindow ?? 0;
		editor.setInfo(provider, modelId, level, contextWindow);
	}

	// Install the custom editor at startup / resume / reload. The factory runs
	// immediately; ctx.ui.theme is a live getter, so the editor always reads
	// the current theme at render time.
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		const getLiveTheme = (): Theme => ctx.ui.theme;
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			editor = new ModelInfoEditor(tui, theme, keybindings, getLiveTheme);
			editor.setGlowEnabled(glowEnabled);
			return editor;
		});
		applyInfo(ctx);
	});

	// Model changed via /model, Ctrl+P cycling, or session restore.
	pi.on("model_select", (_event, ctx) => {
		if (!ctx.hasUI) return;
		applyInfo(ctx);
	});

	// Thinking level changed (settings, keybinding, model clamping).
	pi.on("thinking_level_select", (_event, ctx) => {
		if (!ctx.hasUI) return;
		applyInfo(ctx);
	});

	// Toggle the label + glow on/off (off restores pi's stock border).
	pi.registerCommand("model-info", {
		description: "Toggle the model label + glow on the input border",
		handler: async (_args, ctx) => {
			glowEnabled = !glowEnabled;
			editor?.setGlowEnabled(glowEnabled);
			ctx.ui.notify(
				`Model info border ${glowEnabled ? "shown" : "hidden"}`,
				"info",
			);
		},
	});
}
