import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, Empty } from "./ui";
import { formatTime, truncate } from "../lib/format";

export function WebhooksPanel() {
  const events = useQuery(api.example.listRecentWebhookEvents, {});

  return (
    <Card title="Webhook deliveries">
      {events === undefined ? null : events.length === 0 ? (
        <Empty>
          No webhooks delivered yet — create a room, join live, or send a test event to{" "}
          <code>/webhooks/livekit</code> and it'll show up here reactively.
        </Empty>
      ) : (
        <div className="obs-list">
          {events.map((event) => (
            <div className="obs-item" key={event._id}>
              <div className="obs-top">
                <span className="obs-type">{event.eventType}</span>
                <span>{formatTime(event.receivedAt)}</span>
              </div>
              <div className="obs-payload">{truncate(event.payload, 260)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
