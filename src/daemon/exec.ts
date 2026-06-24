import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * A command to run: an executable plus its argument vector. Deliberately NOT a
 * shell string — we always invoke via execFile (no shell) so there is no shell
 * injection surface even when arguments contain paths with spaces.
 */
export interface CommandSpec {
  readonly file: string;
  readonly args: readonly string[];
}

export interface ExecResult {
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Executor function shape. Action functions take one of these (defaulting to
 * the real `run` below) so tests can inject a fake that records calls instead
 * of touching the real system.
 */
export type Executor = (spec: CommandSpec) => Promise<ExecResult>;

/**
 * Run a command without a shell. On failure, throws an Error that includes the
 * command, its arguments, and whatever the process wrote to stderr/stdout so
 * the caller (and the user) can see exactly what went wrong.
 */
export const run: Executor = async (spec) => {
  try {
    const { stdout, stderr } = await execFileAsync(spec.file, [...spec.args]);
    return { stdout, stderr };
  } catch (err) {
    const e = err as Error & { stderr?: string; stdout?: string };
    const detail = (e.stderr || e.stdout || e.message || "").toString().trim();
    throw new Error(`Command failed: ${spec.file} ${spec.args.join(" ")}\n${detail}`);
  }
};
