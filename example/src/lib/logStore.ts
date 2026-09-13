type LogLevel = "info" | "error";

export type LogEntry = {
  id: number;
  time: number;
  level: LogLevel;
  title: string;
  detail: string;
};

let entries: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function log(level: LogLevel, title: string, detail: string) {
  entries = [...entries, { id: nextId++, time: Date.now(), level, title, detail }].slice(-200);
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEntries(): LogEntry[] {
  return entries;
}

function summarize(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    if (!json) return String(value);
    return json.length > 300 ? `${json.slice(0, 300)}…` : json;
  } catch {
    return String(value);
  }
}

export async function withLog<T>(title: string, fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    log("info", title, summarize(result));
    return result;
  } catch (err) {
    log("error", title, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
