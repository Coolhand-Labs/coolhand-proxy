#!/usr/bin/env npx tsx
import { Command } from "commander";
import { spawn } from "child_process";
import { getOrCreateCA, getCertPath, getDefaultCertDir } from "./certs.ts";
import { startProxy } from "./proxy.ts";

const program = new Command();

program
  .name("coolhand-proxy")
  .description("HTTPS MITM proxy for capturing LLM API calls and forwarding to Coolhand")
  .version("0.1.0");

program
  .command("wrap")
  .description("Start proxy, run a command with proxy env, stop proxy when command exits")
  .option("-p, --port <port>", "Proxy listen port (0 = auto)", "0")
  .option("--cert-dir <dir>", "CA certificate directory", getDefaultCertDir())
  .option("--debug", "Debug mode (log payloads, don't send to API)", false)
  .option("--silent", "Suppress proxy log output", false)
  .option("--api-endpoint <url>", "Override Coolhand API endpoint")
  .argument("<command...>", "Command and arguments to run")
  .action(async (commandArgs: string[], opts) => {
    const apiKey = process.env["COOLHAND_API_KEY"];
    if (!apiKey && !opts.debug) {
      console.error("[coolhand-proxy] WARNING: COOLHAND_API_KEY not set. Captured logs will not be forwarded.");
    }

    const ca = await getOrCreateCA(opts.certDir);
    const proxy = await startProxy(ca, {
      port: parseInt(opts.port, 10),
      apiKey: apiKey ?? "",
      apiEndpoint: opts.apiEndpoint,
      silent: opts.silent,
      debug: opts.debug,
    });

    const certPath = getCertPath(opts.certDir);

    const child = spawn(commandArgs[0]!, commandArgs.slice(1), {
      stdio: "inherit",
      env: {
        ...process.env,
        HTTP_PROXY: `http://127.0.0.1:${proxy.port}`,
        HTTPS_PROXY: `http://127.0.0.1:${proxy.port}`,
        // Trust the proxy's CA cert across various runtimes
        SSL_CERT_FILE: certPath,
        NODE_EXTRA_CA_CERTS: certPath,
        REQUESTS_CA_BUNDLE: certPath,
      },
    });

    child.on("close", async (code) => {
      await proxy.stop();
      process.exit(code ?? 1);
    });

    child.on("error", async (err) => {
      console.error(`[coolhand-proxy] Failed to start command: ${err.message}`);
      await proxy.stop();
      process.exit(1);
    });
  });

program
  .command("start")
  .description("Start proxy in daemon mode")
  .option("-p, --port <port>", "Proxy listen port (0 = auto)", "0")
  .option("--cert-dir <dir>", "CA certificate directory", getDefaultCertDir())
  .option("--debug", "Debug mode", false)
  .option("--silent", "Suppress proxy log output", false)
  .option("--api-endpoint <url>", "Override Coolhand API endpoint")
  .action(async (opts) => {
    const apiKey = process.env["COOLHAND_API_KEY"];
    if (!apiKey && !opts.debug) {
      console.error("[coolhand-proxy] WARNING: COOLHAND_API_KEY not set.");
    }

    const ca = await getOrCreateCA(opts.certDir);
    const proxy = await startProxy(ca, {
      port: parseInt(opts.port, 10),
      apiKey: apiKey ?? "",
      apiEndpoint: opts.apiEndpoint,
      silent: opts.silent,
      debug: opts.debug,
    });

    const certPath = getCertPath(opts.certDir);

    // Output connection info for callers to consume
    console.log(JSON.stringify({
      port: proxy.port,
      pid: process.pid,
      certPath,
      httpProxy: `http://127.0.0.1:${proxy.port}`,
    }));

    // Keep process alive until SIGTERM/SIGINT
    const shutdown = async () => {
      await proxy.stop();
      process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  });

program
  .command("install-ca")
  .description("Generate CA certificate and show install instructions")
  .option("--cert-dir <dir>", "CA certificate directory", getDefaultCertDir())
  .action(async (opts) => {
    const ca = await getOrCreateCA(opts.certDir);
    const certPath = getCertPath(opts.certDir);

    console.log(`CA certificate generated at: ${certPath}`);
    console.log();
    console.log("To install in your system trust store:");
    console.log();

    if (process.platform === "darwin") {
      console.log(`  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${certPath}"`);
    } else if (process.platform === "linux") {
      console.log(`  sudo cp "${certPath}" /usr/local/share/ca-certificates/coolhand-proxy.crt`);
      console.log("  sudo update-ca-certificates");
    } else {
      console.log(`  Import "${certPath}" into your system certificate store.`);
    }

    console.log();
    console.log("For subprocess trust, these env vars are set automatically by 'coolhand-proxy wrap':");
    console.log(`  SSL_CERT_FILE=${certPath}`);
    console.log(`  NODE_EXTRA_CA_CERTS=${certPath}`);
    console.log(`  REQUESTS_CA_BUNDLE=${certPath}`);
  });

program.parse();
