import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Keyed by room `name` (the developer-chosen identifier), not `sid` — a
  // room's sid changes every time it's recreated, but apps think in terms
  // of the stable name. See the README's "Room Identity" section.
  rooms: defineTable({
    name: v.string(),
    sid: v.optional(v.string()),
    status: v.union(v.literal("started"), v.literal("finished")),
    numParticipants: v.optional(v.number()),
    maxParticipants: v.optional(v.number()),
    emptyTimeout: v.optional(v.number()),
    metadata: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  participants: defineTable({
    participantSid: v.string(),
    roomName: v.string(),
    identity: v.string(),
    name: v.optional(v.string()),
    state: v.union(v.literal("joined"), v.literal("left")),
    metadata: v.optional(v.string()),
    joinedAt: v.optional(v.number()),
    leftAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_participantSid", ["participantSid"])
    .index("by_roomName", ["roomName"])
    .index("by_room_and_identity", ["roomName", "identity"]),

  egress: defineTable({
    egressId: v.string(),
    roomName: v.optional(v.string()),
    status: v.string(), // EGRESS_STARTING | EGRESS_ACTIVE | EGRESS_ENDING | EGRESS_COMPLETE | EGRESS_FAILED | EGRESS_ABORTED
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_egressId", ["egressId"])
    .index("by_roomName", ["roomName"]),

  webhookEvents: defineTable({
    eventId: v.string(), // LiveKit's own webhook event `id`
    eventType: v.string(), // the `event` field, e.g. "room_started"
    payload: v.string(),
    receivedAt: v.number(),
  }).index("by_eventId", ["eventId"]),
});
