import * as fs from "node:fs";
import { getCertPath } from "../certs.ts";
import { PLIST_PATH, getDaemonPaths } from "./constants.ts";
import { run } from "./exec.ts";
import { fingerprintSha1, untrustCert } from "./trust-store.ts";
import { bootout } from "./launchd.ts";
import { listActiveServices, disableProxy } from "./system-proxy.ts";
import type { DaemonDeps } from "./install.ts";

/**
 * Reverse everything `install` did. Best-effort and each step independent: one
 * failure (e.g. cert already gone) must not stop the rest from cleaning up.
 */
export async function uninstall(deps: DaemonDeps = {}): Promise<void> {
  const exec = deps.exec ?? run;
  const log = deps.log ?? (() => {});
  const { certDir } = getDaemonPaths();

  log("1/4 Turning off the system proxy on each network service…");
  try {
    const services = await listActiveServices(exec);
    for (const service of services) {
      await disableProxy(service, exec).catch(() => {});
      log(`      • ${service} proxy off`);
    }
  } catch {
    log("      (could not enumerate services — skipping)");
  }

  log("2/4 Stopping and unloading the daemon…");
  await bootout(undefined, exec).catch(() => {});

  log("3/4 Removing the LaunchDaemon plist…");
  try {
    fs.rmSync(PLIST_PATH, { force: true });
  } catch {
    log("      (plist not present)");
  }

  log("4/4 Removing the trusted CA from the keychain…");
  try {
    const certPath = getCertPath(certDir);
    const pem = fs.readFileSync(certPath, "utf8");
    await untrustCert(fingerprintSha1(pem), undefined, exec);
  } catch {
    log("      (cert not present or already removed)");
  }

  log("Done. System proxy reverted and daemon removed.");
}
