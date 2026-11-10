/** A local record of what each stage did. Keys and contact details are removed before it is stored or exported. */
export interface TraceEvent {
  stage: string;
  at: number;
  ms?: number;
  note?: string;
  data?: unknown;
}

const SECRET =
  /(sk-[A-Za-z0-9_-]{8,}|gsk_[A-Za-z0-9]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|AIza[0-9A-Za-z_-]{10,})/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /\+?\d[\d\s().-]{8,}\d/g;

export function redact(text: string): string {
  return text
    .replace(SECRET, '[key removed]')
    .replace(EMAIL, '[email removed]')
    .replace(PHONE, '[phone removed]');
}

export class Trace {
  readonly events: TraceEvent[] = [];
  constructor(private readonly now: () => number = Date.now) {}
  record(stage: string, note?: string, data?: unknown): void {
    this.events.push({ stage, at: this.now(), note, data });
  }
  export(): string {
    return redact(JSON.stringify(this.events, null, 2));
  }
}
