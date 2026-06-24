import * as fs from "node:fs";
import { getCertPath } from "../certs.ts";
import { resolveHomeDir } from "../creds.ts";
import { PROXY_PORT, getDaemonPaths, getEnvAgentPlistPath } from "./constants.ts";
import { getShellProfilePath } from "./shell-profile.ts";
import { run, type Executor } from "./exec.ts";
import { fingerprintSha1, isCertPresent } from "./trust-store.ts";
import { isLoaded } from "./launchd.ts";
import { listActiveServices, getProxy } from "./system-proxy.ts";
import type { DaemonDeps } from "./install.ts";

export interface ServiceProxyStatus {
  readonly name: string;
  readonly enabled: boolean;
  readonly server: string;
  readonly port: number;
}

export interface DaemonStatus {
  readonly daemonLoaded: boolean;
  readonly certTrusted: boolean;
  readonly services: readonly ServiceProxyStatus[];
  /** Whether the CLI env-var LaunchAgent plist is present on disk. */
  readonly envAgentInstalled: boolean;
  /** Whether ~/.zprofile contains the proxy env-var block. */
  readonly shellProfileInstalled: boolean;
}

/** Gather a full picture of whether the daemon is installed and active. */
export async function getStatus(deps: DaemonDeps = {}): Promise<DaemonStatus> {
  const exec: Executor = deps.exec ?? run;
  const { certDir } = getDaemonPaths(resolveHomeDir());

  const daemonLoaded = await isLoaded(undefined, exec);

  let certTrusted = false;
  try {
    const pem = fs.readFileSync(getCertPath(certDir), "utf8");
    certTrusted = await isCertPresent(fingerprintSha1(pem), undefined, exec);
  } catch {
    certTrusted = false;
  }

  const services: ServiceProxyStatus[] = [];
  try {
    for (const name of await listActiveServices(exec)) {
      const s = await getProxy(name, exec);
      services.push({ name, enabled: s.enabled, server: s.server, port: s.port });
    }
  } catch {
    // leave services empty if enumeration fails
  }

  const homeDir = resolveHomeDir();
  const envAgentInstalled = fs.existsSync(getEnvAgentPlistPath(homeDir));
  const shellProfileInstalled = (() => {
    try {
      return fs.readFileSync(getShellProfilePath(homeDir), "utf8").includes("# >>> coolhand-proxy begin >>>");
    } catch {
      return false;
    }
  })();

  return { daemonLoaded, certTrusted, services, envAgentInstalled, shellProfileInstalled };
}

/** Human-readable one-screen status report. */
export function formatStatus(status: DaemonStatus): string {
  const yn = (b: boolean) => (b ? "yes" : "no");
  const lines = [
    `Daemon loaded:  ${yn(status.daemonLoaded)}`,
    `CA trusted:     ${yn(status.certTrusted)}`,
    `CLI env agent:  ${yn(status.envAgentInstalled)}`,
    `Shell profile:  ${yn(status.shellProfileInstalled)}`,
    `Expected port:  ${PROXY_PORT}`,
    "Network services:",
  ];
  if (status.services.length === 0) {
    lines.push("  (none found)");
  } else {
    for (const s of status.services) {
      const pointed = s.enabled && s.server === "127.0.0.1" && s.port === PROXY_PORT;
      lines.push(`  • ${s.name}: proxy ${s.enabled ? "on" : "off"} ${s.server}:${s.port} ${pointed ? "✓" : ""}`.trimEnd());
    }
  }
  return lines.join("\n");
}
