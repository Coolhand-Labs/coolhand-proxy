import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultProgramArguments } from "./install.ts";
import { PROXY_PORT } from "./constants.ts";

describe("defaultProgramArguments", () => {
  const argv = defaultProgramArguments("/Users/x/.coolhand-proxy");

  it("runs the current node binary against the compiled cli.js", () => {
    assert.equal(argv[0], process.execPath);
    assert.ok(argv[1]?.endsWith("cli.js"));
  });

  it("invokes `start` in silent mode", () => {
    assert.ok(argv.includes("start"));
    assert.ok(argv.includes("--silent"));
  });

  it("pins the fixed port", () => {
    const i = argv.indexOf("--port");
    assert.equal(argv[i + 1], String(PROXY_PORT));
  });

  it("passes the cert dir explicitly so daemon and installer agree", () => {
    const i = argv.indexOf("--cert-dir");
    assert.equal(argv[i + 1], "/Users/x/.coolhand-proxy");
  });
});
