import { run, type CommandSpec, type Executor } from "./exec.ts";

export interface ProxySetting {
  readonly enabled: boolean;
  readonly server: string;
  readonly port: number;
}

/**
 * Parse `networksetup -listallnetworkservices`. The first line is a human note
 * ("An asterisk (*) denotes that a network service is disabled."), and disabled
 * services are prefixed with "*". We return only the enabled service names.
 */
export function parseNetworkServices(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .filter((line) => !line.toLowerCase().includes("asterisk"))
    .filter((line) => !line.startsWith("*"));
}

/**
 * Parse `networksetup -getwebproxy "<service>"`, e.g.:
 *   Enabled: Yes
 *   Server: 127.0.0.1
 *   Port: 47821
 */
export function parseGetWebProxy(raw: string): ProxySetting {
  const enabled = /^Enabled:\s*Yes/im.test(raw);
  const server = raw.match(/^Server:[ \t]*(.*)$/im)?.[1]?.trim() ?? "";
  const port = Number(raw.match(/^Port:\s*(\d+)/im)?.[1] ?? 0);
  return { enabled, server, port };
}

export function buildListServicesSpec(): CommandSpec {
  return { file: "networksetup", args: ["-listallnetworkservices"] };
}

export function buildSetWebProxySpec(service: string, host: string, port: number): CommandSpec {
  return { file: "networksetup", args: ["-setwebproxy", service, host, String(port)] };
}

export function buildSetSecureWebProxySpec(service: string, host: string, port: number): CommandSpec {
  return { file: "networksetup", args: ["-setsecurewebproxy", service, host, String(port)] };
}

export function buildSetWebProxyStateSpec(service: string, on: boolean): CommandSpec {
  return { file: "networksetup", args: ["-setwebproxystate", service, on ? "on" : "off"] };
}

export function buildSetSecureWebProxyStateSpec(service: string, on: boolean): CommandSpec {
  return { file: "networksetup", args: ["-setsecurewebproxystate", service, on ? "on" : "off"] };
}

export function buildGetWebProxySpec(service: string): CommandSpec {
  return { file: "networksetup", args: ["-getwebproxy", service] };
}

/** Enabled network service names on this machine. */
export async function listActiveServices(exec: Executor = run): Promise<string[]> {
  const { stdout } = await exec(buildListServicesSpec());
  return parseNetworkServices(stdout);
}

/** Point a service's HTTP + HTTPS proxy at host:port and turn both on. */
export async function enableProxy(
  service: string,
  host: string,
  port: number,
  exec: Executor = run,
): Promise<void> {
  await exec(buildSetWebProxySpec(service, host, port));
  await exec(buildSetSecureWebProxySpec(service, host, port));
  await exec(buildSetWebProxyStateSpec(service, true));
  await exec(buildSetSecureWebProxyStateSpec(service, true));
}

/** Turn a service's HTTP + HTTPS proxy off (leaves the host:port values set). */
export async function disableProxy(service: string, exec: Executor = run): Promise<void> {
  await exec(buildSetWebProxyStateSpec(service, false));
  await exec(buildSetSecureWebProxyStateSpec(service, false));
}

/** Current HTTP proxy setting for a service. */
export async function getProxy(service: string, exec: Executor = run): Promise<ProxySetting> {
  const { stdout } = await exec(buildGetWebProxySpec(service));
  return parseGetWebProxy(stdout);
}
