import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

const roomStatusValidator = v.union(v.literal("started"), v.literal("finished"));
const participantStateValidator = v.union(v.literal("joined"), v.literal("left"));

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

export const recordParticipant = mutation({
  args: {
    participantSid: v.string(),
    roomName: v.string(),
    identity: v.string(),
    name: v.optional(v.string()),
    state: participantStateValidator,
    metadata: v.optional(v.string()),
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
