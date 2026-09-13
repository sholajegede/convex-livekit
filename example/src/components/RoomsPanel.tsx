import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, Field, TextInput, Button, Badge, StatusDot, Empty } from "./ui";
import { relativeTime, roomStatusTone, participantStateTone } from "../lib/format";
import { withLog } from "../lib/logStore";

function RoomItem({ name }: { name: string }) {
  const [expanded, setExpanded] = useState(false);
  const [metadataDraft, setMetadataDraft] = useState("");

  const rooms = useQuery(api.example.listRooms, {});
  const room = rooms?.find((r) => r.name === name);
  const participants = useQuery(
    api.example.listParticipantsByRoom,
    expanded ? { roomName: name } : "skip",
  );

  const deleteRoom = useAction(api.example.deleteRoom);
  const updateMetadata = useAction(api.example.updateRoomMetadata);
  const removeParticipant = useAction(api.example.removeParticipant);

  if (!room) return null;

  return (
    <div className="list-item">
      <div className="list-top">
        <span className="list-title">
          <StatusDot tone={roomStatusTone(room.status)} pulse={room.status === "started"} />
          {room.name}
        </span>
        <span className="list-meta">
          <Badge tone={roomStatusTone(room.status)}>{room.status}</Badge>
          {room.numParticipants !== undefined && <span>{room.numParticipants} in room</span>}
          <span>{relativeTime(room.updatedAt)}</span>
        </span>
      </div>

      <div className="btn-row" style={{ marginTop: "0.6rem" }}>
        <Button variant="secondary" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide participants" : "Show participants"}
        </Button>
        <Button
          variant="danger"
          onClick={() => withLog("deleteRoom", () => deleteRoom({ name: room.name }))}
        >
          Delete room
        </Button>
      </div>

      {expanded && (
        <>
          <div className="field-row" style={{ marginTop: "0.75rem" }}>
            <Field label="Update metadata">
              <TextInput
                value={metadataDraft}
                onChange={(e) => setMetadataDraft(e.target.value)}
                placeholder={room.metadata ?? '{"topic":"..."}'}
              />
            </Field>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "0.85rem" }}>
              <Button
                variant="secondary"
                disabled={!metadataDraft}
                onClick={() =>
                  withLog("updateRoomMetadata", () =>
                    updateMetadata({ name: room.name, metadata: metadataDraft }),
                  ).then(() => setMetadataDraft(""))
                }
              >
                Save
              </Button>
            </div>
          </div>

          <div className="list-participants">
            {participants === undefined ? null : participants.length === 0 ? (
              <Empty>No participants have joined this room yet.</Empty>
            ) : (
              participants.map((p) => (
                <div className="participant-row" key={p._id}>
                  <span className="identity">
                    <StatusDot tone={participantStateTone(p.state)} />
                    {p.identity}
                    {p.name && <span style={{ color: "var(--text-faint)" }}>({p.name})</span>}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Badge tone={participantStateTone(p.state)}>{p.state}</Badge>
                    {p.state === "joined" && (
                      <Button
                        variant="danger"
                        onClick={() =>
                          withLog("removeParticipant", () =>
                            removeParticipant({ roomName: room.name, identity: p.identity }),
                          )
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function RoomsPanel() {
  const [name, setName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [emptyTimeout, setEmptyTimeout] = useState("");
  const [metadata, setMetadata] = useState("");

  const createRoom = useAction(api.example.createRoom);
  const rooms = useQuery(api.example.listRooms, {});

  async function place() {
    await withLog("createRoom", () =>
      createRoom({
        name,
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
        emptyTimeout: emptyTimeout ? Number(emptyTimeout) : undefined,
        metadata: metadata || undefined,
      }),
    );
    setName("");
    setMaxParticipants("");
    setEmptyTimeout("");
    setMetadata("");
  }

  return (
    <>
      <Card title="Create a room">
        <div className="field-row">
          <Field label="Room name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="standup" />
          </Field>
          <Field label="Max participants (optional)">
            <TextInput
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              placeholder="10"
              inputMode="numeric"
            />
          </Field>
          <Field label="Empty timeout, seconds (optional)">
            <TextInput
              value={emptyTimeout}
              onChange={(e) => setEmptyTimeout(e.target.value)}
              placeholder="300"
              inputMode="numeric"
            />
          </Field>
        </div>
        <Field label="Metadata (optional)">
          <TextInput
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            placeholder='{"topic":"Daily standup"}'
          />
        </Field>
        <Button onClick={place} disabled={!name}>
          Create room
        </Button>
      </Card>

      <Card title="Rooms">
        {rooms === undefined ? null : rooms.length === 0 ? (
          <Empty>No rooms yet — create one above, or open the Join tab to create one on the fly.</Empty>
        ) : (
          <div className="list">
            {rooms.map((room) => (
              <RoomItem key={room._id} name={room.name} />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
