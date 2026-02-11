import { PatternMatchingService } from "coolhand-node";

const patternService = new PatternMatchingService();

/**
 * Check if a URL matches a known AI API pattern.
 * Uses coolhand-node's PatternMatchingService which covers
 * OpenAI, Anthropic, Google AI, Cohere, Hugging Face, etc.
 */
export function shouldCapture(url: string): boolean {
  const match = patternService.matchesAPIPatternFromURL(url);
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

/**
 * Parse a body string as JSON if possible, return raw string otherwise.
 */
export function parseBody(
  text: string | undefined | null
): Record<string, unknown> | string | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return text;
  }
}
