/** First useful error from a LaTeX or Typst log, with its line number when present. */
export function firstError(log: string): { message: string; line?: number } {
  const tex = /^!\s*(.+)$/m.exec(log);
  if (tex) {
    const ln = /^l\.(\d+)/m.exec(log);
    return { message: tex[1]!.trim(), ...(ln ? { line: Number(ln[1]) } : {}) };
  }
  const typ = /error:\s*(.+)/i.exec(log);
  if (typ) {
    const ln = /:(\d+):\d+/.exec(log);
    return { message: typ[1]!.trim(), ...(ln ? { line: Number(ln[1]) } : {}) };
  }
  return { message: log.trim().split('\n')[0] ?? 'Unknown compile error' };
}
