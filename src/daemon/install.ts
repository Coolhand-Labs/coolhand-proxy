import * as fs from "node:fs";
import * as path from "node:path";
import { getOrCreateCA, getCertPath } from "../certs.ts";
import { PLIST_PATH, PROXY_PORT, SERVICE_LABEL, getDaemonPaths } from "./constants.ts";
import { run, type Executor } from "./exec.ts";
import { trustCert } from "./trust-store.ts";
import { generatePlist, bootstrap, bootout } from "./launchd.ts";
import { listActiveServices, enableProxy } from "./system-proxy.ts";

export interface DaemonDeps {
  readonly exec?: Executor;
  readonly log?: (msg: string) => void;
}

const LOCALHOST = "127.0.0.1";

/**
 * The argv launchd runs at boot: the current node binary, this package's
 * compiled CLI, then `start` with a fixed port + the explicit cert dir so the
 * daemon and installer agree regardless of root's $HOME.
 */
export function defaultProgramArguments(certDir: string): string[] {
  const cliJs = path.join(import.meta.dirname, "cli.js");
  return [
    process.execPath,
    cliJs,
    "start",
    "--port",
    String(PROXY_PORT),
    "--silent",
    "--cert-dir",
    certDir,
  ];
}

/**
 * Set up the always-on background daemon. Requires sudo (keychain + launchd +
 * networksetup are all privileged). Idempotent: re-running re-trusts the cert,
 * rewrites the plist, reloads the service, and re-points every network service.
 */
export async function install(configDir: string, deps: DaemonDeps = {}): Promise<void> {
  const exec = deps.exec ?? run;
  const log = deps.log ?? (() => {});
  const { certDir, logFile } = getDaemonPaths();

  log("1/5 Ensuring CA certificate exists…");
  await getOrCreateCA(certDir);
  const certPath = getCertPath(certDir);

  log("2/5 Trusting CA in the System keychain…");
  await trustCert(certPath, undefined, exec);

  log("3/5 Writing LaunchDaemon plist…");
  const plist = generatePlist({
    label: SERVICE_LABEL,
    programArguments: defaultProgramArguments(certDir),
    configDir,
    logFile,
  });
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(PLIST_PATH, plist, { mode: 0o644 });

  log("4/5 Loading the daemon (launchctl bootstrap)…");
  // Best-effort unload first so a re-install doesn't fail on "already loaded".
  await bootout(undefined, exec).catch(() => {});
  await bootstrap(PLIST_PATH, exec);

  log("5/5 Pointing system network services at the proxy…");
  const services = await listActiveServices(exec);
  for (const service of services) {
    await enableProxy(service, LOCALHOST, PROXY_PORT, exec);
    log(`      • ${service} → ${LOCALHOST}:${PROXY_PORT}`);
  }

  log("Done. The proxy is running and will restart on boot.");
}
