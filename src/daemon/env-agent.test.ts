import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateEnvAgentPlist,
  buildCertEnv,
  buildAgentBootstrapSpec,
  buildAgentBootoutSpec,
  buildAsUserUnsetenvSpec,
  CERT_ENV_KEYS,
} from "./env-agent.ts";
import { ENV_AGENT_LABEL } from "./constants.ts";

describe("buildCertEnv", () => {
  const certPath = "/Users/alice/.coolhand-proxy/ca-cert.pem";
  const env = buildCertEnv(certPath);

  it("sets all three cert vars to the provided path", () => {
    assert.equal(env["SSL_CERT_FILE"], certPath);
    assert.equal(env["NODE_EXTRA_CA_CERTS"], certPath);
    assert.equal(env["REQUESTS_CA_BUNDLE"], certPath);
  });

  it("does not include HTTP_PROXY or HTTPS_PROXY", () => {
    assert.ok(!("HTTP_PROXY" in env));
    assert.ok(!("HTTPS_PROXY" in env));
  });

  it("covers every key in CERT_ENV_KEYS", () => {
    for (const key of CERT_ENV_KEYS) {
      assert.ok(key in env, `missing key: ${key}`);
    }
  });
});

describe("generateEnvAgentPlist", () => {
  const vars = buildCertEnv("/Users/alice/.coolhand-proxy/ca-cert.pem");
  const xml = generateEnvAgentPlist(vars);

  it("includes the env agent label", () => {
    assert.ok(xml.includes(`<string>${ENV_AGENT_LABEL}</string>`));
  });

  it("uses /bin/sh -c as the program", () => {
    assert.ok(xml.includes("<string>/bin/sh</string>"));
    assert.ok(xml.includes("<string>-c</string>"));
  });

  it("emits a launchctl setenv call for each cert var", () => {
    for (const key of CERT_ENV_KEYS) {
      assert.ok(xml.includes(`launchctl setenv ${key}`), `missing setenv for ${key}`);
    }
  });

  it("does not emit setenv for HTTP_PROXY or HTTPS_PROXY", () => {
    assert.ok(!xml.includes("launchctl setenv HTTP_PROXY"));
    assert.ok(!xml.includes("launchctl setenv HTTPS_PROXY"));
  });

  it("sets RunAtLoad to true", () => {
    assert.ok(xml.includes("<key>RunAtLoad</key>"));
    assert.ok(xml.includes("<true/>"));
  });

  it("XML-escapes special characters in values", () => {
    const escaped = generateEnvAgentPlist({ KEY: "val&ue<x>" });
    assert.ok(escaped.includes("val&amp;ue&lt;x&gt;"));
  });
});

describe("buildAgentBootstrapSpec", () => {
  it("produces the correct launchctl bootstrap args", () => {
    const spec = buildAgentBootstrapSpec(501, "/Users/alice/Library/LaunchAgents/com.coolhandlabs.proxy.env.plist");
    assert.equal(spec.file, "launchctl");
    assert.deepEqual(spec.args, [
      "bootstrap",
      "gui/501",
      "/Users/alice/Library/LaunchAgents/com.coolhandlabs.proxy.env.plist",
    ]);
  });
});

describe("buildAgentBootoutSpec", () => {
  it("produces the correct launchctl bootout args with default label", () => {
    const spec = buildAgentBootoutSpec(501);
    assert.equal(spec.file, "launchctl");
    assert.deepEqual(spec.args, ["bootout", `gui/501/${ENV_AGENT_LABEL}`]);
  });

  it("accepts a custom label", () => {
    const spec = buildAgentBootoutSpec(501, "com.example.test");
    assert.deepEqual(spec.args, ["bootout", "gui/501/com.example.test"]);
  });
});

describe("buildAsUserUnsetenvSpec", () => {
  it("produces the correct launchctl asuser unsetenv args", () => {
    const spec = buildAsUserUnsetenvSpec(501, "SSL_CERT_FILE");
    assert.equal(spec.file, "launchctl");
    assert.deepEqual(spec.args, ["asuser", "501", "launchctl", "unsetenv", "SSL_CERT_FILE"]);
  });
});
