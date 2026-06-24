import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseNetworkServices,
  parseGetWebProxy,
  buildSetWebProxySpec,
  buildSetSecureWebProxyStateSpec,
  enableProxy,
  disableProxy,
  listActiveServices,
} from "./system-proxy.ts";
import type { CommandSpec, ExecResult } from "./exec.ts";

describe("parseNetworkServices", () => {
  it("drops the header line and disabled (*) services", () => {
    const raw =
      "An asterisk (*) denotes that a network service is disabled.\n" +
      "Wi-Fi\nThunderbolt Bridge\n*Old Adapter\n";
    assert.deepEqual(parseNetworkServices(raw), ["Wi-Fi", "Thunderbolt Bridge"]);
  });
});

describe("parseGetWebProxy", () => {
  it("parses an enabled proxy", () => {
    const raw = "Enabled: Yes\nServer: 127.0.0.1\nPort: 47821\nAuthenticated Proxy Enabled: 0\n";
    assert.deepEqual(parseGetWebProxy(raw), { enabled: true, server: "127.0.0.1", port: 47821 });
  });

  it("parses a disabled proxy", () => {
    const raw = "Enabled: No\nServer:\nPort: 0\n";
    assert.equal(parseGetWebProxy(raw).enabled, false);
  });
});

describe("system-proxy command specs", () => {
  it("setwebproxy points a service at host:port", () => {
    assert.deepEqual(buildSetWebProxySpec("Wi-Fi", "127.0.0.1", 47821), {
      file: "networksetup",
      args: ["-setwebproxy", "Wi-Fi", "127.0.0.1", "47821"],
    });
  });

  it("setsecurewebproxystate maps boolean to on/off", () => {
    assert.deepEqual(buildSetSecureWebProxyStateSpec("Wi-Fi", true), {
      file: "networksetup",
      args: ["-setsecurewebproxystate", "Wi-Fi", "on"],
    });
  });
});

describe("system-proxy actions (fake exec)", () => {
  function recorder(stdout = ""): { calls: CommandSpec[]; exec: (s: CommandSpec) => Promise<ExecResult> } {
    const calls: CommandSpec[] = [];
    return {
      calls,
      exec: async (spec: CommandSpec) => {
        calls.push(spec);
        return { stdout, stderr: "" };
      },
    };
  }

  it("enableProxy issues the 4 commands in order", async () => {
    const { calls, exec } = recorder();
    await enableProxy("Wi-Fi", "127.0.0.1", 47821, exec);
    assert.deepEqual(
      calls.map((c) => c.args[0]),
      ["-setwebproxy", "-setsecurewebproxy", "-setwebproxystate", "-setsecurewebproxystate"],
    );
  });

  it("disableProxy turns both proxies off", async () => {
    const { calls, exec } = recorder();
    await disableProxy("Wi-Fi", exec);
    assert.deepEqual(
      calls.map((c) => c.args),
      [
        ["-setwebproxystate", "Wi-Fi", "off"],
        ["-setsecurewebproxystate", "Wi-Fi", "off"],
      ],
    );
  });

  it("listActiveServices parses the networksetup output", async () => {
    const { exec } = recorder("An asterisk (*) denotes...\nWi-Fi\n");
    assert.deepEqual(await listActiveServices(exec), ["Wi-Fi"]);
  });
});
