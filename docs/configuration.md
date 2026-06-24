# Configuration Reference

## Proxy options

### `coolhand-proxy wrap`

```
coolhand-proxy wrap [options] -- <command> [args...]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <port>` | `0` (auto) | Port for the proxy to listen on. `0` picks a random available port. |
| `--cert-dir <dir>` | `~/.coolhand-proxy` | Directory to store the CA certificate and key. |
| `--api-endpoint <url>` | Coolhand default | Override the Coolhand API endpoint (for self-hosted deployments). |
| `--debug` | `false` | Log captured payloads locally; do not forward to the Coolhand API. |
| `--silent` | `false` | Suppress proxy log output. |

### `coolhand-proxy start`

```
coolhand-proxy start [options]
```

Accepts the same options as `wrap`.

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <port>` | `0` (auto) | Port for the proxy to listen on. |
| `--cert-dir <dir>` | `~/.coolhand-proxy` | Directory to store the CA certificate and key. |
| `--api-endpoint <url>` | Coolhand default | Override the Coolhand API endpoint. |
| `--debug` | `false` | Log captured payloads locally; do not forward to the Coolhand API. |
| `--silent` | `false` | Suppress proxy log output. In silent mode, non-JSON output goes to stderr to keep stdout clean for the readiness line. |

Outputs a single JSON line to stdout when ready:

```json
{"port":52341,"pid":12345,"certPath":"/Users/you/.coolhand-proxy/ca-cert.pem","httpProxy":"http://127.0.0.1:52341"}
```

### `coolhand-proxy install-ca`

```
coolhand-proxy install-ca [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cert-dir <dir>` | `~/.coolhand-proxy` | Directory to store the CA certificate and key. |

---

## CA Certificate

`coolhand-proxy` generates a local CA certificate on first use to decrypt HTTPS traffic for inspection. The certificate and key are stored in `~/.coolhand-proxy/` (or the directory set by `--cert-dir`).

### Auto-injected environment variables

The `wrap` command automatically sets these variables in the subprocess environment so Node.js, Python, and Ruby processes trust the proxy certificate without any manual configuration:

| Variable | Value |
|----------|-------|
| `SSL_CERT_FILE` | Path to `ca-cert.pem` |
| `NODE_EXTRA_CA_CERTS` | Path to `ca-cert.pem` |
| `REQUESTS_CA_BUNDLE` | Path to `ca-cert.pem` |

### System-level trust

To trust the certificate system-wide — required for runtimes other than Node.js and Python, or when using daemon mode (`start`) without `wrap`:

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

**Other platforms:** Import `~/.coolhand-proxy/ca-cert.pem` into your system certificate store.

---

## Self-Hosted Endpoint

If you run your own Coolhand-compatible backend (for compliance or data-residency requirements), point the proxy at your host with `--api-endpoint`:

```bash
# wrap
coolhand-proxy wrap --api-endpoint https://feedback.example.com -- node my-app.js

# daemon mode
coolhand-proxy start --api-endpoint https://feedback.example.com
```
