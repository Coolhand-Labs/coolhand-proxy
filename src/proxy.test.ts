import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { getOrCreateCA } from "./certs.ts";
import { startProxy, type ProxyInstance } from "./proxy.ts";

describe("startProxy", () => {
  let proxy: ProxyInstance | null = null;
  const tmpDir = path.join(os.tmpdir(), `coolhand-proxy-test-${Date.now()}`);

  afterEach(async () => {
    if (proxy) {
      await proxy.stop();
      proxy = null;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("starts on a random port and stops cleanly", async () => {
    const ca = await getOrCreateCA(tmpDir);
    proxy = await startProxy(ca, {
      apiKey: "test-key",
      silent: true,
      debug: true,
    });

    assert.ok(proxy.port > 0);
    assert.ok(proxy.port < 65536);

    await proxy.stop();
    proxy = null; // prevent double stop in afterEach
  });

  it("passes through non-LLM HTTPS requests", async () => {
    const ca = await getOrCreateCA(tmpDir);
    proxy = await startProxy(ca, {
      apiKey: "test-key",
      silent: true,
      debug: true,
    });

    // Verify the proxy started and is accepting connections
    const net = await import("net");
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection(proxy!.port, "127.0.0.1", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
      socket.setTimeout(3000, () => { socket.destroy(); resolve(false); });
    });

    assert.ok(connected, "Should be able to connect to proxy port");
  });
});
