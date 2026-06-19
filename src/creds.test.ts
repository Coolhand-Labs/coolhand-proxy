import { test, describe, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { tmpdir, homedir } from "os";
import { join } from "path";

describe("loadApiKey", () => {
  let tmpDir: string;
  const originalEnv = { ...process.env };

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "creds-test-"));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true });
  });

  beforeEach(() => {
    delete process.env["COOLHAND_API_KEY"];
    delete process.env["COOLHAND_CONFIG_DIR"];
  });

  afterEach(() => {
    process.env["COOLHAND_API_KEY"] = originalEnv["COOLHAND_API_KEY"];
    process.env["COOLHAND_CONFIG_DIR"] = originalEnv["COOLHAND_CONFIG_DIR"];
    if (!originalEnv["COOLHAND_API_KEY"]) delete process.env["COOLHAND_API_KEY"];
    if (!originalEnv["COOLHAND_CONFIG_DIR"]) delete process.env["COOLHAND_CONFIG_DIR"];
    delete process.env["SUDO_USER"];
  });

  test("returns COOLHAND_API_KEY env var when set", async () => {
    process.env["COOLHAND_API_KEY"] = "env-key-123";
    // Point at a non-existent config to confirm env var wins without file access
    process.env["COOLHAND_CONFIG_DIR"] = join(tmpDir, "nonexistent");
    const { loadApiKey } = await import("./creds.ts");
    assert.equal(await loadApiKey(), "env-key-123");
  });

  test("reads api_key from default client in config file", async () => {
    const configDir = join(tmpDir, "cli-config");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "config.json"),
      JSON.stringify({
        version: 1,
        default_client_id: "abc123",
        clients: {
          abc123: { api_key: "from-cli-key", client_name: "My App" },
        },
      })
    );
    process.env["COOLHAND_CONFIG_DIR"] = configDir;
    const { loadApiKey } = await import("./creds.ts");
    assert.equal(await loadApiKey(), "from-cli-key");
  });

  test("returns undefined when no env var and no config file", async () => {
    process.env["COOLHAND_CONFIG_DIR"] = join(tmpDir, "missing");
    const { loadApiKey } = await import("./creds.ts");
    assert.equal(await loadApiKey(), undefined);
  });

  test("resolveConfigDir uses SUDO_USER to find the real user's config dir", async () => {
    process.env["SUDO_USER"] = "alice";
    const { resolveConfigDir } = await import("./creds.ts");
    assert.equal(resolveConfigDir(), "/Users/alice/.coolhand");
  });

  test("returns undefined when config file has no matching default client", async () => {
    const configDir = join(tmpDir, "bad-config");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "config.json"),
      JSON.stringify({ version: 1, default_client_id: "ghost", clients: {} })
    );
    process.env["COOLHAND_CONFIG_DIR"] = configDir;
    const { loadApiKey } = await import("./creds.ts");
    assert.equal(await loadApiKey(), undefined);
  });
});
