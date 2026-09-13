import { useSyncExternalStore } from "react";
import { getEntries, subscribe } from "../lib/logStore";
import { formatTime } from "../lib/format";

export function Console() {
  const entries = useSyncExternalStore(subscribe, getEntries);

  return (
    <aside className="console">
      <div className="console-header">Activity</div>
      <div className="console-log" id="console-log">
        {entries.length === 0 ? (
          <div className="console-empty">
            Actions you take in the demo — creating rooms, minting tokens, joining live — will
            log here as they happen.
          </div>
        ) : (
          entries.map((entry) => (
            <div className={`log-entry ${entry.level}`} key={entry.id}>
              <div className="log-top">
                <span className="log-title">{entry.title}</span>
                <span>{formatTime(entry.time)}</span>
              </div>
              <div className="log-detail">{entry.detail}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
