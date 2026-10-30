/**
 * Reload short-circuit — the one entry-level case ported from the retired package's
 * `entry.test.ts`: when the on-disk checksums still match, `session_start` with reason
 * `reload` reports the retained rules instead of scanning again. No other test pins this
 * report text.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import rulesInjector from "../../rules-injector.ts";
import { createHarness } from "./harness.ts";

const RULE_TEXT = "Never leak secrets.";

let homeRoot: string;
let projectRoot: string;

function globalRulesDir(): string {
	return path.join(homeRoot, ".pi", "agent", "rules");
}

beforeEach(() => {
	homeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rules-reload-home-"));
	projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rules-reload-project-"));
	vi.stubEnv("HOME", homeRoot);
	fs.mkdirSync(globalRulesDir(), { recursive: true });
	fs.writeFileSync(
		path.join(globalRulesDir(), "house-rules.md"),
		`# House rules\n\n${RULE_TEXT}\n`,
		"utf8",
	);
});

afterEach(() => {
	vi.unstubAllEnvs();
	fs.rmSync(homeRoot, { recursive: true, force: true });
	fs.rmSync(projectRoot, { recursive: true, force: true });
});

describe("reload with unchanged checksums", () => {
	it("reports the unchanged short-circuit instead of rescanning", async () => {
		const harness = createHarness(rulesInjector, projectRoot);
		await harness.startSession("startup");
		harness.notifications.length = 0;

		await harness.startSession("reload");

		expect(harness.notifications).toHaveLength(1);
		const [notification] = harness.notifications;
		expect(notification?.type).toBe("info");
		expect(notification?.message).toBe(
			`pi-rules: 1 rule(s) — unchanged (checksums verified, no rescan)\n- ${path.join(globalRulesDir(), "house-rules.md")} [global] — unscoped (always-on)`,
		);

		const { sections } = await harness.promptStart();
		expect(sections["user-rules"] ?? "").toContain(RULE_TEXT);
	});
});
