# Coolhand Proxy

HTTPS MITM proxy for capturing LLM API calls and forwarding them to the [Coolhand](https://coolhandlabs.com) monitoring platform — no code changes required.

## Related Packages

| Package | Environment | Purpose |
|---------|-------------|---------|
| `coolhand-proxy` | CLI / any language | Language-agnostic proxy for capturing LLM calls at the network level |
| `coolhand-node` | Node.js | SDK-based monitoring and logging of LLM API calls |
| `coolhand` | Browser | Feedback widget for collecting user sentiment on AI outputs |

## Installation

```bash
npm install -g coolhand-proxy
```

Or use without installing:

```bash
npx coolhand-proxy wrap -- node my-app.js
```

## Getting Started

1. **Get API Key**: Visit [coolhandlabs.com](https://coolhandlabs.com/) and get an API key
2. **Install**: `npm install -g coolhand-proxy`
3. **Trust the CA cert**: Run `coolhand-proxy install-ca` once to generate the certificate
4. **Configure**: Set `COOLHAND_API_KEY` in your environment
5. **Run**: Wrap your command with `coolhand-proxy wrap`

## Quick Start

### Option 1: wrap (Recommended)

The `wrap` command starts the proxy, injects the necessary environment variables into your process, and shuts down cleanly when the process exits.

```bash
export COOLHAND_API_KEY=your_api_key_here

# Wrap any command — Node, Python, Ruby, etc.
coolhand-proxy wrap -- node my-app.js
coolhand-proxy wrap -- python main.py
coolhand-proxy wrap -- npm start
```

All LLM API calls made by the wrapped process are automatically captured and sent to Coolhand.

### Option 2: Daemon Mode

Use `start` when you want to run the proxy as a background service and manage the process yourself.

```bash
# Start the proxy — outputs JSON with connection details
coolhand-proxy start
# {"status":"ready","port":52341,"certPath":"/Users/you/.coolhand-proxy/ca-cert.pem"}

# Set these in your application process:
export HTTP_PROXY=http://127.0.0.1:52341
export HTTPS_PROXY=http://127.0.0.1:52341
export SSL_CERT_FILE=/Users/you/.coolhand-proxy/ca-cert.pem
export NODE_EXTRA_CA_CERTS=/Users/you/.coolhand-proxy/ca-cert.pem
```

## Commands

### `coolhand-proxy wrap <command>`

Starts the proxy, runs `<command>` with proxy environment variables injected, and stops the proxy when the command exits.

```bash
coolhand-proxy wrap [options] -- <command> [args...]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <port>` | `0` (auto) | Port for the proxy to listen on |
| `--cert-dir <dir>` | `~/.coolhand-proxy` | Directory to store CA certificate files |
| `--api-endpoint <url>` | Coolhand default | Override the Coolhand API endpoint |
| `--debug` | `false` | Log captured payloads locally; do not send to API |
| `--silent` | `false` | Suppress proxy log output |

### `coolhand-proxy start`

Starts the proxy in daemon mode. Outputs a single JSON line to stdout when ready, then continues running until killed.

```bash
coolhand-proxy start [options]
```

Output:

```json
{"status":"ready","port":52341,"certPath":"/Users/you/.coolhand-proxy/ca-cert.pem"}
```

Accepts the same options as `wrap` (`--port`, `--cert-dir`, `--api-endpoint`, `--debug`, `--silent`).

### `coolhand-proxy install-ca`

Generates a CA certificate and key in `~/.coolhand-proxy` (or `--cert-dir`). Run this once before first use.

```bash
coolhand-proxy install-ca [--cert-dir <dir>]
```

## Configuration

| Environment Variable | Description | Required |
|----------------------|-------------|----------|
| `COOLHAND_API_KEY` | API key for sending captured logs to Coolhand | Yes (unless `--debug`) |

## Certificate Trust

`coolhand-proxy` uses a local CA certificate to decrypt HTTPS traffic. The certificate is generated and stored in `~/.coolhand-proxy/ca-cert.pem` on first use.

The `wrap` command automatically sets `SSL_CERT_FILE`, `NODE_EXTRA_CA_CERTS`, and `REQUESTS_CA_BUNDLE` in the subprocess environment, so Node.js and Python processes trust the proxy out of the box.

For other runtimes or system-level trust, add the CA certificate to your system trust store:

**macOS:**
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain \
  ~/.coolhand-proxy/ca-cert.pem
```

**Linux (Debian/Ubuntu):**
```bash
sudo cp ~/.coolhand-proxy/ca-cert.pem /usr/local/share/ca-certificates/coolhand-proxy.crt
sudo update-ca-certificates
```

## Supported LLM Providers

`coolhand-proxy` automatically detects and captures calls to:

- **OpenAI** — `api.openai.com`
- **Anthropic** — `api.anthropic.com`
- **Google AI** — Gemini (`generativelanguage.googleapis.com`) and Vertex AI
- **Cohere** — `api.cohere.ai`
- **Hugging Face** — `api-inference.huggingface.co`

Traffic to all other domains passes through the proxy without being captured or logged.

## How It Works

1. `coolhand-proxy` starts an HTTPS MITM proxy using [mockttp](https://github.com/httptoolkit/mockttp)
2. Outbound HTTPS requests are intercepted and inspected
3. Requests matching known LLM API patterns are captured; all others pass through untouched
4. Sensitive headers (`authorization`, `x-api-key`, `cookie`, etc.) are redacted before logging
5. Captured request/response pairs (with timing) are forwarded to the Coolhand API

## Requirements

- Node.js >= 18
- `COOLHAND_API_KEY` environment variable
