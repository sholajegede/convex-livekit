import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type Tab = "rooms" | "join" | "ingress" | "webhooks" | "history";

function FlowDiagram() {
  return (
    <>
      <div className="flow">
        <div className="flow-node">your app</div>
        <span className="flow-arrow">⇄</span>
        <div className="flow-node accent">Convex</div>
        <span className="flow-arrow">⇄</span>
        <div className="flow-node">LiveKit</div>
      </div>
      <p className="flow-caption">
        Actions call LiveKit's RoomService and mint access tokens; LiveKit's webhooks post room,
        participant, and egress events back to a Convex <code>httpAction</code>, which merges them
        into reactive tables — every query below updates live, no polling.
      </p>
    </>
  );
}

export function Header({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const stats = useQuery(api.example.getStats, {});

  return (
    <div className="hero-frame">
      <div className="hero-stats">
        <span>
          rooms: <b>{stats ? stats.roomCount : "…"}</b>
        </span>
        <span>
          live now: <b>{stats ? stats.liveRoomCount : "…"}</b>
        </span>
        <span>
          participants online: <b>{stats ? stats.participantCount : "…"}</b>
        </span>
        <span>
          egress jobs: <b>{stats ? stats.egressCount : "…"}</b>
        </span>
        <span>
          ingress endpoints: <b>{stats ? stats.ingressCount : "…"}</b>
        </span>
        <span>
          webhook deliveries: <b>{stats ? stats.webhookEventCount : "…"}</b>
        </span>
      </div>

      <div className="hero-divider" />

      <div className="hero-main">
        <div className="wordmark">
          <span className="logo-mark">L</span> convex-livekit
        </div>
        <h1 className="hero-title">
          Rooms, participants, and egress, <span className="hl">kept live</span> in Convex
        </h1>
        <p className="hero-sub">
          Create rooms and mint join tokens from Convex functions, then watch LiveKit's webhooks
          fill in the rest — reactively, with no polling.
        </p>
        <FlowDiagram />
      </div>

      <div className="tabs">
        {(
          [
            ["rooms", "Rooms"],
            ["join", "Join Live"],
            ["ingress", "Ingress"],
            ["webhooks", "Webhooks"],
            ["history", "History"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`tab${tab === key ? " active" : ""}`}
            onClick={() => onTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
