import { X509Certificate } from "node:crypto";
import { SYSTEM_KEYCHAIN } from "./constants.ts";
import { run, type CommandSpec, type Executor } from "./exec.ts";

/**
 * SHA-1 fingerprint of a PEM certificate, as 40 uppercase hex chars (no
 * colons) — the form `security delete-certificate -Z` and `find-certificate -Z`
 * expect. We identify our CA by hash rather than common name so removal and
 * status checks don't depend on whatever subject mockttp happened to generate.
 */
export function fingerprintSha1(pemCert: string): string {
  return new X509Certificate(pemCert).fingerprint.replace(/:/g, "").toUpperCase();
}

/**
 * `security add-trusted-cert -d -r trustRoot -k <keychain> <certPath>`
 * -d = admin (system) domain, -r trustRoot = trust as a root CA. This is the
 * command `install-ca` currently only prints; the daemon EXECUTES it.
 */
export function buildAddTrustedCertSpec(
  certPath: string,
  keychain: string = SYSTEM_KEYCHAIN,
): CommandSpec {
  return {
    file: "security",
    args: ["add-trusted-cert", "-d", "-r", "trustRoot", "-k", keychain, certPath],
  };
}

/** `security delete-certificate -Z <sha1> <keychain>` — remove our CA by hash. */
export function buildDeleteCertSpec(
  sha1: string,
  keychain: string = SYSTEM_KEYCHAIN,
): CommandSpec {
  return { file: "security", args: ["delete-certificate", "-Z", sha1, keychain] };
}

/** `security find-certificate -a -Z <keychain>` — list every cert's SHA-1. */
export function buildListCertHashesSpec(keychain: string = SYSTEM_KEYCHAIN): CommandSpec {
  return { file: "security", args: ["find-certificate", "-a", "-Z", keychain] };
}

/** Trust the CA at certPath system-wide. */
export async function trustCert(
  certPath: string,
  keychain: string = SYSTEM_KEYCHAIN,
  exec: Executor = run,
): Promise<void> {
  await exec(buildAddTrustedCertSpec(certPath, keychain));
}

/** Remove the CA (identified by hash) from the keychain. */
export async function untrustCert(
  sha1: string,
  keychain: string = SYSTEM_KEYCHAIN,
  exec: Executor = run,
): Promise<void> {
  await exec(buildDeleteCertSpec(sha1, keychain));
}

/** True if a cert with the given SHA-1 is present in the keychain. */
export async function isCertPresent(
  sha1: string,
  keychain: string = SYSTEM_KEYCHAIN,
  exec: Executor = run,
): Promise<boolean> {
  const { stdout } = await exec(buildListCertHashesSpec(keychain));
  return stdout.toUpperCase().includes(sha1.toUpperCase());
}
