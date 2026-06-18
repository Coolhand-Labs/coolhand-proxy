import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { SERVICE_LABEL, PROXY_PORT, PLIST_PATH, SYSTEM_KEYCHAIN, getDaemonPaths } from "./constants.ts";

describe("daemon constants", () => {
  it("PLIST_PATH lives in /Library/LaunchDaemons and matches the label", () => {
    assert.equal(PLIST_PATH, `/Library/LaunchDaemons/${SERVICE_LABEL}.plist`);
  });

  it("PROXY_PORT is the stable fixed port", () => {
    assert.equal(PROXY_PORT, 47821);
  });

  it("SYSTEM_KEYCHAIN is the macOS system keychain", () => {
    assert.equal(SYSTEM_KEYCHAIN, "/Library/Keychains/System.keychain");
  });

  it("getDaemonPaths derives certDir and logFile from the home dir", () => {
    const { certDir, logFile } = getDaemonPaths("/home/u");
    assert.equal(certDir, path.join("/home/u", ".coolhand-proxy"));
    assert.equal(logFile, path.join("/home/u", ".coolhand-proxy", "daemon.log"));
  });
});
