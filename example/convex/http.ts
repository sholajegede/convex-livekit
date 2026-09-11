import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { LiveKit } from "../../src/client/index.js";

const livekit = new LiveKit(components.convexLivekit, {
  apiKey: process.env.LIVEKIT_API_KEY!,
  apiSecret: process.env.LIVEKIT_API_SECRET!,
  host: process.env.LIVEKIT_HOST!,
});

const http = httpRouter();

http.route({
  path: "/webhooks/livekit",
  method: "POST",
  handler: livekit.webhookHandler,
});

export default http;
