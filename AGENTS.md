# coolhand-proxy

## Setup

```bash
npm install
```

## Build

```bash
npm run build
```

Compiles TypeScript via [tsup](https://tsup.egoist.dev/) into `dist/`. Only needed when testing the compiled artifact or before publishing — skip during normal development.

## Running locally

Use `tsx` to run commands directly from source without a build step:

```bash
npx tsx src/cli.ts wrap -- node my-app.js
npx tsx src/cli.ts start
npx tsx src/cli.ts install-ca
```

## Verify before committing

```bash
npm test && npm run typecheck
```

This runs the full test suite and TypeScript type checking — exactly what CI runs.

## Individual tools

| Command | What it does |
|---------|-------------|
| `npm test` | Run all tests (`src/*.test.ts`) |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run build` | Compile TypeScript to `dist/` |

## README and docs philosophy

The README is a landing page — install, quick start, what it supports, where to go next. Keep it scannable. When in doubt, link rather than expand.

**Three rules:**
- **Config**: the `COOLHAND_API_KEY` environment variable and the basic `wrap` invocation belong in the README. The full flag reference, self-hosted endpoint configuration, and CA certificate trust details go in `docs/configuration.md`.
- **Commands**: a short description with the most common flags belongs in the README. The complete options table for each command (`wrap`, `start`, `install-ca`) belongs in `docs/configuration.md`.
- **Supported providers**: a flat bulleted list of provider names belongs in the README. Interception mechanics and host-matching details belong in `docs/`.

**Align with coolhand-node.** When adding a section that also exists in the coolhand-node README, match its structure and tone. The two READMEs should feel like siblings.

## Discoverability (SEO / AEO)

The README and docs are indexed by search engines and consumed by AI agents doing package research. Use full proper names for providers and environments (e.g. "OpenAI", "Anthropic", "Google Gemini", "Vertex AI", "Cohere", "Hugging Face", "Node.js", "Python") rather than abbreviations. Make headings and the one-line project description keyword-rich so searches like "MITM proxy LLM monitoring", "language-agnostic AI logging", or "proxy OpenAI calls" surface this package.
