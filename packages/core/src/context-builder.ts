/** Layered, token-budgeted prompt context. Lowest-priority layers are dropped first. */
export interface Layer {
  name: string;
  text: string;
  /** Higher number = more important. */
  priority: number;
  /** Required layers are never dropped. */
  required?: boolean;
}

export const estimateTokens = (s: string): number => Math.ceil(s.length / 4);

export function buildContext(
  layers: Layer[],
  budgetTokens: number,
): { text: string; used: number; dropped: string[] } {
  const kept = [...layers];
  const dropped: string[] = [];
  const total = () => kept.reduce((n, l) => n + estimateTokens(l.text), 0);
  while (total() > budgetTokens) {
    const candidates = kept.filter((l) => !l.required).sort((a, b) => a.priority - b.priority);
    const victim = candidates[0];
    if (!victim) break;
    kept.splice(kept.indexOf(victim), 1);
    dropped.push(victim.name);
  }
  return { text: kept.map((l) => l.text).join('\n\n'), used: total(), dropped };
}
