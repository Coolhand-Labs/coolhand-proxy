import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { sendToCoolhand, type CapturedInteraction } from "./sender.ts";

const sampleInteraction: CapturedInteraction = {
  request: {
    method: "POST",
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "content-type": "application/json" },
    body: '{"model":"gpt-4","messages":[{"role":"user","content":"hello"}]}',
  },
  response: {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: '{"choices":[{"message":{"content":"Hi!"}}]}',
  },
  durationMs: 500,
  timestamp: "2026-02-11T00:00:00.000Z",
};

describe("sendToCoolhand", () => {
  it("formats payload correctly in debug mode", async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));

    await sendToCoolhand(sampleInteraction, {
      apiKey: "test-key",
      debug: true,
    });

    console.log = origLog;

    const output = logs.join("\n");
    assert.ok(output.includes("llm_request_log"));
    assert.ok(output.includes("raw_request"));
    assert.ok(output.includes("coolhand-proxy"));
    assert.ok(output.includes("api.openai.com"));
  });

  it("sends POST to Coolhand API endpoint", async () => {
    const fetchCalls: { url: string; init: RequestInit }[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: url.toString(), init: init! });
      return new Response('{"id": 1}', { status: 200 });
    };

    await sendToCoolhand(sampleInteraction, {
      apiKey: "my-api-key",
      silent: true,
    });

    globalThis.fetch = origFetch;

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0]!.url, "https://coolhandlabs.com/api/v2/llm_request_logs");
    assert.equal(fetchCalls[0]!.init.method, "POST");

    const headers = fetchCalls[0]!.init.headers as Record<string, string>;
    assert.equal(headers["X-API-Key"], "my-api-key");
    assert.equal(headers["Content-Type"], "application/json");

    const body = JSON.parse(fetchCalls[0]!.init.body as string);
    assert.equal(body.llm_request_log.raw_request.method, "POST");
    assert.equal(body.llm_request_log.raw_request.url, "https://api.openai.com/v1/chat/completions");
    assert.equal(body.llm_request_log.raw_request.status_code, 200);
    assert.equal(body.llm_request_log.raw_request.duration_ms, 500);
    assert.equal(body.llm_request_log.collector, "coolhand-proxy");
  });

  it("handles API errors gracefully", async () => {
    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));

    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("Bad Request", { status: 400 });

    await sendToCoolhand(sampleInteraction, {
      apiKey: "test-key",
    });

    globalThis.fetch = origFetch;
    console.error = origError;

    assert.ok(errors.some((e) => e.includes("Failed to send") && e.includes("400")));
  });
});
