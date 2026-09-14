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
    // LiveKit's participant `attributes` map. Populated from whatever
    // webhook event last carried it (join/leave/abort), or immediately from
    // our own updateParticipant calls — there's no dedicated "attributes
    // changed" webhook, so a participant (or an agent) changing its own
    // attributes client-side without going through updateParticipant won't
    // be reflected here until the next join/leave/abort event. This is the
    // field LiveKit Agents uses to broadcast agent state (e.g. listening /
    // thinking / speaking) — see the README's "Agent state" section.
    attributes: v.optional(v.record(v.string(), v.string())),
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

  // One row per published track. Kept (not deleted) on unpublish, same as
  // how rooms/participants keep their history via a status field, so a
  // reactive UI can show "just unpublished" instead of the row vanishing.
  tracks: defineTable({
    trackSid: v.string(),
    roomName: v.string(),
    participantIdentity: v.string(),
    // "audio" | "video" | "data" — LiveKit's TrackType, lowercased. Left as
    // a plain string (like egress.status above) rather than a literal
    // union so an unrecognized future value doesn't fail validation.
    type: v.string(),
    // "unknown" | "camera" | "microphone" | "screen_share" |
    // "screen_share_audio" — LiveKit's TrackSource, lowercased.
    source: v.string(),
    name: v.optional(v.string()),
    // Snapshot from the track_published payload only. LiveKit has no
    // webhook for a live mute/unmute toggle, so this goes stale if a
    // participant mutes client-side — it's only refreshed here at publish
    // time and whenever this component's own mutePublishedTrack succeeds.
    muted: v.boolean(),
    mimeType: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    unpublishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_trackSid", ["trackSid"])
    .index("by_roomName", ["roomName"])
    .index("by_participant", ["roomName", "participantIdentity"]),

  // One row per ingress endpoint. Unlike rooms/participants/tracks, a
  // deleted ingress is actually removed (see removeIngress in lib.ts) rather
  // than kept as history — it's a provisioned resource, not a lifecycle
  // event, so a stale row wouldn't mean anything once LiveKit forgets it.
  ingress: defineTable({
    ingressId: v.string(),
    name: v.optional(v.string()),
    roomName: v.string(),
    participantIdentity: v.string(),
    participantName: v.optional(v.string()),
    inputType: v.union(v.literal("rtmp"), v.literal("whip"), v.literal("url")),
    url: v.optional(v.string()),
    // RTMP encoder credential. Treat like the LiveKit API secret: never
    // expose this to a browser/client, only read it server-side.
    streamKey: v.optional(v.string()),
    reusable: v.optional(v.boolean()),
    enabled: v.optional(v.boolean()),
    // "ENDPOINT_INACTIVE" | "ENDPOINT_BUFFERING" | "ENDPOINT_PUBLISHING" |
    // "ENDPOINT_ERROR" | "ENDPOINT_COMPLETE" — LiveKit's IngressState.status,
    // kept verbatim, same convention as egress.status above.
    state: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ingressId", ["ingressId"])
    .index("by_roomName", ["roomName"]),

  webhookEvents: defineTable({
    eventId: v.string(), // LiveKit's own webhook event `id`
    eventType: v.string(), // the `event` field, e.g. "room_started"
    payload: v.string(),
    receivedAt: v.number(),
  }).index("by_eventId", ["eventId"]),
});
