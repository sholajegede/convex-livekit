import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

const roomStatusValidator = v.union(v.literal("started"), v.literal("finished"));
const participantStateValidator = v.union(v.literal("joined"), v.literal("left"));
const attributesValidator = v.record(v.string(), v.string());

const roomValidator = v.object({
  _id: v.id("rooms"),
  _creationTime: v.number(),
  name: v.string(),
  sid: v.optional(v.string()),
  status: roomStatusValidator,
  numParticipants: v.optional(v.number()),
  maxParticipants: v.optional(v.number()),
  emptyTimeout: v.optional(v.number()),
  metadata: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  endedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const participantValidator = v.object({
  _id: v.id("participants"),
  _creationTime: v.number(),
  participantSid: v.string(),
  roomName: v.string(),
  identity: v.string(),
  name: v.optional(v.string()),
  state: participantStateValidator,
  metadata: v.optional(v.string()),
  attributes: v.optional(attributesValidator),
  joinedAt: v.optional(v.number()),
  leftAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const egressValidator = v.object({
  _id: v.id("egress"),
  _creationTime: v.number(),
  egressId: v.string(),
  roomName: v.optional(v.string()),
  status: v.string(),
  error: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  endedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const trackValidator = v.object({
  _id: v.id("tracks"),
  _creationTime: v.number(),
  trackSid: v.string(),
  roomName: v.string(),
  participantIdentity: v.string(),
  type: v.string(),
  source: v.string(),
  name: v.optional(v.string()),
  muted: v.boolean(),
  mimeType: v.optional(v.string()),
  publishedAt: v.optional(v.number()),
  unpublishedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ─── Queries ────────────────────────────────────────────────────────────────

export const getRoom = query({
  args: { name: v.string() },
  returns: v.union(v.null(), roomValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

export const listRooms = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(roomValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const listParticipantsByRoom = query({
  args: { roomName: v.string(), limit: v.optional(v.number()) },
  returns: v.array(participantValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participants")
      .withIndex("by_roomName", (q) => q.eq("roomName", args.roomName))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const getEgress = query({
  args: { egressId: v.string() },
  returns: v.union(v.null(), egressValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("egress")
      .withIndex("by_egressId", (q) => q.eq("egressId", args.egressId))
      .first();
  },
});

export const listEgressByRoom = query({
  args: { roomName: v.string(), limit: v.optional(v.number()) },
  returns: v.array(egressValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("egress")
      .withIndex("by_roomName", (q) => q.eq("roomName", args.roomName))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const getTrack = query({
  args: { trackSid: v.string() },
  returns: v.union(v.null(), trackValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tracks")
      .withIndex("by_trackSid", (q) => q.eq("trackSid", args.trackSid))
      .first();
  },
});

export const listTracksByRoom = query({
  args: { roomName: v.string(), limit: v.optional(v.number()) },
  returns: v.array(trackValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tracks")
      .withIndex("by_roomName", (q) => q.eq("roomName", args.roomName))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const listTracksByParticipant = query({
  args: { roomName: v.string(), participantIdentity: v.string(), limit: v.optional(v.number()) },
  returns: v.array(trackValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tracks")
      .withIndex("by_participant", (q) =>
        q.eq("roomName", args.roomName).eq("participantIdentity", args.participantIdentity),
      )
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

export const recordRoom = mutation({
  args: {
    name: v.string(),
    sid: v.optional(v.string()),
    status: roomStatusValidator,
    numParticipants: v.optional(v.number()),
    maxParticipants: v.optional(v.number()),
    emptyTimeout: v.optional(v.number()),
    metadata: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
  },
  returns: v.id("rooms"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("rooms", { ...args, createdAt: now, updatedAt: now });
  },
});

export const markRoomFinished = mutation({
  args: { name: v.string(), endedAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      status: "finished",
      endedAt: args.endedAt ?? Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const patchRoomMetadata = mutation({
  args: { name: v.string(), metadata: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (!existing) return null;
    await ctx.db.patch(existing._id, { metadata: args.metadata, updatedAt: Date.now() });
    return null;
  },
});

// Kept separate from recordRoom: room_started is the only event that carries
// enough context to justify a full upsert, but participant_joined/left and
// room_finished all include the same live `room.numParticipants` count in
// their payload too. Syncing it here (rather than only on room_started)
// keeps the field current instead of frozen at whatever it was when the
// room started.
export const patchRoomParticipantCount = mutation({
  args: { name: v.string(), numParticipants: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      numParticipants: args.numParticipants,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const recordParticipant = mutation({
  args: {
    participantSid: v.string(),
    roomName: v.string(),
    identity: v.string(),
    name: v.optional(v.string()),
    state: participantStateValidator,
    metadata: v.optional(v.string()),
    attributes: v.optional(attributesValidator),
    joinedAt: v.optional(v.number()),
    leftAt: v.optional(v.number()),
  },
  returns: v.id("participants"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_participantSid", (q) => q.eq("participantSid", args.participantSid))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("participants", { ...args, createdAt: now, updatedAt: now });
  },
});

export const markParticipantLeftByIdentity = mutation({
  args: { roomName: v.string(), identity: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_room_and_identity", (q) =>
        q.eq("roomName", args.roomName).eq("identity", args.identity),
      )
      .order("desc")
      .first();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      state: "left",
      leftAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});

// For updateParticipant: patches only the fields LiveKit's UpdateParticipant
// API can change (metadata, name, attributes) without touching join/leave
// state — unlike markParticipantLeftByIdentity, this never marks anyone left.
export const patchParticipant = mutation({
  args: {
    roomName: v.string(),
    identity: v.string(),
    metadata: v.optional(v.string()),
    name: v.optional(v.string()),
    attributes: v.optional(attributesValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_room_and_identity", (q) =>
        q.eq("roomName", args.roomName).eq("identity", args.identity),
      )
      .order("desc")
      .first();
    if (!existing) return null;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.metadata !== undefined) patch.metadata = args.metadata;
    if (args.name !== undefined) patch.name = args.name;
    if (args.attributes !== undefined) patch.attributes = args.attributes;
    await ctx.db.patch(existing._id, patch);
    return null;
  },
});

export const recordEgress = mutation({
  args: {
    egressId: v.string(),
    roomName: v.optional(v.string()),
    status: v.string(),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
  },
  returns: v.id("egress"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("egress")
      .withIndex("by_egressId", (q) => q.eq("egressId", args.egressId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("egress", { ...args, createdAt: now, updatedAt: now });
  },
});

export const recordTrack = mutation({
  args: {
    trackSid: v.string(),
    roomName: v.string(),
    participantIdentity: v.string(),
    type: v.string(),
    source: v.string(),
    name: v.optional(v.string()),
    muted: v.boolean(),
    mimeType: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
  },
  returns: v.id("tracks"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("tracks")
      .withIndex("by_trackSid", (q) => q.eq("trackSid", args.trackSid))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        unpublishedAt: undefined,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("tracks", { ...args, createdAt: now, updatedAt: now });
  },
});

export const markTrackUnpublished = mutation({
  args: { trackSid: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tracks")
      .withIndex("by_trackSid", (q) => q.eq("trackSid", args.trackSid))
      .first();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      unpublishedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});

// For mutePublishedTrack: patches the mute snapshot right after our own
// server call succeeds. See the schema's caveat — this does not learn about
// a participant muting themselves client-side.
export const patchTrackMuted = mutation({
  args: { trackSid: v.string(), muted: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tracks")
      .withIndex("by_trackSid", (q) => q.eq("trackSid", args.trackSid))
      .first();
    if (!existing) return null;
    await ctx.db.patch(existing._id, { muted: args.muted, updatedAt: Date.now() });
    return null;
  },
});

// ─── Dashboard queries ──────────────────────────────────────────────────────

export const getStats = query({
  args: {},
  returns: v.object({
    roomCount: v.number(),
    liveRoomCount: v.number(),
    participantCount: v.number(),
    egressCount: v.number(),
    trackCount: v.number(),
    liveTrackCount: v.number(),
    webhookEventCount: v.number(),
  }),
  handler: async (ctx) => {
    const [rooms, participants, egress, tracks, webhookEvents] = await Promise.all([
      ctx.db.query("rooms").collect(),
      ctx.db.query("participants").collect(),
      ctx.db.query("egress").collect(),
      ctx.db.query("tracks").collect(),
      ctx.db.query("webhookEvents").collect(),
    ]);
    return {
      roomCount: rooms.length,
      liveRoomCount: rooms.filter((r) => r.status === "started").length,
      participantCount: participants.filter((p) => p.state === "joined").length,
      egressCount: egress.length,
      trackCount: tracks.length,
      liveTrackCount: tracks.filter((t) => t.unpublishedAt === undefined).length,
      webhookEventCount: webhookEvents.length,
    };
  },
});

export const listRecentParticipants = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(participantValidator),
  handler: async (ctx, args) => {
    const participants = await ctx.db.query("participants").collect();
    return participants.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, args.limit ?? 20);
  },
});

export const listRecentEgress = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(egressValidator),
  handler: async (ctx, args) => {
    const egress = await ctx.db.query("egress").collect();
    return egress.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, args.limit ?? 20);
  },
});

export const listRecentWebhookEvents = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("webhookEvents"),
      _creationTime: v.number(),
      eventId: v.string(),
      eventType: v.string(),
      payload: v.string(),
      receivedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const events = await ctx.db.query("webhookEvents").collect();
    return events.sort((a, b) => b.receivedAt - a.receivedAt).slice(0, args.limit ?? 20);
  },
});

export const checkAndRecordEvent = mutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    payload: v.string(),
  },
  returns: v.object({ alreadyProcessed: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first();
    if (existing) {
      return { alreadyProcessed: true };
    }
    await ctx.db.insert("webhookEvents", { ...args, receivedAt: Date.now() });
    return { alreadyProcessed: false };
  },
});
