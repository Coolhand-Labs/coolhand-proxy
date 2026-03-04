# v0.0.1 Release Notes

## 🚀 What's New

Initial release of `coolhand-proxy` — an HTTPS MITM proxy that captures LLM API calls from any language or runtime and forwards them to [Coolhand](https://coolhandlabs.com) for monitoring and analysis. No SDK integration or code changes required.

---

## 🎯 Core Features

### `wrap` — Zero-Config Process Monitoring (Recommended)

The `wrap` command is the fastest path to LLM observability. It starts the proxy, injects all required environment variables into the target process, and tears everything down cleanly on exit.

```bash
export COOLHAND_API_KEY=your_api_key_here

coolhand-proxy wrap -- node server.js
coolhand-proxy wrap -- python app.py
coolhand-proxy wrap -- npm start
```

The wrapped process automatically trusts the proxy CA and routes all outbound traffic through it. No changes to your application code are needed.

### `start` — Daemon Mode

For cases where you need to manage the proxy lifecycle independently — background services, containers, or process supervisors — `start` runs the proxy and emits a single JSON line to stdout when it is ready to accept connections.

```bash
coolhand-proxy start --silent
# {"status":"ready","port":52341,"certPath":"/Users/you/.coolhand-proxy/ca-cert.pem"}
```

Parse the JSON output to configure your application process:

```bash
PROXY_INFO=$(coolhand-proxy start --silent &)
PORT=$(echo $PROXY_INFO | jq -r '.port')
CERT=$(echo $PROXY_INFO | jq -r '.certPath')

HTTP_PROXY=http://127.0.0.1:$PORT \
HTTPS_PROXY=http://127.0.0.1:$PORT \
SSL_CERT_FILE=$CERT \
NODE_EXTRA_CA_CERTS=$CERT \
  node my-app.js
```

### `install-ca` — Certificate Setup

Generates a CA certificate and key in `~/.coolhand-proxy` and prints the certificate path. Run this once; the certificate is reused on subsequent invocations.

```bash
coolhand-proxy install-ca
# CA certificate written to /Users/you/.coolhand-proxy/ca-cert.pem
```

---

## ⚙️ LLM Provider Detection

`coolhand-proxy` uses `coolhand-node`'s `PatternMatchingService` to identify LLM API traffic. Only requests to recognized providers are captured and forwarded — all other HTTPS traffic passes through the proxy untouched.

Supported providers at launch:

| Provider | Domain |
|----------|--------|
| OpenAI | `api.openai.com` |
| Anthropic | `api.anthropic.com` |
| Google AI (Gemini) | `generativelanguage.googleapis.com` |
| Google AI (Vertex) | `*.googleapis.com` (Vertex endpoints) |
| Cohere | `api.cohere.ai` |
| Hugging Face | `api-inference.huggingface.co` |

---

## 🔒 Security

Before any data is sent to Coolhand, the proxy redacts the following headers from both the request log and the forwarded payload:

- `authorization`
- `x-api-key`
- `x-goog-api-key`
- `openai-api-key`
- `api-key`
- `cookie`

The CA private key is stored at `~/.coolhand-proxy/ca-key.pem` with mode `0600` (owner read/write only).

---

## 📋 Requirements

- Node.js >= 18
- `COOLHAND_API_KEY` environment variable (omit when using `--debug` for local-only capture)
