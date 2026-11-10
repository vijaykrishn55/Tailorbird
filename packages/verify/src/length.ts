export const BULLET_MIN_WORDS = 8;
export const BULLET_MAX_WORDS = 34;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Returns a message if the bullet is too short or too long. */
export function lengthProblem(
  text: string,
  min = BULLET_MIN_WORDS,
  max = BULLET_MAX_WORDS,
): string | undefined {
  const n = wordCount(text);
  if (n < min) return `has ${n} words; write at least ${min}`;
  if (n > max) return `has ${n} words; keep it to ${max} or fewer`;
  return undefined;
}
