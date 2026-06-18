import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getOrCreateCA } from "../certs.ts";
import {
  fingerprintSha1,
  buildAddTrustedCertSpec,
  buildDeleteCertSpec,
  buildListCertHashesSpec,
  trustCert,
  isCertPresent,
} from "./trust-store.ts";
import type { CommandSpec, ExecResult } from "./exec.ts";

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

describe("fingerprintSha1", () => {
  const tmpDir = path.join(os.tmpdir(), `chp-fp-${Date.now()}`);
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it("returns 40 uppercase hex chars with no colons", async () => {
    const ca = await getOrCreateCA(tmpDir);
    assert.match(fingerprintSha1(ca.cert), /^[0-9A-F]{40}$/);
  });
});

describe("trust-store command specs", () => {
  it("add-trusted-cert uses the system domain and trustRoot", () => {
    assert.deepEqual(buildAddTrustedCertSpec("/c/cert.pem", "/Library/Keychains/System.keychain"), {
      file: "security",
      args: ["add-trusted-cert", "-d", "-r", "trustRoot", "-k", "/Library/Keychains/System.keychain", "/c/cert.pem"],
    });
  });

  it("delete-certificate targets by SHA-1 hash", () => {
    assert.deepEqual(buildDeleteCertSpec("ABCD", "/k"), {
      file: "security",
      args: ["delete-certificate", "-Z", "ABCD", "/k"],
    });
  });

  it("list spec asks for all certs with their hashes", () => {
    assert.deepEqual(buildListCertHashesSpec("/k"), {
      file: "security",
      args: ["find-certificate", "-a", "-Z", "/k"],
    });
  });
});

describe("trust-store actions (fake exec)", () => {
  it("trustCert runs add-trusted-cert", async () => {
    const { calls, exec } = recorder();
    await trustCert("/c.pem", "/k", exec);
    assert.equal(calls[0]?.args[0], "add-trusted-cert");
  });

  it("isCertPresent is true when the hash appears in the listing (case-insensitive)", async () => {
    const { exec } = recorder("SHA-1 hash: ABCDEF0123\n");
    assert.equal(await isCertPresent("abcdef0123", "/k", exec), true);
  });

  it("isCertPresent is false when the hash is absent", async () => {
    const { exec } = recorder("SHA-1 hash: 9999\n");
    assert.equal(await isCertPresent("abcdef0123", "/k", exec), false);
  });
});
