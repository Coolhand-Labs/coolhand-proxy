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

### Option 3: System-wide background daemon (macOS)

For non-technical users, `install` sets up the proxy as an always-on background
service that captures LLM traffic across the whole machine — no env vars, no wrapping,
survives reboots. It requires `sudo` (it trusts the CA in the System keychain, registers
a LaunchDaemon, and points the system network proxy at itself).

```bash
coolhand login             # store credentials once (reads from ~/.coolhand/config.json)
sudo coolhand-proxy install
coolhand-proxy status      # check it's running and the proxy is pointed at us
sudo coolhand-proxy uninstall   # fully revert
```

> macOS only for now. GUI/Electron AI apps honor the system proxy; CLI tools are also
> covered via machine-level `HTTP_PROXY`/`HTTPS_PROXY`. Apps that pin certificates or
> ignore the system proxy are not captured.

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

### `coolhand-proxy install` (macOS)

Installs the proxy as an always-on background daemon: trusts the CA in the System
keychain, writes a LaunchDaemon (`/Library/LaunchDaemons/com.coolhandlabs.proxy.plist`)
that starts at boot and restarts on failure, and points the system network proxy at the
local daemon. Requires `sudo`.

```bash
sudo coolhand-proxy install
```

The API key is read automatically from the credentials stored by `coolhand login`
(`~/.coolhand/config.json`). The config file path is baked into the daemon so key
rotations via `coolhand login` take effect on the next daemon restart with no reinstall
needed.

### `coolhand-proxy uninstall` (macOS)

Reverses `install`: turns off the system proxy on each network service, unloads and
removes the LaunchDaemon, and removes the trusted CA from the keychain. Requires `sudo`.

```bash
sudo coolhand-proxy uninstall
```

### `coolhand-proxy status` (macOS)

Reports whether the daemon is loaded, whether the CA is trusted, and whether each network
service's proxy is pointed at the daemon.

```bash
coolhand-proxy status
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
