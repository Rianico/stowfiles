/**
 * Tools Viewer — list all tools and their descriptions, grouped by extension.
 *
 * Usage: type `/tools` to open a scrollable window.
 *
 * Keys:
 *   ↑ / ↓            scroll by line
 *   Ctrl-F / Ctrl-B  scroll by page
 *   Ctrl-D / Ctrl-U  scroll by half page
 *   Home / End       jump to top / bottom
 *   Esc (or Ctrl-C)  close the window
 *
 * Note: while the window is open, the `tui.altScreen.*` scroll keybindings
 * (Ctrl-F/B/D/U, Home/End in fullscreen mode) are temporarily suspended so
 * those keys scroll this window instead of the transcript behind it. They are
 * restored when the window closes.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	Theme,
	ToolInfo,
} from "@earendil-works/pi-coding-agent";
import {
	Key,
	matchesKey,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
	type TUI,
} from "@earendil-works/pi-tui";

interface ToolGroup {
	key: string;
	label: string;
	tools: ToolInfo[];
}

const GENERIC_BUILD_DIRS = new Set(["src", "dist", "lib", "build", "out"]);

const PKG_NAME_CACHE = new Map<string, string | undefined>();

/** Read the `name` field of `dir/package.json` (memoized; undefined when absent). */
function packageNameAt(dir: string): string | undefined {
	const cached = PKG_NAME_CACHE.get(dir);
	if (cached !== undefined) return cached;
	let name: string | undefined;
	try {
		const pkgPath = join(dir, "package.json");
		if (existsSync(pkgPath)) {
			const parsed = JSON.parse(readFileSync(pkgPath, "utf8")) as {
				name?: unknown;
			};
			if (typeof parsed.name === "string" && parsed.name.length > 0) {
				name = parsed.name;
			}
		}
	} catch {
		name = undefined;
	}
	PKG_NAME_CACHE.set(dir, name);
	return name;
}

/**
 * Human-readable extension name from a tool's source info:
 * - npm packages (path under node_modules) → package spec (`@scope/pkg` or `pkg`)
 * - directory extensions → package.json `name`, else the directory name
 * - single-file extensions → file name without extension
 */
export function extensionLabel(sourceInfo: ToolInfo["sourceInfo"]): string {
	const path = sourceInfo.path.replaceAll("\\", "/");

	// npm-installed pi packages: <root>/node_modules/<pkg>/... or .../@scope/<pkg>/...
	const nmMarker = "/node_modules/";
	const nmIdx = path.lastIndexOf(nmMarker);
	if (nmIdx !== -1) {
		const segs = path.slice(nmIdx + nmMarker.length).split("/");
		if (segs[0]?.startsWith("@")) {
			return segs.length > 1 ? `${segs[0]}/${segs[1]}` : segs[0];
		}
		if (segs[0]) return segs[0];
	}

	// Local directory extensions: prefer the package.json name.
	if (sourceInfo.baseDir) {
		const pkgName = packageNameAt(sourceInfo.baseDir);
		if (pkgName) return pkgName;
	}

	// Fallback: derive from the file path.
	const parts = path.split("/");
	const base = parts.pop() ?? path;
	if (base === "index.ts" || base === "index.js") {
		const parent = parts.pop() ?? "";
		if (GENERIC_BUILD_DIRS.has(parent)) {
			return parts[parts.length - 1] ?? parent;
		}
		return parent || base;
	}
	return base.replace(/\.(mts|cts|mjs|cjs|ts|js)$/, "");
}

function groupRank(key: string): number {
	if (key === "builtin") return 0;
	if (key === "sdk") return 1;
	return 2;
}

/**
 * Resolve a tool's group key (identity) and display label from its source.
 * Tools from the same npm package share one group.
 */
function groupKeyAndLabel(sourceInfo: ToolInfo["sourceInfo"]): {
	key: string;
	label: string;
} {
	if (sourceInfo.source === "builtin")
		return { key: "builtin", label: "builtin" };
	if (sourceInfo.source === "sdk") return { key: "sdk", label: "sdk" };
	const label = extensionLabel(sourceInfo);
	const normalized = sourceInfo.path.replaceAll("\\", "/");
	const key = normalized.includes("/node_modules/")
		? `pkg:${label}`
		: sourceInfo.path;
	return { key, label };
}

/** Group tools by the extension that provides them. */
export function groupTools(tools: ToolInfo[]): ToolGroup[] {
	const groups = new Map<string, ToolGroup>();
	for (const tool of tools) {
		const { key, label } = groupKeyAndLabel(tool.sourceInfo);

		let group = groups.get(key);
		if (!group) {
			group = { key, label, tools: [] };
			groups.set(key, group);
		}
		group.tools.push(tool);
	}

	const result = [...groups.values()];
	for (const group of result) {
		group.tools.sort((a, b) => a.name.localeCompare(b.name));
	}
	result.sort(
		(a, b) =>
			groupRank(a.key) - groupRank(b.key) || a.label.localeCompare(b.label),
	);
	return result;
}

/** Build the full (unscrolled) list of styled lines. */
export function buildLines(groups: ToolGroup[], theme: Theme): string[] {
	const lines: string[] = [];
	for (const group of groups) {
		lines.push(theme.fg("accent", `[${group.label}]`));
		if (group.tools.length === 0) {
			lines.push(theme.fg("dim", "- (no tools)"));
		}
		for (const tool of group.tools) {
			const name = theme.bold(tool.name);
			const desc = tool.description
				? `: ${theme.fg("dim", tool.description)}`
				: "";
			lines.push(`- ${name}${desc}`);
		}
		lines.push("");
	}
	// Drop the trailing blank line(s)
	while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
	return lines;
}

/**
 * Alt-screen scroll keybindings. Suspended while the window is open so their
 * keys (Ctrl-F/B/D/U, Home/End in fullscreen mode) scroll this window instead
 * of the transcript behind the overlay.
 */
const ALT_SCREEN_SCROLL_KEYS = [
	"tui.altScreen.pageUp",
	"tui.altScreen.pageDown",
	"tui.altScreen.halfPageUp",
	"tui.altScreen.halfPageDown",
	"tui.altScreen.top",
	"tui.altScreen.bottom",
] as const;

/** Continuation-line indent for wrapped tool entries. */
const HANGING_INDENT = 2;

/** Scrollable window rendering `lines` inside a bordered overlay. */
export class ToolsViewer {
	private readonly lines: string[];
	private readonly totalTools: number;
	private readonly tui: TUI;
	private readonly theme: Theme;
	private readonly done: (result: undefined) => void;
	private scroll = 0;
	private pageSize: number;
	/** Optional cleanup invoked when the component is disposed. */
	onDispose?: () => void;
	/** Content wrapped to the current window width (rebuilt on resize). */
	private wrapped: string[] = [];
	private wrappedWidth = -1;

	constructor(
		lines: string[],
		totalTools: number,
		tui: TUI,
		theme: Theme,
		done: (result: undefined) => void,
	) {
		this.lines = lines;
		this.totalTools = totalTools;
		this.tui = tui;
		this.theme = theme;
		this.done = done;
		this.pageSize = this.computePageSize();
	}

	private get rows(): number {
		return this.tui.terminal?.rows ?? 24;
	}

	private computePageSize(): number {
		// Leave room for the title row, footer row, and borders.
		return Math.max(4, Math.floor(this.rows * 0.85) - 4);
	}

	private get maxScroll(): number {
		const total =
			this.wrapped.length > 0 ? this.wrapped.length : this.lines.length;
		return Math.max(0, total - this.pageSize);
	}

	/**
	 * Wrap the content lines to the given inner width, caching per width.
	 * Continuation lines are indented so wrapped descriptions align under
	 * the `- ` bullet.
	 */
	private wrapForWidth(innerWidth: number): string[] {
		if (this.wrappedWidth === innerWidth) return this.wrapped;
		this.wrappedWidth = innerWidth;
		this.wrapped = this.lines.flatMap((line) => {
			if (line === "") return [""];
			const wrapWidth = Math.max(4, innerWidth - HANGING_INDENT);
			const segments = wrapTextWithAnsi(line, wrapWidth);
			return segments.map((segment, i) =>
				i === 0 ? segment : " ".repeat(HANGING_INDENT) + segment,
			);
		});
		return this.wrapped;
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
			this.done(undefined);
			return;
		}

		const page = Math.max(1, this.pageSize);
		const half = Math.max(1, Math.floor(page / 2));

		if (matchesKey(data, Key.up)) {
			this.scroll = Math.max(0, this.scroll - 1);
		} else if (matchesKey(data, Key.down)) {
			this.scroll = Math.min(this.maxScroll, this.scroll + 1);
		} else if (matchesKey(data, Key.ctrl("f"))) {
			this.scroll = Math.min(this.maxScroll, this.scroll + page);
		} else if (matchesKey(data, Key.ctrl("b"))) {
			this.scroll = Math.max(0, this.scroll - page);
		} else if (matchesKey(data, Key.ctrl("d"))) {
			this.scroll = Math.min(this.maxScroll, this.scroll + half);
		} else if (matchesKey(data, Key.ctrl("u"))) {
			this.scroll = Math.max(0, this.scroll - half);
		} else if (matchesKey(data, Key.home)) {
			this.scroll = 0;
		} else if (matchesKey(data, Key.end)) {
			this.scroll = this.maxScroll;
		} else {
			return;
		}
	}

	invalidate(): void {
		// render() recomputes the viewport each time; nothing to clear.
	}

	dispose(): void {
		this.onDispose?.();
	}

	render(width: number): string[] {
		// Recompute on every render so terminal resizes are picked up.
		this.pageSize = this.computePageSize();

		const th = this.theme;
		const innerW = Math.max(8, width - 2);
		const pad = (s: string) => truncateToWidth(s, innerW, "…", true);
		const row = (content: string) =>
			th.fg("border", "│") + pad(content) + th.fg("border", "│");

		const out: string[] = [];

		// Title embedded in the top border
		const title = ` Tools (${this.totalTools}) `;
		const dashCount = Math.max(1, innerW - visibleWidth(title));
		out.push(
			th.fg("border", "╭") +
				th.fg("accent", th.bold(title)) +
				th.fg("border", "─".repeat(dashCount) + "╮"),
		);

		// Visible slice of the wrapped content
		const wrapped = this.wrapForWidth(innerW);
		const total = wrapped.length;
		const maxScroll = Math.max(0, total - this.pageSize);
		// Clamp after wrapping: a resize changes the wrapped row count.
		if (this.scroll > maxScroll) this.scroll = maxScroll;
		const end = Math.min(total, this.scroll + this.pageSize);
		for (let i = this.scroll; i < end; i++) {
			out.push(row(wrapped[i]!));
		}
		// Pad with blank rows so the window height stays stable while scrolling
		for (let i = end - this.scroll; i < this.pageSize; i++) {
			out.push(row(""));
		}

		// Footer: scroll position + key hints
		const scrollInfo =
			total === 0
				? "no tools"
				: `${this.scroll + 1}–${Math.min(total, this.scroll + this.pageSize)}/${total}`;
		const footer = th.fg(
			"dim",
			`${scrollInfo}   ↑↓ line · ^F/^B page · ^D/^U half · Esc close`,
		);
		out.push(row(footer));

		// Bottom border
		out.push(th.fg("border", `╰${"─".repeat(innerW)}╯`));

		return out;
	}
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("tools", {
		description: "List all tools and descriptions, grouped by extension",
		handler: async (_args: string, ctx: ExtensionCommandContext) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("/tools requires TUI mode", "error");
				return;
			}

			const groups = groupTools(pi.getAllTools());
			const totalTools = groups.reduce((n, g) => n + g.tools.length, 0);

			await ctx.ui.custom<undefined>(
				(tui, theme, keybindings, done) => {
					// Suspend alt-screen scroll keybindings while the window is open
					// so Ctrl-F/B/D/U and Home/End reach this component instead of
					// scrolling the transcript behind the overlay.
					const originalBindings = keybindings.getUserBindings();
					const suspendedBindings = { ...originalBindings };
					for (const id of ALT_SCREEN_SCROLL_KEYS) {
						suspendedBindings[id] = [];
					}
					const restoreBindings = () =>
						keybindings.setUserBindings(originalBindings);
					keybindings.setUserBindings(suspendedBindings);

					try {
						const lines = buildLines(groups, theme);
						const viewer = new ToolsViewer(
							lines,
							totalTools,
							tui,
							theme,
							() => {
								restoreBindings();
								done(undefined);
							},
						);
						// Safety net: dispose runs after done() in the close flow;
						// restoring again is harmless.
						viewer.onDispose = restoreBindings;
						return viewer;
					} catch (err) {
						restoreBindings();
						throw err;
					}
				},
				{
					overlay: true,
					overlayOptions: {
						anchor: "center",
						width: "92%",
						maxHeight: "85%",
						margin: 1,
					},
				},
			);
		},
	});
}
