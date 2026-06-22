import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateEnvAgentPlist,
  buildProxyEnv,
  buildAgentBootstrapSpec,
  buildAgentBootoutSpec,
  buildAsUserUnsetenvSpec,
  PROXY_ENV_KEYS,
} from "./env-agent.ts";
import { ENV_AGENT_LABEL } from "./constants.ts";

describe("buildProxyEnv", () => {
  const env = buildProxyEnv("/Users/alice/.coolhand-proxy/ca-cert.pem");

  it("sets HTTP_PROXY and HTTPS_PROXY to the fixed port", () => {
    assert.equal(env["HTTP_PROXY"], "http://127.0.0.1:47821");
    assert.equal(env["HTTPS_PROXY"], "http://127.0.0.1:47821");
  });

  it("sets cert vars to the provided cert path", () => {
    const certPath = "/Users/alice/.coolhand-proxy/ca-cert.pem";
    assert.equal(env["SSL_CERT_FILE"], certPath);
    assert.equal(env["NODE_EXTRA_CA_CERTS"], certPath);
    assert.equal(env["REQUESTS_CA_BUNDLE"], certPath);
  });

  it("covers every key in PROXY_ENV_KEYS", () => {
    for (const key of PROXY_ENV_KEYS) {
      assert.ok(key in env, `missing key: ${key}`);
    }
  });
});

describe("generateEnvAgentPlist", () => {
  const vars = buildProxyEnv("/Users/alice/.coolhand-proxy/ca-cert.pem");
  const xml = generateEnvAgentPlist(vars);

  it("includes the env agent label", () => {
    assert.ok(xml.includes(`<string>${ENV_AGENT_LABEL}</string>`));
  });

  it("uses /bin/sh -c as the program", () => {
    assert.ok(xml.includes("<string>/bin/sh</string>"));
    assert.ok(xml.includes("<string>-c</string>"));
  });

  it("emits a launchctl setenv call for each var", () => {
    for (const key of PROXY_ENV_KEYS) {
      assert.ok(xml.includes(`launchctl setenv ${key}`), `missing setenv for ${key}`);
    }
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
    const spec = buildAsUserUnsetenvSpec(501, "HTTP_PROXY");
    assert.equal(spec.file, "launchctl");
    assert.deepEqual(spec.args, ["asuser", "501", "launchctl", "unsetenv", "HTTP_PROXY"]);
  });
});
