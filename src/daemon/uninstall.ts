import * as fs from "node:fs";
import { getCertPath } from "../certs.ts";
import { resolveHomeDir } from "../creds.ts";
import { PLIST_PATH, getDaemonPaths } from "./constants.ts";
import { run } from "./exec.ts";
import { fingerprintSha1, untrustCert } from "./trust-store.ts";
import { bootout } from "./launchd.ts";
import { listActiveServices, disableProxy } from "./system-proxy.ts";
import { uninstallEnvAgent, resolveUserId } from "./env-agent.ts";
import type { DaemonDeps } from "./install.ts";

/**
 * Reverse everything `install` did. Best-effort and each step independent: one
 * failure (e.g. cert already gone) must not stop the rest from cleaning up.
 */
export async function uninstall(deps: DaemonDeps = {}): Promise<void> {
  const exec = deps.exec ?? run;
  const log = deps.log ?? (() => {});
  const { certDir } = getDaemonPaths(resolveHomeDir());

  log("1/5 Turning off the system proxy on each network service…");
  try {
    const services = await listActiveServices(exec);
    for (const service of services) {
      await disableProxy(service, exec).catch(() => {});
      log(`      • ${service} proxy off`);
    }
  } catch {
    log("      (could not enumerate services — skipping)");
  }

  log("2/5 Stopping and unloading the daemon…");
  await bootout(undefined, exec).catch(() => {});

  log("3/5 Removing the LaunchDaemon plist…");
  try {
    fs.rmSync(PLIST_PATH, { force: true });
  } catch {
    log("      (plist not present)");
  }

  log("4/5 Removing the trusted CA from the keychain…");
  try {
    const certPath = getCertPath(certDir);
    const pem = fs.readFileSync(certPath, "utf8");
    await untrustCert(fingerprintSha1(pem), undefined, exec);
  } catch {
    log("      (cert not present or already removed)");
  }

  log("5/5 Removing the CLI env-var agent…");
  try {
    const uid = await resolveUserId(exec);
    await uninstallEnvAgent(resolveHomeDir(), uid, exec);
  } catch {
    log("      (env agent not present or already removed)");
  }

  log("Done. System proxy reverted and daemon removed.");
}
