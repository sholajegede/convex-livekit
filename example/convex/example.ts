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

export const updateRoomMetadata = action({
  args: { name: v.string(), metadata: v.string() },
  handler: async (ctx, args) => {
    await livekit.updateRoomMetadata(ctx, args);
    return null;
  },
});

export const updateParticipant = action({
  args: {
    roomName: v.string(),
    identity: v.string(),
    metadata: v.optional(v.string()),
    name: v.optional(v.string()),
    attributes: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    await livekit.updateParticipant(ctx, args);
    return null;
  },
});

export const mutePublishedTrack = action({
  args: {
    roomName: v.string(),
    identity: v.string(),
    trackSid: v.string(),
    muted: v.boolean(),
  },
  handler: async (ctx, args) => {
    await livekit.mutePublishedTrack(ctx, args);
    return null;
  },
});

export const startRoomCompositeEgress = action({
  args: {
    roomName: v.string(),
    layout: v.optional(v.string()),
    audioOnly: v.optional(v.boolean()),
    videoOnly: v.optional(v.boolean()),
    filepath: v.optional(v.string()),
    streamUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await livekit.startRoomCompositeEgress(ctx, args);
  },
});

export const stopEgress = action({
  args: { egressId: v.string() },
  handler: async (ctx, args) => {
    return await livekit.stopEgress(ctx, args);
  },
});

export const createIngress = action({
  args: {
    inputType: v.union(v.literal("rtmp"), v.literal("whip"), v.literal("url")),
    name: v.string(),
    roomName: v.string(),
    participantIdentity: v.string(),
    participantName: v.string(),
    url: v.optional(v.string()),
    enableTranscoding: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await livekit.createIngress(ctx, args);
  },
});

export const updateIngress = action({
  args: {
    ingressId: v.string(),
    name: v.optional(v.string()),
    roomName: v.optional(v.string()),
    participantIdentity: v.optional(v.string()),
    participantName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await livekit.updateIngress(ctx, args);
    return null;
  },
});

export const deleteIngress = action({
  args: { ingressId: v.string() },
  handler: async (ctx, args) => {
    await livekit.deleteIngress(ctx, args);
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

export const getTrack = query({
  args: { trackSid: v.string() },
  handler: async (ctx, args) => {
    return await livekit.getTrack(ctx, args);
  },
});

export const listTracksByRoom = query({
  args: { roomName: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await livekit.listTracksByRoom(ctx, args);
  },
});

export const listTracksByParticipant = query({
  args: { roomName: v.string(), participantIdentity: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await livekit.listTracksByParticipant(ctx, args);
  },
});

export const getIngress = query({
  args: { ingressId: v.string() },
  handler: async (ctx, args) => {
    return await livekit.getIngress(ctx, args);
  },
});

export const listIngressByRoom = query({
  args: { roomName: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await livekit.listIngressByRoom(ctx, args);
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    return await livekit.getStats(ctx);
  },
});

export const listRecentParticipants = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await livekit.listRecentParticipants(ctx, args);
  },
});

export const listRecentEgress = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await livekit.listRecentEgress(ctx, args);
  },
});

export const listRecentWebhookEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await livekit.listRecentWebhookEvents(ctx, args);
  },
});
