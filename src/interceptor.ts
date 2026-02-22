import { PatternMatchingService, parseBody } from "coolhand-node";

let _patternService: PatternMatchingService | null = null;
function getPatternService(): PatternMatchingService {
  if (!_patternService) {
    _patternService = new PatternMatchingService();
  }
  return _patternService;
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
