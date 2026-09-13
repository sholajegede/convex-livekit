import { useState } from "react";
import { useAction } from "convex/react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { api } from "../../convex/_generated/api";
import { Card, Field, TextInput, Button } from "./ui";
import { withLog, log } from "../lib/logStore";

const SERVER_URL = import.meta.env.VITE_LIVEKIT_URL as string | undefined;

export function JoinPanel() {
  const [roomName, setRoomName] = useState("");
  const [identity, setIdentity] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [session, setSession] = useState<{ roomName: string; token: string } | null>(null);

  const createRoom = useAction(api.example.createRoom);
  const createRoomToken = useAction(api.example.createRoomToken);

  async function join() {
    // createRoom is idempotent from LiveKit's side — if the room already
    // exists, it's returned as-is rather than recreated.
    await withLog("createRoom", () => createRoom({ name: roomName }));
    const { token } = await withLog("createRoomToken", () =>
      createRoomToken({ roomName, identity, name: displayName || undefined }),
    );
    setSession({ roomName, token });
  }

  if (!SERVER_URL) {
    return (
      <Card title="Join a room live">
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
          Set <code>VITE_LIVEKIT_URL</code> (your project's <code>wss://…livekit.cloud</code> URL)
          in the root <code>.env.local</code> to enable live joining from the browser.
        </p>
      </Card>
    );
  }

  if (session) {
    return (
      <Card title={`Live in "${session.roomName}"`}>
        <div className="join-live-banner">● connected as {identity}</div>
        <div className="join-stage">
          <LiveKitRoom
            serverUrl={SERVER_URL}
            token={session.token}
            connect
            video
            audio
            data-lk-theme="default"
            style={{ height: 620 }}
            onDisconnected={() => {
              log("info", "left room", session.roomName);
              setSession(null);
            }}
          >
            <VideoConference />
          </LiveKitRoom>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Join a room live">
      <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 0 }}>
        Mints a real join token via <code>createRoomToken</code> and opens a real WebRTC
        connection with your camera and microphone — the room, your participant row, and (once
        you leave) its <code>left</code> state all populate reactively from LiveKit's webhooks.
      </p>
      <div className="field-row">
        <Field label="Room name">
          <TextInput
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="standup"
          />
        </Field>
        <Field label="Your identity">
          <TextInput
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            placeholder="user_123"
          />
        </Field>
        <Field label="Display name (optional)">
          <TextInput
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Shola"
          />
        </Field>
      </div>
      <Button onClick={join} disabled={!roomName || !identity}>
        Join live
      </Button>
      <div className="join-placeholder" style={{ marginTop: "1rem" }}>
        Your camera preview appears here once you join — this browser tab becomes a real LiveKit
        participant.
      </div>
    </Card>
  );
}
