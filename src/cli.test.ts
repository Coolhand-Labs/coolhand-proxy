import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "child_process";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { getOrCreateCA, getCertPath } from "./certs.ts";

const CLI_PATH = path.join(import.meta.dirname, "cli.ts");
// Invoke tsx directly so SIGTERM reaches the CLI process without going through
// npm exec wrappers that don't forward signals to their children.
const TSX_BIN = path.resolve(import.meta.dirname, "..", "node_modules", ".bin", "tsx");

function spawnCLI(args: string[], env?: Record<string, string>): ChildProcess {
  return spawn(TSX_BIN, [CLI_PATH, ...args], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/**
 * Spawn the CLI `start` command and wait for the JSON readiness line on stdout.
 * Returns { stdout, stderr, json } after killing the process.
 */
async function runStart(
  args: string[],
  env?: Record<string, string>
): Promise<{ stdout: string; stderr: string; json: Record<string, unknown> }> {
  const child = spawnCLI(["start", ...args], env);

  let stdout = "";
  let stderr = "";

  child.stdout!.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr!.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  // Wait for the JSON readiness line on stdout
  const json = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Timed out waiting for JSON readiness line.\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, 15000);

    child.stdout!.on("data", () => {
      // Try parsing each time we get data — the JSON line may arrive in chunks
      const lines = stdout.trim().split("\n");
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.port && parsed.pid) {
            clearTimeout(timeout);
            resolve(parsed);
            return;
          }
        } catch {
          // Not valid JSON yet, keep waiting
        }
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`CLI exited with code ${code} before emitting JSON.\nstdout: ${stdout}\nstderr: ${stderr}`));
    });
  });

  // Kill the proxy process and explicitly destroy streams to release pipe handles
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => child.on("exit", () => resolve()));
  child.stdout?.destroy();
  child.stderr?.destroy();

  return { stdout, stderr, json };
}

describe("cli start --silent", () => {
  const tmpDir = path.join(os.tmpdir(), `coolhand-proxy-cli-test-${Date.now()}`);

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("outputs only valid JSON to stdout when --silent is passed", async () => {
    const { stdout, json } = await runStart([
      "--silent",
      "--debug",
      "--cert-dir", tmpDir,
    ]);

    // stdout should contain exactly one line of valid JSON
    const stdoutLines = stdout.trim().split("\n");
    assert.equal(stdoutLines.length, 1, `Expected 1 line on stdout, got ${stdoutLines.length}: ${stdout}`);
    assert.doesNotThrow(() => JSON.parse(stdoutLines[0]!), "stdout line should be valid JSON");

    // JSON should have expected fields
    assert.equal(typeof json.port, "number");
    assert.equal(typeof json.pid, "number");
    assert.equal(typeof json.certPath, "string");
    assert.equal(typeof json.httpProxy, "string");
    assert.ok((json.httpProxy as string).startsWith("http://127.0.0.1:"));
  });

  it("JSON readiness line contains correct port in httpProxy", async () => {
    const { json } = await runStart([
      "--silent",
      "--debug",
      "--cert-dir", tmpDir,
    ]);

    assert.equal(json.httpProxy, `http://127.0.0.1:${json.port}`);
  });

  it("does not write diagnostic 📋 lines to stdout when --silent", async () => {
    const { stdout } = await runStart([
      "--silent",
      "--debug",
      "--cert-dir", tmpDir,
    ]);

    assert.ok(!stdout.includes("📋"), "stdout should not contain diagnostic emoji lines");
    assert.ok(!stdout.includes("ES module environment"), "stdout should not contain PatternMatchingService diagnostics");
    assert.ok(!stdout.includes("Loaded"), "stdout should not contain 'Loaded' diagnostics");
  });
});

describe("cli start (without --silent)", () => {
  const tmpDir = path.join(os.tmpdir(), `coolhand-proxy-cli-test-nosil-${Date.now()}`);

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("outputs valid JSON to stdout", async () => {
    const { stdout, json } = await runStart([
      "--debug",
      "--cert-dir", tmpDir,
    ]);

    // There should be at least one line that is valid JSON with port/pid
    const lines = stdout.trim().split("\n");
    let foundJson = false;
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.port && parsed.pid) {
          foundJson = true;
          break;
        }
      } catch {
        // non-JSON line, may be diagnostic output
      }
    }
    assert.ok(foundJson, "stdout should contain a JSON readiness line");

    assert.equal(typeof json.port, "number");
    assert.equal(typeof json.pid, "number");
    assert.equal(typeof json.certPath, "string");
    assert.equal(typeof json.httpProxy, "string");
  });

  it("writes proxy started message to stderr", async () => {
    const { stderr } = await runStart([
      "--debug",
      "--cert-dir", tmpDir,
    ]);

    assert.ok(stderr.includes("[coolhand-proxy] Proxy started on port"), "stderr should contain proxy started message");
  });
});
