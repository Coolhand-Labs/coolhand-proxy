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

  it("normalizes Gemini array response to newline-delimited JSON", async () => {
    const geminiInteraction: CapturedInteraction = {
      request: {
        method: "POST",
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent",
        headers: { "content-type": "application/json" },
        body: '{"contents":[{"parts":[{"text":"hello"}]}]}',
      },
      response: {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify([
          { candidates: [{ content: { parts: [{ text: "Hi" }] } }] },
          { candidates: [{ content: { parts: [{ text: "!" }] } }], usageMetadata: { promptTokenCount: 5 } },
        ]),
      },
      durationMs: 1200,
      timestamp: "2026-02-11T00:00:00.000Z",
    };

    const fetchCalls: { url: string; init: RequestInit }[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: url.toString(), init: init! });
      return new Response('{"id": 1}', { status: 200 });
    };

    await sendToCoolhand(geminiInteraction, { apiKey: "test-key", silent: true });

    globalThis.fetch = origFetch;

    const body = JSON.parse(fetchCalls[0]!.init.body as string);
    const responseBody = body.llm_request_log.raw_request.response_body;

    // Should be a newline-delimited string, not an array
    assert.equal(typeof responseBody, "string");
    const lines = responseBody.split("\n");
    assert.equal(lines.length, 2);
    assert.deepEqual(JSON.parse(lines[0]), { candidates: [{ content: { parts: [{ text: "Hi" }] } }] });
    assert.deepEqual(JSON.parse(lines[1]), { candidates: [{ content: { parts: [{ text: "!" }] } }], usageMetadata: { promptTokenCount: 5 } });
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

  it("uses custom API endpoint when provided", async () => {
    const fetchCalls: { url: string }[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request) => {
      fetchCalls.push({ url: url.toString() });
      return new Response('{"id": 1}', { status: 200 });
    };

    await sendToCoolhand(sampleInteraction, {
      apiKey: "test-key",
      apiEndpoint: "https://custom.example.com/api/logs",
      silent: true,
    });

    globalThis.fetch = origFetch;

    assert.equal(fetchCalls[0]!.url, "https://custom.example.com/api/logs");
  });

  it("handles network failure gracefully", async () => {
    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));

    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("ECONNREFUSED"); };

    await sendToCoolhand(sampleInteraction, { apiKey: "test-key" });

    globalThis.fetch = origFetch;
    console.error = origError;

    assert.ok(errors.some((e) => e.includes("Failed to send")));
  });

  it("logs captured URL to stderr in non-silent mode", async () => {
    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));

    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('{"id": 1}', { status: 200 });

    await sendToCoolhand(sampleInteraction, {
      apiKey: "test-key",
      silent: false,
    });

    globalThis.fetch = origFetch;
    console.error = origError;

    assert.ok(errors.some((e) => e.includes("Logged") && e.includes("api.openai.com")));
  });

  it("handles undefined request and response bodies", async () => {
    const interaction: CapturedInteraction = {
      request: {
        method: "GET",
        url: "https://api.openai.com/v1/models",
        headers: {},
        body: undefined,
      },
      response: {
        statusCode: 200,
        headers: {},
        body: undefined,
      },
      durationMs: 100,
      timestamp: "2026-02-11T00:00:00.000Z",
    };

    const fetchCalls: { init: RequestInit }[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ init: init! });
      return new Response('{"id": 1}', { status: 200 });
    };

    await sendToCoolhand(interaction, { apiKey: "test-key", silent: true });

    globalThis.fetch = origFetch;

    const body = JSON.parse(fetchCalls[0]!.init.body as string);
    assert.equal(body.llm_request_log.raw_request.request_body, null);
    assert.equal(body.llm_request_log.raw_request.response_body, null);
  });
});
