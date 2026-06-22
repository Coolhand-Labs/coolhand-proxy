import * as fs from "node:fs";
import * as path from "node:path";
import { ENV_AGENT_LABEL, PROXY_PORT, getEnvAgentPlistPath } from "./constants.ts";
import { run, type CommandSpec, type Executor } from "./exec.ts";

const PROXY_URL = `http://127.0.0.1:${PROXY_PORT}`;

/**
 * The env vars this agent sets and unsets. Together they route HTTP/HTTPS
 * traffic through the proxy and trust the CA cert for Node.js, Python, and
 * any runtime that respects SSL_CERT_FILE.
 */
export const PROXY_ENV_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "SSL_CERT_FILE",
  "NODE_EXTRA_CA_CERTS",
  "REQUESTS_CA_BUNDLE",
] as const;

export function buildProxyEnv(certPath: string): Record<string, string> {
  return {
    HTTP_PROXY: PROXY_URL,
    HTTPS_PROXY: PROXY_URL,
    SSL_CERT_FILE: certPath,
    NODE_EXTRA_CA_CERTS: certPath,
    REQUESTS_CA_BUNDLE: certPath,
  };
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate a LaunchAgent plist whose sole job is to call `launchctl setenv`
 * for each proxy var when the user logs in. Because the agent runs in the
 * user's GUI session (not as root), the vars land in the user's launchd
 * domain and are inherited by every subsequent process — including CLI tools
 * like `claude`, `curl`, and `python` that ignore the macOS system proxy.
 *
 * RunAtLoad fires the commands immediately when the agent is bootstrapped,
 * so there's no need to log out after `coolhand-proxy install`.
 */
export function generateEnvAgentPlist(vars: Record<string, string>): string {
  const setenvCmds = Object.entries(vars)
    .map(([k, v]) => `launchctl setenv ${k} "${v}"`)
    .join("; ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(ENV_AGENT_LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>${xmlEscape(setenvCmds)}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
`;
}

/** `launchctl bootstrap gui/<uid> <plist>` — load agent into user session. */
export function buildAgentBootstrapSpec(uid: number, plistPath: string): CommandSpec {
  return { file: "launchctl", args: ["bootstrap", `gui/${uid}`, plistPath] };
}

/** `launchctl bootout gui/<uid>/<label>` — remove agent from user session. */
export function buildAgentBootoutSpec(uid: number, label: string = ENV_AGENT_LABEL): CommandSpec {
  return { file: "launchctl", args: ["bootout", `gui/${uid}/${label}`] };
}

/** `launchctl asuser <uid> launchctl unsetenv KEY` — remove var from user domain. */
export function buildAsUserUnsetenvSpec(uid: number, key: string): CommandSpec {
  return { file: "launchctl", args: ["asuser", String(uid), "launchctl", "unsetenv", key] };
}

/** Resolve the real (non-root) user's numeric UID, accounting for sudo. */
export async function resolveUserId(exec: Executor = run): Promise<number> {
  const sudoUser = process.env["SUDO_USER"];
  if (sudoUser) {
    const { stdout } = await exec({ file: "id", args: ["-u", sudoUser] });
    return parseInt(stdout.trim(), 10);
  }
  return process.getuid?.() ?? 0;
}

/**
 * Install the env-propagation LaunchAgent:
 *   1. Write the plist to ~/Library/LaunchAgents/
 *   2. chown it to the real user (when running under sudo)
 *   3. Bootstrap it into the user's GUI session — RunAtLoad fires immediately,
 *      setting the proxy env vars without requiring a logout
 */
export async function installEnvAgent(
  homeDir: string,
  certPath: string,
  uid: number,
  sudoUser: string | undefined,
  exec: Executor = run,
): Promise<void> {
  const plistPath = getEnvAgentPlistPath(homeDir);
  const vars = buildProxyEnv(certPath);

  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.writeFileSync(plistPath, generateEnvAgentPlist(vars), { mode: 0o644 });

  if (sudoUser) {
    await exec({ file: "chown", args: [sudoUser, plistPath] });
  }

  // Idempotent: remove any prior version before loading the new one
  await exec(buildAgentBootoutSpec(uid)).catch(() => {});
  await exec(buildAgentBootstrapSpec(uid, plistPath));
}

/**
 * Reverse installEnvAgent: bootout the agent, delete the plist, and clear
 * the env vars from the user's live launchd session.
 */
export async function uninstallEnvAgent(
  homeDir: string,
  uid: number,
  exec: Executor = run,
): Promise<void> {
  await exec(buildAgentBootoutSpec(uid)).catch(() => {});

  const plistPath = getEnvAgentPlistPath(homeDir);
  fs.rmSync(plistPath, { force: true });

  for (const key of PROXY_ENV_KEYS) {
    await exec(buildAsUserUnsetenvSpec(uid, key)).catch(() => {});
  }
}
