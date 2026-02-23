import { defineConfig } from "tsup";
import { readFileSync, writeFileSync } from "fs";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
  },
  format: ["esm"],
  target: "node18",
  platform: "node",
  splitting: true,
  clean: true,
  dts: false,
  outDir: "dist",
  async onSuccess() {
    const cliPath = "dist/cli.js";
    const content = readFileSync(cliPath, "utf8");
    writeFileSync(cliPath, "#!/usr/bin/env node\n" + content);
  },
});
