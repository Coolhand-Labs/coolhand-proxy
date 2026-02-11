#!/usr/bin/env bash
#
# Install coolhand-proxy CA certificate into the system trust store.
# Run after 'coolhand-proxy install-ca' has generated the cert.
#
# Usage: sudo ./install-ca.sh [cert-dir]
#
set -euo pipefail

CERT_DIR="${1:-$HOME/.coolhand-proxy}"
CERT_FILE="$CERT_DIR/ca-cert.pem"

if [ ! -f "$CERT_FILE" ]; then
    echo "[coolhand-proxy] CA cert not found at $CERT_FILE"
    echo "[coolhand-proxy] Run 'coolhand-proxy install-ca' first to generate it."
    exit 1
fi

if [ "$(uname)" = "Darwin" ]; then
    sudo security add-trusted-cert -d -r trustRoot \
        -k /Library/Keychains/System.keychain "$CERT_FILE"
    echo "[coolhand-proxy] CA cert installed in macOS System Keychain"
elif [ -f /etc/debian_version ] || [ -f /etc/lsb-release ]; then
    cp "$CERT_FILE" /usr/local/share/ca-certificates/coolhand-proxy.crt
    update-ca-certificates
    echo "[coolhand-proxy] CA cert installed via update-ca-certificates"
elif [ -f /etc/redhat-release ]; then
    cp "$CERT_FILE" /etc/pki/ca-trust/source/anchors/coolhand-proxy.pem
    update-ca-trust extract
    echo "[coolhand-proxy] CA cert installed via update-ca-trust"
else
    echo "[coolhand-proxy] Unknown OS. Manually install: $CERT_FILE"
    exit 1
fi

# Append to certifi bundle if Python is available (for Python HTTP clients)
CERTIFI_BUNDLE=$(python3 -c "import certifi; print(certifi.where())" 2>/dev/null || true)
if [ -n "$CERTIFI_BUNDLE" ] && [ -f "$CERTIFI_BUNDLE" ]; then
    cat "$CERT_FILE" >> "$CERTIFI_BUNDLE"
    echo "[coolhand-proxy] Appended CA cert to certifi bundle: $CERTIFI_BUNDLE"
fi

echo "[coolhand-proxy] CA cert installation complete"
