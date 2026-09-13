export function TopBanner() {
  return (
    <div className="banner">
      This demo calls a real LiveKit project with real credentials. Creating a room, minting a
      join token, or connecting live all hit LiveKit's actual API (<code>LIVEKIT_API_KEY</code>,{" "}
      <code>LIVEKIT_API_SECRET</code>, <code>LIVEKIT_HOST</code>), and LiveKit's webhooks post
      back to <code>/webhooks/livekit</code> on your deployment. The Join tab opens a real WebRTC
      connection using your camera and microphone.
    </div>
  );
}
