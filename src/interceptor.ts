import { PatternMatchingService, parseBody } from "coolhand-node";

let _patternService: PatternMatchingService | null = null;
function getPatternService(): PatternMatchingService {
  if (!_patternService) {
    _patternService = new PatternMatchingService();
  }
  return _patternService;
}

/** Wait until the pattern service has finished loading (up to timeoutMs). */
export async function waitForPatterns(timeoutMs = 2000): Promise<void> {
  const svc = getPatternService();
  const deadline = Date.now() + timeoutMs;
  while (!svc.isInitialized && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

/**
 * Returns the set of hostnames whose TLS the proxy should intercept.
 * All other HTTPS traffic is tunneled untouched — browsers see real certs.
 */
export function getInterceptHostnames(): string[] {
  const patterns = getPatternService().apiPatterns as Array<{ domains?: string[] }> | undefined;
  return patterns?.flatMap((p) => p.domains ?? []) ?? [];
}

/**
 * Check if a URL matches a known AI API pattern.
 * Uses coolhand-node's PatternMatchingService which covers
 * OpenAI, Anthropic, Google AI, Cohere, Hugging Face, etc.
 */
export function shouldCapture(url: string): boolean {
  const match = getPatternService().matchesAPIPatternFromURL(url);
  return match !== null;
}

/**
 * Sanitize headers by redacting sensitive values (API keys, auth tokens).
 */
export function sanitizeHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const sensitiveKeys = new Set([
    "authorization",
    "x-goog-api-key",
    "x-api-key",
    "api-key",
    "cookie",
    "openai-api-key",
  ]);

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    sanitized[key] = sensitiveKeys.has(key.toLowerCase())
      ? "[REDACTED]"
      : value;
  }
  return sanitized;
}

export { parseBody };
