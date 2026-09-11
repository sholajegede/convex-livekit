import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import "./App.css";

export default function App() {
  const [roomName, setRoomName] = useState("");
  const [identity, setIdentity] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const createRoom = useAction(api.example.createRoom);
  const createRoomToken = useAction(api.example.createRoomToken);
  const rooms = useQuery(api.example.listRooms, {});
  const participants = useQuery(
    api.example.listParticipantsByRoom,
    roomName ? { roomName } : "skip",
  );

  async function makeRoom() {
    await createRoom({ name: roomName });
  }

  async function join() {
    const result = await createRoomToken({ roomName, identity });
    setToken(result.token);
  }

  return (
    <main className="app">
      <h1>convex-livekit</h1>
      <p>
        Sync LiveKit rooms and participants into Convex reactively, and
        manage rooms and mint access tokens from Convex functions.
      </p>

      <label>
        Room name
        <input
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="standup"
        />
      </label>

      <button onClick={makeRoom} disabled={!roomName}>
        Create room
      </button>

      <label>
        Your identity
        <input
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          placeholder="user_123"
        />
      </label>

      <button onClick={join} disabled={!roomName || !identity}>
        Get join token
      </button>

      {token && (
        <p>
          Token: <code>{token.slice(0, 24)}...</code>
        </p>
      )}

      {rooms && rooms.length > 0 && (
        <>
          <h2>Rooms</h2>
          <ul>
            {rooms.map((room) => (
              <li key={room._id}>
                {room.name} — <strong>{room.status}</strong>
              </li>
            ))}
          </ul>
        </>
      )}

      {participants && participants.length > 0 && (
        <>
          <h2>Participants in {roomName}</h2>
          <ul>
            {participants.map((p) => (
              <li key={p._id}>
                {p.identity} — <strong>{p.state}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
