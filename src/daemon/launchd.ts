import { SERVICE_LABEL } from "./constants.ts";
import { run, type CommandSpec, type Executor } from "./exec.ts";

export interface PlistOptions {
  readonly label: string;
  /** Full argv the daemon runs, e.g. [nodePath, cliJsPath, "start", "--port", ...]. */
  readonly programArguments: readonly string[];
  /** Baked into EnvironmentVariables so the daemon has it with no terminal. */
  readonly apiKey: string;
  /** Combined stdout+stderr log destination. */
  readonly logFile: string;
  readonly runAtLoad?: boolean;
  readonly keepAlive?: boolean;
}

/** Escape the five XML predefined entities for use inside a <string> value. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate the LaunchDaemon plist XML. Pure (string in, string out) so it can
 * be unit-tested without writing to disk. RunAtLoad starts it at boot;
 * KeepAlive restarts it if it ever exits — together: "always on, like malware."
 */
export function generatePlist(opts: PlistOptions): string {
  const { label, programArguments, apiKey, logFile, runAtLoad = true, keepAlive = true } = opts;

  const argEntries = programArguments
    .map((arg) => `    <string>${xmlEscape(arg)}</string>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(label)}</string>
  <key>ProgramArguments</key>
  <array>
${argEntries}
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>COOLHAND_API_KEY</key>
    <string>${xmlEscape(apiKey)}</string>
  </dict>
  <key>RunAtLoad</key>
  <${runAtLoad ? "true" : "false"}/>
  <key>KeepAlive</key>
  <${keepAlive ? "true" : "false"}/>
  <key>StandardOutPath</key>
  <string>${xmlEscape(logFile)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logFile)}</string>
</dict>
</plist>
`;
}

/** `launchctl bootstrap system <plistPath>` — load + start the daemon. */
export function buildBootstrapSpec(plistPath: string): CommandSpec {
  return { file: "launchctl", args: ["bootstrap", "system", plistPath] };
}

/** `launchctl bootout system/<label>` — stop + unload the daemon. */
export function buildBootoutSpec(label: string = SERVICE_LABEL): CommandSpec {
  return { file: "launchctl", args: ["bootout", `system/${label}`] };
}

/** `launchctl print system/<label>` — used by status to see if it's loaded. */
export function buildPrintSpec(label: string = SERVICE_LABEL): CommandSpec {
  return { file: "launchctl", args: ["print", `system/${label}`] };
}

export async function bootstrap(plistPath: string, exec: Executor = run): Promise<void> {
  await exec(buildBootstrapSpec(plistPath));
}

export async function bootout(label: string = SERVICE_LABEL, exec: Executor = run): Promise<void> {
  await exec(buildBootoutSpec(label));
}

/** True if launchd currently knows about our service. */
export async function isLoaded(label: string = SERVICE_LABEL, exec: Executor = run): Promise<boolean> {
  try {
    await exec(buildPrintSpec(label));
    return true;
  } catch {
    return false;
  }
}
