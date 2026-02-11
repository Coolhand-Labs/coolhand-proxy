import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getOrCreateCA, getCertPath } from "./certs.ts";

describe("getOrCreateCA", () => {
  const tmpDir = path.join(os.tmpdir(), `coolhand-proxy-test-${Date.now()}`);

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates CA cert and key files", async () => {
    const ca = await getOrCreateCA(tmpDir);

    assert.ok(ca.key.includes("-----BEGIN"), "Key should be PEM format");
    assert.ok(ca.cert.includes("-----BEGIN CERTIFICATE-----"));
    assert.ok(fs.existsSync(path.join(tmpDir, "ca-key.pem")));
    assert.ok(fs.existsSync(path.join(tmpDir, "ca-cert.pem")));
  });

  it("reuses existing cert on subsequent calls", async () => {
    const ca1 = await getOrCreateCA(tmpDir);
    const ca2 = await getOrCreateCA(tmpDir);

    assert.equal(ca1.key, ca2.key);
    assert.equal(ca1.cert, ca2.cert);
  });
});

describe("getCertPath", () => {
  it("returns expected path", () => {
    assert.equal(getCertPath("/tmp/test"), "/tmp/test/ca-cert.pem");
  });
});
