import { describe, expect, it, vi } from "vitest";
import { CONFIG_ENV_VAR, DEFAULTS, resolveConfig } from "../src/config.js";

describe("resolveConfig", () => {
  it("returns defaults when the env var is unset", () => {
    expect(resolveConfig(undefined)).toEqual(DEFAULTS);
    expect(resolveConfig("")).toEqual(DEFAULTS);
  });

  it("merges a JSON override over the defaults", () => {
    const cfg = resolveConfig(JSON.stringify({ tools: ["bash", "grep"], corners: "straight" }));
    expect(cfg.tools).toEqual(["bash", "grep"]);
    expect(cfg.corners).toBe("straight");
    // untouched fields keep defaults
    expect(cfg.padding).toBe(DEFAULTS.padding);
    expect(cfg.stackCallResult).toBe(true);
  });

  it("deep-merges the colors map", () => {
    const cfg = resolveConfig(JSON.stringify({ colors: { error: "red" } }));
    expect(cfg.colors).toEqual({ pending: "warning", error: "red", success: "border" });
  });

  it("falls back to defaults on invalid JSON and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveConfig("{not json")).toEqual(DEFAULTS);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reads from the process environment when raw is not passed", () => {
    process.env[CONFIG_ENV_VAR] = JSON.stringify({ force: ["read"] });
    try {
      const cfg = resolveConfig();
      expect(cfg.force).toEqual(["read"]);
    } finally {
      delete process.env[CONFIG_ENV_VAR];
    }
  });
});
