import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyShellBlock, removeShellBlock, generateShellBlock } from "./shell-profile.ts";

const CERT_KEYS = ["SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS", "REQUESTS_CA_BUNDLE"];

describe("generateShellBlock", () => {
  const block = generateShellBlock("/Users/alice/.coolhand-proxy/ca-cert.pem");

  it("exports all cert env vars", () => {
    for (const key of CERT_KEYS) {
      assert.ok(block.includes(`export ${key}=`), `missing export for ${key}`);
    }
  });

  it("does not export HTTP_PROXY or HTTPS_PROXY", () => {
    assert.ok(!block.includes("export HTTP_PROXY="));
    assert.ok(!block.includes("export HTTPS_PROXY="));
  });

  it("includes begin and end markers", () => {
    assert.ok(block.includes("# >>> coolhand-proxy begin >>>"));
    assert.ok(block.includes("# <<< coolhand-proxy end <<<"));
  });
});

describe("applyShellBlock", () => {
  it("appends block to an empty file", () => {
    const result = applyShellBlock("", "/cert.pem");
    assert.ok(result.includes("# >>> coolhand-proxy begin >>>"));
    assert.ok(result.includes("export SSL_CERT_FILE="));
  });

  it("appends block after existing content with newline separator", () => {
    const result = applyShellBlock("existing content\n", "/cert.pem");
    assert.ok(result.startsWith("existing content\n"));
    assert.ok(result.includes("# >>> coolhand-proxy begin >>>"));
  });

  it("replaces an existing block rather than appending a second one", () => {
    const first = applyShellBlock("", "/old-cert.pem");
    const second = applyShellBlock(first, "/new-cert.pem");
    const count = (second.match(/# >>> coolhand-proxy begin >>>/g) ?? []).length;
    assert.equal(count, 1);
    assert.ok(second.includes("/new-cert.pem"));
    assert.ok(!second.includes("/old-cert.pem"));
  });
});

describe("removeShellBlock", () => {
  it("removes an installed block", () => {
    const withBlock = applyShellBlock("preamble content\n", "/cert.pem");
    const removed = removeShellBlock(withBlock);
    assert.ok(!removed.includes("# >>> coolhand-proxy begin >>>"));
    assert.ok(!removed.includes("export SSL_CERT_FILE="));
    assert.ok(removed.includes("preamble content"));
  });

  it("is idempotent when block is absent", () => {
    const content = "some shell config\n";
    assert.equal(removeShellBlock(content), content);
  });

  it("leaves surrounding content intact", () => {
    const before = "# before\n";
    const after = "\n# after\n";
    const withBlock = applyShellBlock(before + after, "/cert.pem");
    const removed = removeShellBlock(withBlock);
    assert.ok(removed.includes("# before"));
    assert.ok(removed.includes("# after"));
  });
});
