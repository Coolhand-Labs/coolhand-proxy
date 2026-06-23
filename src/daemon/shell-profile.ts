import * as fs from "node:fs";
import * as path from "node:path";
import { PROXY_PORT } from "./constants.ts";

const PROXY_URL = `http://127.0.0.1:${PROXY_PORT}`;
const BLOCK_BEGIN = "# >>> coolhand-proxy begin >>>";
const BLOCK_END = "# <<< coolhand-proxy end <<<";

export function getShellProfilePath(homeDir: string): string {
  return path.join(homeDir, ".zprofile");
}

export function generateShellBlock(certPath: string): string {
  return [
    BLOCK_BEGIN,
    `export HTTP_PROXY=${PROXY_URL}`,
    `export HTTPS_PROXY=${PROXY_URL}`,
    `export SSL_CERT_FILE=${certPath}`,
    `export NODE_EXTRA_CA_CERTS=${certPath}`,
    `export REQUESTS_CA_BUNDLE=${certPath}`,
    BLOCK_END,
  ].join("\n");
}

/** Insert or replace the proxy block in ~/.zprofile. Pure string in, string out. */
export function applyShellBlock(existing: string, certPath: string): string {
  const block = generateShellBlock(certPath);
  if (existing.includes(BLOCK_BEGIN)) {
    return existing.replace(
      new RegExp(`${escapeRegex(BLOCK_BEGIN)}[\\s\\S]*?${escapeRegex(BLOCK_END)}`),
      block,
    );
  }
  const sep = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  return `${existing}${sep}\n${block}\n`;
}

/** Remove the proxy block from ~/.zprofile content. Pure string in, string out. */
export function removeShellBlock(existing: string): string {
  return existing.replace(
    new RegExp(`\\n?${escapeRegex(BLOCK_BEGIN)}[\\s\\S]*?${escapeRegex(BLOCK_END)}\\n?`),
    "",
  );
}

/** Write the proxy env-var block into the user's ~/.zprofile. */
export function writeShellProfile(homeDir: string, certPath: string): void {
  const profilePath = getShellProfilePath(homeDir);
  let existing = "";
  try {
    existing = fs.readFileSync(profilePath, "utf8");
  } catch {
    // file doesn't exist yet — will be created
  }
  fs.writeFileSync(profilePath, applyShellBlock(existing, certPath), "utf8");
}

/** Remove the proxy env-var block from the user's ~/.zprofile. */
export function removeFromShellProfile(homeDir: string): void {
  const profilePath = getShellProfilePath(homeDir);
  let existing: string;
  try {
    existing = fs.readFileSync(profilePath, "utf8");
  } catch {
    return;
  }
  if (!existing.includes(BLOCK_BEGIN)) return;
  fs.writeFileSync(profilePath, removeShellBlock(existing), "utf8");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
