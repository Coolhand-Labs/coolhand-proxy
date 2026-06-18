import * as os from "node:os";
import * as path from "node:path";

/** launchd service label — also the plist basename. */
export const SERVICE_LABEL = "com.coolhandlabs.proxy";

/**
 * Fixed localhost port the daemon listens on. Must be stable so the macOS
 * system proxy can keep pointing at it across reboots. Chosen high/uncommon
 * to minimise the chance of colliding with another local service.
 */
export const PROXY_PORT = 47821;

/** System-wide LaunchDaemon plist location (root-owned). */
export const PLIST_PATH = `/Library/LaunchDaemons/${SERVICE_LABEL}.plist`;

/** macOS system keychain — where a system-wide trusted root must live. */
export const SYSTEM_KEYCHAIN = "/Library/Keychains/System.keychain";

export interface DaemonPaths {
  readonly certDir: string;
  readonly logFile: string;
}

/**
 * Resolve the on-disk locations the daemon reads/writes. Computed from a home
 * directory so install-time and runtime agree: we pass `--cert-dir` explicitly
 * into the daemon rather than relying on root's $HOME (which is /var/root and
 * may differ from the installing user's home).
 */
export function getDaemonPaths(homeDir: string = os.homedir()): DaemonPaths {
  const certDir = path.join(homeDir, ".coolhand-proxy");
  return { certDir, logFile: path.join(certDir, "daemon.log") };
}
