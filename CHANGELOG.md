# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-03-02

### 🎯 Core Capabilities

- **HTTPS MITM proxy** — intercepts and inspects outbound HTTPS traffic using [mockttp](https://github.com/httptoolkit/mockttp)
- **`wrap` command** — runs any subprocess with proxy environment variables (`HTTP_PROXY`, `HTTPS_PROXY`, `SSL_CERT_FILE`, `NODE_EXTRA_CA_CERTS`, `REQUESTS_CA_BUNDLE`) automatically injected; proxy shuts down cleanly on process exit
- **`start` command** — daemon mode; emits a single JSON readiness line to stdout (`{"status":"ready","port":...,"certPath":"..."}`) then runs until killed
- **`install-ca` command** — generates a persistent CA certificate and key in `~/.coolhand-proxy`; certificate is reused across invocations
- **LLM API filtering** — uses `coolhand-node`'s `PatternMatchingService` to capture only requests to known LLM providers (OpenAI, Anthropic, Google AI, Cohere, Hugging Face); all other traffic passes through unmodified
- **Header sanitization** — redacts sensitive headers (`authorization`, `x-api-key`, `x-goog-api-key`, `api-key`, `openai-api-key`, `cookie`) before forwarding to Coolhand
- **Request/response capture** — records method, URL, headers, body, status code, duration, and timestamp for each LLM API call
- **Coolhand API integration** — POSTs captured interactions to `https://coolhandlabs.com/api/v2/llm_request_logs` using `X-API-Key` authentication
- **`--debug` flag** — logs captured payloads to the console without sending to the Coolhand API; useful for local development
- **`--silent` flag** — suppresses all proxy log output; designed for use with `start` where stdout carries structured JSON

### 🧪 Testing & Development

- Comprehensive test coverage across proxy, interceptor, sender, certificate management, and CLI modules
- TypeScript source with `tsup` build system producing ESM output
- Node.js 18+ support
