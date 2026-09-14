export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/** mm:ss, or h:mm:ss past an hour. Falls back to "—" while a room/room-less
 * duration can't be computed yet (no startedAt, or still running). */
export function formatDuration(startedAt?: number, endedAt?: number): string {
  if (!startedAt) return "—";
  const totalSec = Math.max(0, Math.round(((endedAt ?? Date.now()) - startedAt) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export type Tone = "neutral" | "good" | "bad" | "pending";

export function roomStatusTone(status: string): Tone {
  return status === "started" ? "good" : "neutral";
}

export function participantStateTone(state: string): Tone {
  return state === "joined" ? "good" : "neutral";
}

export function egressStatusTone(status: string): Tone {
  if (status === "EGRESS_COMPLETE") return "good";
  if (status === "EGRESS_FAILED" || status === "EGRESS_ABORTED") return "bad";
  if (status === "EGRESS_ACTIVE" || status === "EGRESS_STARTING" || status === "EGRESS_ENDING") {
    return "pending";
  }
  return "neutral";
}

export function ingressStateTone(state?: string): Tone {
  if (state === "ENDPOINT_PUBLISHING") return "good";
  if (state === "ENDPOINT_ERROR") return "bad";
  if (state === "ENDPOINT_BUFFERING") return "pending";
  return "neutral";
}

/** True if this egress is still running (not yet complete/failed/aborted). */
export function isEgressLive(status: string): boolean {
  return status === "EGRESS_STARTING" || status === "EGRESS_ACTIVE" || status === "EGRESS_ENDING";
}
