import { query, action } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { LiveKit } from "../../src/client/index.js";
import { v } from "convex/values";

const livekit = new LiveKit(components.convexLivekit, {
  apiKey: process.env.LIVEKIT_API_KEY!,
  apiSecret: process.env.LIVEKIT_API_SECRET!,
  host: process.env.LIVEKIT_HOST!,
});

export const createRoom = action({
  args: {
    name: v.string(),
    emptyTimeout: v.optional(v.number()),
    maxParticipants: v.optional(v.number()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await livekit.createRoom(ctx, args);
  },
});

export const deleteRoom = action({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    await livekit.deleteRoom(ctx, args);
    return null;
  },
});

export const removeParticipant = action({
  args: { roomName: v.string(), identity: v.string() },
  handler: async (ctx, args) => {
    await livekit.removeParticipant(ctx, args);
    return null;
  },
});

export const createRoomToken = action({
  args: {
    roomName: v.string(),
    identity: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await livekit.createRoomToken(args);
  },
});

export const getRoom = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await livekit.getRoom(ctx, args);
  },
});

export const listRooms = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await livekit.listRooms(ctx, args);
  },
});

export const listParticipantsByRoom = query({
  args: { roomName: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await livekit.listParticipantsByRoom(ctx, args);
  },
});
