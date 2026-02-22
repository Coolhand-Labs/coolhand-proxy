import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldCapture, sanitizeHeaders, parseBody } from "./interceptor.ts";

describe("shouldCapture", () => {
  it("captures Gemini API URLs", () => {
    assert.equal(
      shouldCapture("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent"),
      true
    );
  });

  it("captures OpenAI API URLs", () => {
    assert.equal(
      shouldCapture("https://api.openai.com/v1/chat/completions"),
      true
    );
  });

  it("captures Anthropic API URLs", () => {
    assert.equal(
      shouldCapture("https://api.anthropic.com/v1/messages"),
      true
    );
  });

  it("does not capture non-LLM URLs", () => {
    assert.equal(shouldCapture("https://httpbin.org/get"), false);
    assert.equal(shouldCapture("https://google.com"), false);
    assert.equal(shouldCapture("https://github.com/api/v3/repos"), false);
  });
});

describe("sanitizeHeaders", () => {
  it("redacts authorization header", () => {
    const result = sanitizeHeaders({ Authorization: "Bearer sk-123", "Content-Type": "application/json" });
    assert.equal(result["Authorization"], "[REDACTED]");
    assert.equal(result["Content-Type"], "application/json");
  });

  it("redacts x-api-key header (case insensitive)", () => {
    const result = sanitizeHeaders({ "x-api-key": "key123" });
    assert.equal(result["x-api-key"], "[REDACTED]");
  });

  it("redacts x-goog-api-key header", () => {
    const result = sanitizeHeaders({ "x-goog-api-key": "AIza..." });
    assert.equal(result["x-goog-api-key"], "[REDACTED]");
  });

  it("passes through non-sensitive headers", () => {
    const result = sanitizeHeaders({ "user-agent": "curl/8.0", accept: "*/*" });
    assert.equal(result["user-agent"], "curl/8.0");
    assert.equal(result["accept"], "*/*");
  });
});

describe("parseBody", () => {
  it("parses valid JSON", () => {
    assert.deepEqual(parseBody('{"key": "value"}'), { key: "value" });
  });

  it("returns raw string for non-JSON", () => {
    assert.equal(parseBody("not json"), "not json");
  });

  it("returns null for null/undefined/empty", () => {
    assert.equal(parseBody(null), null);
    assert.equal(parseBody(undefined), null);
    assert.equal(parseBody(""), null);
  });

  it("normalizes JSON arrays to newline-delimited JSON", () => {
    const input = JSON.stringify([{ a: 1 }, { b: 2 }]);
    const result = parseBody(input) as string;
    const lines = result.split("\n");
    assert.equal(lines.length, 2);
    assert.deepEqual(JSON.parse(lines[0]!), { a: 1 });
    assert.deepEqual(JSON.parse(lines[1]!), { b: 2 });
  });
});

describe("sanitizeHeaders (additional keys)", () => {
  it("redacts cookie header", () => {
    const result = sanitizeHeaders({ cookie: "session=abc123" });
    assert.equal(result["cookie"], "[REDACTED]");
  });

  it("redacts openai-api-key header", () => {
    const result = sanitizeHeaders({ "openai-api-key": "sk-..." });
    assert.equal(result["openai-api-key"], "[REDACTED]");
  });
});
