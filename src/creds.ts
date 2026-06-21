import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

interface CoolhandConfig {
  version: number;
  default_client_id?: string;
  clients?: Record<string, { api_key?: string }>;
}

/**
 * Resolves the real user's home directory, handling sudo on macOS.
 * Under sudo, os.homedir() returns /var/root; SUDO_USER gives the real user.
 */
export function resolveHomeDir(): string {
  const sudoUser = process.env["SUDO_USER"];
  if (sudoUser) return join("/Users", sudoUser);
  return homedir();
}

/**
 * Resolves the coolhand-cli config directory, handling the case where the
 * process is running under sudo (SUDO_USER points to the real user on macOS).
 */
export function resolveConfigDir(): string {
  if (process.env["COOLHAND_CONFIG_DIR"]) return process.env["COOLHAND_CONFIG_DIR"];
  return join(resolveHomeDir(), ".coolhand");
}

export async function loadApiKey(): Promise<string | undefined> {
  if (process.env["COOLHAND_API_KEY"]) return process.env["COOLHAND_API_KEY"];
  try {
    const raw = await readFile(join(resolveConfigDir(), "config.json"), "utf8");
    const cfg: CoolhandConfig = JSON.parse(raw);
    const id = cfg.default_client_id;
    return (id && cfg.clients?.[id]?.api_key) || undefined;
  } catch {
    return undefined;
  }
}
