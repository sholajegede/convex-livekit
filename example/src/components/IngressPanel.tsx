import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, Field, TextInput, Button, Badge, StatusDot, Empty } from "./ui";
import { relativeTime, ingressStateTone } from "../lib/format";
import { withLog } from "../lib/logStore";

type InputType = "rtmp" | "whip" | "url";

export function IngressPanel() {
  const [roomName, setRoomName] = useState("");
  const [participantIdentity, setParticipantIdentity] = useState("");
  const [inputType, setInputType] = useState<InputType>("rtmp");
  const [sourceUrl, setSourceUrl] = useState("");
  const [created, setCreated] = useState<{ ingressId: string; url?: string; streamKey?: string } | null>(
    null,
  );

  const createIngress = useAction(api.example.createIngress);
  const deleteIngress = useAction(api.example.deleteIngress);
  const ingress = useQuery(
    api.example.listIngressByRoom,
    roomName ? { roomName } : "skip",
  );

  async function place() {
    const result = await withLog("createIngress", () =>
      createIngress({
        inputType,
        name: `${roomName}-${inputType}`,
        roomName,
        participantIdentity,
        participantName: participantIdentity,
        url: inputType === "url" ? sourceUrl : undefined,
      }),
    );
    setCreated(result);
    setParticipantIdentity("");
    setSourceUrl("");
  }

  return (
    <>
      <Card title="Create an ingress endpoint">
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Provisions an RTMP, WHIP, or pulled-URL endpoint that publishes into a room as a regular
          participant — hand the returned URL/stream key to OBS or any encoder.
        </p>
        <div className="field-row">
          <Field label="Room name">
            <TextInput
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="standup"
            />
          </Field>
          <Field label="Participant identity">
            <TextInput
              value={participantIdentity}
              onChange={(e) => setParticipantIdentity(e.target.value)}
              placeholder="obs-encoder"
            />
          </Field>
          <Field label="Input type">
            <select value={inputType} onChange={(e) => setInputType(e.target.value as InputType)}>
              <option value="rtmp">RTMP</option>
              <option value="whip">WHIP</option>
              <option value="url">Pulled URL</option>
            </select>
          </Field>
        </div>
        {inputType === "url" && (
          <Field label="Source URL">
            <TextInput
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/stream.m3u8"
            />
          </Field>
        )}
        <Button onClick={place} disabled={!roomName || !participantIdentity}>
          Create ingress
        </Button>

        {created && (
          <div className="list-item" style={{ marginTop: "1rem" }}>
            <div className="list-sub">
              Created <code>{created.ingressId}</code> — save these now, the stream key is only
              returned once:
            </div>
            {created.url && <div className="list-sub">url: <code>{created.url}</code></div>}
            {created.streamKey && (
              <div className="list-sub">stream key: <code>{created.streamKey}</code></div>
            )}
          </div>
        )}
      </Card>

      <Card title={roomName ? `Ingress endpoints in "${roomName}"` : "Ingress endpoints"}>
        {!roomName ? (
          <Empty>Enter a room name above to see its ingress endpoints.</Empty>
        ) : ingress === undefined ? null : ingress.length === 0 ? (
          <Empty>No ingress endpoints for this room yet.</Empty>
        ) : (
          <div className="list">
            {ingress.map((i) => (
              <div className="list-item" key={i._id}>
                <div className="list-top">
                  <span className="list-title">
                    <StatusDot tone={ingressStateTone(i.state)} />
                    {i.name ?? i.ingressId}
                  </span>
                  <span className="list-meta">
                    <Badge tone={ingressStateTone(i.state)}>{i.state ?? "unknown"}</Badge>
                    <span>{i.inputType}</span>
                    <span>{relativeTime(i.updatedAt)}</span>
                  </span>
                </div>
                <div className="list-sub">participant: {i.participantIdentity}</div>
                <div className="btn-row" style={{ marginTop: "0.5rem" }}>
                  <Button
                    variant="danger"
                    onClick={() =>
                      withLog("deleteIngress", () => deleteIngress({ ingressId: i.ingressId }))
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
