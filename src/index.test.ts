import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as api from "./index.ts";

describe("public API surface", () => {
  it("exports all expected functions", () => {
    assert.equal(typeof api.startProxy, "function");
    assert.equal(typeof api.getOrCreateCA, "function");
    assert.equal(typeof api.getCertPath, "function");
    assert.equal(typeof api.getDefaultCertDir, "function");
    assert.equal(typeof api.shouldCapture, "function");
    assert.equal(typeof api.sanitizeHeaders, "function");
    assert.equal(typeof api.parseBody, "function");
    assert.equal(typeof api.sendToCoolhand, "function");
  });
});
