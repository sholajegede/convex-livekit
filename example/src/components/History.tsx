import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, Badge, StatusDot, Empty } from "./ui";
import {
  relativeTime,
  roomStatusTone,
  participantStateTone,
  egressStatusTone,
  formatDuration,
} from "../lib/format";

export function History() {
  const rooms = useQuery(api.example.listRooms, {});
  const participants = useQuery(api.example.listRecentParticipants, {});
  const egress = useQuery(api.example.listRecentEgress, {});

  return (
    <>
      <Card title="Recent rooms">
        {rooms === undefined ? null : rooms.length === 0 ? (
          <Empty>No rooms recorded yet.</Empty>
        ) : (
          <div className="list">
            {rooms.map((room) => (
              <div className="list-item" key={room._id}>
                <div className="list-top">
                  <span className="list-title">
                    <StatusDot tone={roomStatusTone(room.status)} pulse={room.status === "started"} />
                    {room.name}
                  </span>
                  <span className="list-meta">
                    <Badge tone={roomStatusTone(room.status)}>{room.status}</Badge>
                    <span>{relativeTime(room.updatedAt)}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recent participants (across every room)">
        {participants === undefined ? null : participants.length === 0 ? (
          <Empty>No participants have joined any room yet.</Empty>
        ) : (
          <div className="list">
            {participants.map((p) => (
              <div className="list-item" key={p._id}>
                <div className="list-top">
                  <span className="list-title">
                    <StatusDot tone={participantStateTone(p.state)} />
                    {p.identity}
                  </span>
                  <span className="list-meta">
                    <Badge tone={participantStateTone(p.state)}>{p.state}</Badge>
                    <span>{relativeTime(p.updatedAt)}</span>
                  </span>
                </div>
                <div className="list-sub">room: {p.roomName}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recent egress jobs">
        {egress === undefined ? null : egress.length === 0 ? (
          <Empty>No recording/streaming (egress) jobs yet.</Empty>
        ) : (
          <div className="list">
            {egress.map((e) => (
              <div className="list-item" key={e._id}>
                <div className="list-top">
                  <span className="list-title">
                    <StatusDot tone={egressStatusTone(e.status)} />
                    {e.egressId}
                  </span>
                  <span className="list-meta">
                    <Badge tone={egressStatusTone(e.status)}>{e.status}</Badge>
                    <span>{formatDuration(e.startedAt, e.endedAt)}</span>
                  </span>
                </div>
                {e.roomName && <div className="list-sub">room: {e.roomName}</div>}
                {e.error && <div className="list-sub" style={{ color: "var(--red)" }}>{e.error}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
