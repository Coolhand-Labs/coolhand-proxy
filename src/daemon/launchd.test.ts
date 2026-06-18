import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generatePlist,
  buildBootstrapSpec,
  buildBootoutSpec,
  buildPrintSpec,
} from "./launchd.ts";

describe("generatePlist", () => {
  const xml = generatePlist({
    label: "com.coolhandlabs.proxy",
    programArguments: ["/usr/bin/node", "/opt/app/cli.js", "start", "--port", "47821"],
    apiKey: "secret&<key>",
    logFile: "/Users/x/.coolhand-proxy/daemon.log",
  });

  it("includes the service label", () => {
    assert.ok(xml.includes("<string>com.coolhandlabs.proxy</string>"));
  });

  it("sets RunAtLoad and KeepAlive true by default (always-on)", () => {
    assert.match(xml, /<key>RunAtLoad<\/key>\s*<true\/>/);
    assert.match(xml, /<key>KeepAlive<\/key>\s*<true\/>/);
  });

  it("renders each program argument as its own <string>", () => {
    assert.ok(xml.includes("<string>/usr/bin/node</string>"));
    assert.ok(xml.includes("<string>--port</string>"));
    assert.ok(xml.includes("<string>47821</string>"));
  });

  it("escapes XML special characters in values", () => {
    assert.ok(xml.includes("secret&amp;&lt;key&gt;"));
    assert.ok(!xml.includes("secret&<key>"));
  });

  it("bakes the API key under EnvironmentVariables", () => {
    assert.match(xml, /<key>EnvironmentVariables<\/key>[\s\S]*<key>COOLHAND_API_KEY<\/key>/);
  });

  it("points stdout and stderr at the log file", () => {
    assert.ok(xml.includes("<key>StandardOutPath</key>\n  <string>/Users/x/.coolhand-proxy/daemon.log</string>"));
    assert.ok(xml.includes("<key>StandardErrorPath</key>\n  <string>/Users/x/.coolhand-proxy/daemon.log</string>"));
  });

  it("can render RunAtLoad/KeepAlive false when asked", () => {
    const x = generatePlist({
      label: "l",
      programArguments: ["a"],
      apiKey: "",
      logFile: "/l",
      runAtLoad: false,
      keepAlive: false,
    });
    assert.match(x, /<key>RunAtLoad<\/key>\s*<false\/>/);
    assert.match(x, /<key>KeepAlive<\/key>\s*<false\/>/);
  });
});

describe("launchctl command specs", () => {
  it("bootstrap loads the plist into the system domain", () => {
    assert.deepEqual(buildBootstrapSpec("/Library/LaunchDaemons/x.plist"), {
      file: "launchctl",
      args: ["bootstrap", "system", "/Library/LaunchDaemons/x.plist"],
    });
  });

  it("bootout targets system/<label>", () => {
    assert.deepEqual(buildBootoutSpec("com.coolhandlabs.proxy"), {
      file: "launchctl",
      args: ["bootout", "system/com.coolhandlabs.proxy"],
    });
  });

  it("print targets system/<label>", () => {
    assert.deepEqual(buildPrintSpec("com.coolhandlabs.proxy"), {
      file: "launchctl",
      args: ["print", "system/com.coolhandlabs.proxy"],
    });
  });
});
