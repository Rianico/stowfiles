/**
 * Model Aliases — by zhengxk
 * ─────────────────────────────
 * Deterministic, user-defined model aliases for pi: `pi --model <alias>` and
 * Agent-tool subagent aliasing, from a single aliases.json source of truth.
 *
 * ═ Attribution ═
 * Renamed from the original author's pattern and built on his excellent work:
 * Mario Zechner (badlogic) — pi (https://github.com/earendil-works/pi), its
 * extension API, and the preset.ts example this grew from. Thank you for the
 * excellent work.
 *
 * ═ Our refinements (vs. the preset.ts pattern it grew from) ═
 * 1. Explicit schema: alias = { provider, model, thinking? } — no hidden fuzzy
 *    semantics inside the map itself.
 * 2. Deterministic resolution: collision-free names validated against the live
 *    catalog at load (an alias must not be a substring of any other model's
 *    id/name/provider-id, nor of another alias) — prevents the silent wrong-
 *    model picks that substring matching otherwise produces.
 * 3. Single source of truth: aliases.json, auto-synced additively into
 *    models.json modelOverrides (never clobbers, never deletes, drift-detected).
 * 4. Two surfaces from one map: pi's built-in --model resolver AND the Agent
 *    tool (pi-subagents) model param, both via the synced `name` field.
 * 5. In-session UX: /alias (list/apply/sync/check) + footer `alias:` indicator.
 * 6. Thinking: `:suffix` on the CLI (`--model orchestrator:high`), alias-default
 *    thinking in-session via /alias.
 *
 * ─────────────────────────────
 * Config: ~/.pi/agent/aliases.json  (global only — models.json is global, so
 * names can only be synced for global aliases)
 *
 *   {
 *     "orchestrator": { "provider": "opencode-go", "model": "grok-4.5" },
 *     "runner":       { "provider": "opencode-go", "model": "deepseek-v4-flash" }
 *   }
 *
 * How it works:
 * - Each alias is synced into ~/.pi/agent/models.json as a `modelOverrides`
 *   `name` entry on the target model, so the built-in --model resolver AND the
 *   Agent tool (pi-subagents) both match the `name` field.
 * - The determinism contract (refinement 2) is validated at load; violations
 *   are reported as warnings/errors.
 * - models.json writes are additive-only: names are added when missing, never
 *   overwritten or removed. Removing an alias leaves its name in place.
 *
 * Commands:
 *   /alias            interactive list; select to apply
 *   /alias <name>     apply alias (setModel + setThinkingLevel)
 *   /alias sync       force-sync names into models.json
 *   /alias check      re-validate aliases against the live catalog
 *
 * Note: after adding/editing aliases.json, run `pi` once or `/alias sync` so
 * the names land in models.json. The first `pi --model <new-alias>` invocation
 * cannot resolve a not-yet-synced name (model resolution happens before the
 * session starts), so sync once, then alias freely.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

interface Alias {
	provider: string;
	model: string;
	thinking?: ThinkingLevel;
}

type AliasesConfig = Record<string, Alias>;

const aliasesPath = () => join(getAgentDir(), "aliases.json");
const modelsPath = () => join(getAgentDir(), "models.json");

function loadAliases(): AliasesConfig {
	const path = aliasesPath();
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as AliasesConfig;
	} catch (err) {
		console.error(`[model-aliases] Failed to load ${path}: ${err instanceof Error ? err.message : err}`);
		return {};
	}
}

/**
 * Additive-only sync of alias names into models.json modelOverrides.
 * Never overwrites an existing name, never removes anything.
 */
function syncNames(aliases: AliasesConfig): { changes: string[] } {
	const path = modelsPath();
	let config: { providers?: Record<string, { modelOverrides?: Record<string, { name?: string }> }> } = {};
	if (existsSync(path)) {
		try {
			config = JSON.parse(readFileSync(path, "utf-8"));
		} catch (err) {
			console.error(`[model-aliases] Failed to parse ${path}: ${err instanceof Error ? err.message : err}`);
			return { changes: [] };
		}
	}
	config.providers ??= {};
	const changes: string[] = [];

	for (const [name, alias] of Object.entries(aliases)) {
		const provider = (config.providers[alias.provider] ??= {});
		provider.modelOverrides ??= {};
		const override = provider.modelOverrides[alias.model] ?? {};
		if (override.name === name) continue;
		if (override.name !== undefined) {
			console.warn(
				`[model-aliases] ${alias.provider}/${alias.model} already has name "${override.name}" — not overwriting with "${name}". Edit models.json or aliases.json to resolve.`,
			);
			continue;
		}
		override.name = name;
		provider.modelOverrides[alias.model] = override;
		changes.push(`"${name}" → ${alias.provider}/${alias.model}`);
	}

	if (changes.length === 0) return { changes };
	try {
		writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf-8");
	} catch (err) {
		console.error(`[model-aliases] Failed to write ${path}: ${err instanceof Error ? err.message : err}`);
		return { changes: [] };
	}
	return { changes };
}

/**
 * Validate the determinism contract:
 * 1. Target model exists in the catalog.
 * 2. Alias name is not a substring of any OTHER model's id/name/provider-id.
 * 3. No substring overlap between alias names.
 * 4. No two aliases target the same model (name is single-valued).
 */
function validateAliases(aliases: AliasesConfig, models: Model<Api>[]): { errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];
	const names = Object.keys(aliases);
	const dupWarned = new Set<string>();

	for (const name of names) {
		const alias = aliases[name];
		const lower = name.toLowerCase();

		if (!models.some((m) => m.provider === alias.provider && m.id === alias.model)) {
			errors.push(`alias "${name}": target model ${alias.provider}/${alias.model} not found in catalog`);
		}

		const colliding = models.filter((m) => {
			if (m.provider === alias.provider && m.id === alias.model) return false;
			return (
				m.id.toLowerCase().includes(lower) ||
				(m.name ?? m.id).toLowerCase().includes(lower) ||
				`${m.provider}/${m.id}`.toLowerCase().includes(lower)
			);
		});
		if (colliding.length > 0) {
			warnings.push(
				`alias "${name}" is a substring of ${colliding.map((m) => `${m.provider}/${m.id}`).join(", ")} — "--model ${name}" may resolve nondeterministically. Pick a collision-free name.`,
			);
		}

		for (const other of names) {
			if (other === name) continue;
			const otherLower = other.toLowerCase();
			if (lower.includes(otherLower) || otherLower.includes(lower)) {
				errors.push(`alias "${name}" conflicts with alias "${other}" (substring overlap) — both would match "--model"`);
			}
		}

		const dups = names.filter(
			(n) => n !== name && aliases[n].provider === alias.provider && aliases[n].model === alias.model,
		);
		if (dups.length > 0) {
			const key = [name, ...dups].sort().join("|");
			if (!dupWarned.has(key)) {
				dupWarned.add(key);
				warnings.push(
					`aliases ${[name, ...dups].map((d) => `"${d}"`).join(", ")} target the same model — only one can be the synced name (modelOverrides.name is single-valued)`,
				);
			}
		}
	}
	return { errors, warnings };
}

export default function modelAliasesExtension(pi: ExtensionAPI) {
	let aliases: AliasesConfig = {};

	function getAllModels(ctx: ExtensionContext): Model<Api>[] {
		return ctx.modelRegistry.getAll();
	}

	function updateStatus(ctx: ExtensionContext) {
		const model = ctx.model;
		const active = model
			? Object.entries(aliases).find(([, a]) => a.provider === model.provider && a.model === model.id)?.[0]
			: undefined;
		if (active) {
			ctx.ui.setStatus("model-alias", ctx.ui.theme.fg("accent", `alias:${active}`));
		} else {
			ctx.ui.setStatus("model-alias", undefined);
		}
	}

	async function applyAlias(name: string, ctx: ExtensionContext): Promise<void> {
		const alias = aliases[name];
		if (!alias) {
			ctx.ui.notify(`Unknown alias "${name}". Available: ${Object.keys(aliases).join(", ") || "(none)"}`, "error");
			return;
		}
		const model = ctx.modelRegistry.find(alias.provider, alias.model);
		if (!model) {
			ctx.ui.notify(`Alias "${name}": model ${alias.provider}/${alias.model} not in catalog`, "error");
			return;
		}
		const ok = await pi.setModel(model);
		if (!ok) {
			ctx.ui.notify(`Alias "${name}": no API key for ${alias.provider}/${alias.model}`, "warning");
			return;
		}
		if (alias.thinking) {
			pi.setThinkingLevel(alias.thinking);
		}
		updateStatus(ctx);
		ctx.ui.notify(
			`Alias "${name}" → ${alias.provider}/${alias.model}${alias.thinking ? ` · thinking ${alias.thinking}` : ""}`,
			"info",
		);
	}

	async function showAliasSelector(ctx: ExtensionContext): Promise<void> {
		const names = Object.keys(aliases);
		if (names.length === 0) {
			ctx.ui.notify(`No aliases defined. Add them to ${aliasesPath()}`, "warning");
			return;
		}
		const items: SelectItem[] = names.map((name) => {
			const alias = aliases[name];
			return {
				value: name,
				label: name,
				description: `${alias.provider}/${alias.model}${alias.thinking ? ` · thinking ${alias.thinking}` : ""}`,
			};
		});
		const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
			const container = new Container();
			container.addChild(new Text(theme.fg("accent", theme.bold("Select Alias"))));
			const selectList = new SelectList(items, Math.min(items.length, 10), {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});
			selectList.onSelect = (item) => done(item.value);
			selectList.onCancel = () => done(null);
			container.addChild(selectList);
			container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter apply • esc cancel")));
			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					selectList.handleInput(data);
					tui.requestRender();
				},
			};
		});
		if (result) await applyAlias(result, ctx);
	}

	async function reportValidation(ctx: ExtensionContext): Promise<void> {
		const { errors, warnings } = validateAliases(aliases, getAllModels(ctx));
		if (errors.length === 0 && warnings.length === 0) {
			ctx.ui.notify("All aliases valid: targets exist, names are collision-free", "info");
			return;
		}
		for (const e of errors) console.error(`[model-aliases] ${e}`);
		for (const w of warnings) console.warn(`[model-aliases] ${w}`);
		ctx.ui.notify(
			`Model aliases: ${errors.length} error(s), ${warnings.length} warning(s) — see console`,
			errors.length > 0 ? "error" : "warning",
		);
	}

	pi.registerCommand("alias", {
		description: "List and apply model aliases (add names to ~/.pi/agent/aliases.json)",
		handler: async (args, ctx) => {
			aliases = loadAliases();
			const cmd = args?.trim() ?? "";
			if (cmd === "sync") {
				const { changes } = syncNames(aliases);
				if (changes.length > 0) {
					await ctx.modelRegistry.refresh();
					ctx.ui.notify(`Synced ${changes.length} name(s) into models.json`, "info");
				} else {
					ctx.ui.notify("models.json is up to date", "info");
				}
				return;
			}
			if (cmd === "check") {
				await reportValidation(ctx);
				return;
			}
			if (cmd) {
				await applyAlias(cmd, ctx);
				return;
			}
			await showAliasSelector(ctx);
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		aliases = loadAliases();
		if (Object.keys(aliases).length > 0) {
			const { errors, warnings } = validateAliases(aliases, getAllModels(ctx));
			for (const e of errors) console.error(`[model-aliases] ${e}`);
			for (const w of warnings) console.warn(`[model-aliases] ${w}`);
			const { changes } = syncNames(aliases);
			if (changes.length > 0) {
				try {
					await ctx.modelRegistry.refresh();
				} catch {
					// refresh is best-effort; names land on next start regardless
				}
				ctx.ui.notify(`Model aliases: synced ${changes.length} name(s) into models.json`, "info");
			}
		}
		updateStatus(ctx);
	});

	pi.on("model_select", (_event, ctx) => {
		updateStatus(ctx);
	});
}
