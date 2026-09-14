import { describe, expect, test } from "vitest";
import { initConvexTest } from "./setup.test.js";
import { api } from "./_generated/api.js";

describe("rooms", () => {
  test("recordRoom inserts then transitions to finished via markRoomFinished", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordRoom, {
      name: "standup",
      sid: "RM_1",
      status: "started",
      maxParticipants: 10,
    });

    let room = await t.query(api.lib.getRoom, { name: "standup" });
    expect(room?.status).toBe("started");
    expect(room?.maxParticipants).toBe(10);

    await t.mutation(api.lib.markRoomFinished, { name: "standup" });

    room = await t.query(api.lib.getRoom, { name: "standup" });
    expect(room?.status).toBe("finished");
    // markRoomFinished only patches status/endedAt — it must not blank
    // fields recorded when the room started.
    expect(room?.maxParticipants).toBe(10);
    expect(room?.endedAt).toBeDefined();
  });

  test("patchRoomMetadata updates only metadata", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordRoom, {
      name: "town-hall",
      status: "started",
      maxParticipants: 500,
    });

    await t.mutation(api.lib.patchRoomMetadata, {
      name: "town-hall",
      metadata: JSON.stringify({ topic: "Q3 all-hands" }),
    });

    const room = await t.query(api.lib.getRoom, { name: "town-hall" });
    expect(room?.metadata).toBe(JSON.stringify({ topic: "Q3 all-hands" }));
    expect(room?.maxParticipants).toBe(500);
  });

  test("patchRoomParticipantCount updates the count without touching status or metadata", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordRoom, {
      name: "standup",
      status: "started",
      maxParticipants: 10,
      metadata: JSON.stringify({ topic: "daily" }),
    });

    // Simulates a participant_joined event reporting the room's live count.
    await t.mutation(api.lib.patchRoomParticipantCount, {
      name: "standup",
      numParticipants: 3,
    });

    const room = await t.query(api.lib.getRoom, { name: "standup" });
    expect(room?.numParticipants).toBe(3);
    expect(room?.status).toBe("started");
    expect(room?.metadata).toBe(JSON.stringify({ topic: "daily" }));
  });

  test("patchRoomParticipantCount is a no-op for a room that isn't recorded yet", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.patchRoomParticipantCount, {
      name: "ghost-room",
      numParticipants: 2,
    });

    const room = await t.query(api.lib.getRoom, { name: "ghost-room" });
    expect(room).toBeNull();
  });
});

describe("participants", () => {
  test("recordParticipant tracks join then leave without losing joinedAt", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordParticipant, {
      participantSid: "PA_1",
      roomName: "standup",
      identity: "user_1",
      state: "joined",
      joinedAt: 1000,
    });

    await t.mutation(api.lib.recordParticipant, {
      participantSid: "PA_1",
      roomName: "standup",
      identity: "user_1",
      state: "left",
      leftAt: 2000,
    });

    const participants = await t.query(api.lib.listParticipantsByRoom, {
      roomName: "standup",
    });
    expect(participants).toHaveLength(1);
    expect(participants[0].state).toBe("left");
    expect(participants[0].joinedAt).toBe(1000);
    expect(participants[0].leftAt).toBe(2000);
  });

  test("markParticipantLeftByIdentity marks the participant left", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordParticipant, {
      participantSid: "PA_2",
      roomName: "standup",
      identity: "user_2",
      state: "joined",
    });

    await t.mutation(api.lib.markParticipantLeftByIdentity, {
      roomName: "standup",
      identity: "user_2",
    });

    const participants = await t.query(api.lib.listParticipantsByRoom, {
      roomName: "standup",
    });
    const found = participants.find((p) => p.identity === "user_2");
    expect(found?.state).toBe("left");
  });

  test("recordParticipant stores attributes, e.g. an agent's broadcast state", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordParticipant, {
      participantSid: "PA_3",
      roomName: "support-call",
      identity: "agent_1",
      state: "joined",
      attributes: { "lk.agent.state": "listening" },
    });

    const participants = await t.query(api.lib.listParticipantsByRoom, {
      roomName: "support-call",
    });
    expect(participants[0].attributes).toEqual({ "lk.agent.state": "listening" });
  });

  test("patchParticipant updates metadata/name/attributes without touching join state", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordParticipant, {
      participantSid: "PA_4",
      roomName: "support-call",
      identity: "agent_1",
      state: "joined",
      attributes: { "lk.agent.state": "listening" },
    });

    await t.mutation(api.lib.patchParticipant, {
      roomName: "support-call",
      identity: "agent_1",
      attributes: { "lk.agent.state": "speaking" },
    });

    const participants = await t.query(api.lib.listParticipantsByRoom, {
      roomName: "support-call",
    });
    expect(participants[0].attributes).toEqual({ "lk.agent.state": "speaking" });
    // patchParticipant must never be able to mark someone left — that's
    // markParticipantLeftByIdentity's job, not UpdateParticipant's.
    expect(participants[0].state).toBe("joined");
  });

  test("patchParticipant is a no-op for a participant that isn't recorded yet", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.patchParticipant, {
      roomName: "ghost-room",
      identity: "nobody",
      name: "Ghost",
    });

    const participants = await t.query(api.lib.listParticipantsByRoom, {
      roomName: "ghost-room",
    });
    expect(participants).toHaveLength(0);
  });
});

describe("egress", () => {
  test("recordEgress upserts by egressId", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordEgress, {
      egressId: "EG_1",
      roomName: "standup",
      status: "EGRESS_STARTING",
    });

    let egress = await t.query(api.lib.getEgress, { egressId: "EG_1" });
    expect(egress?.status).toBe("EGRESS_STARTING");

    await t.mutation(api.lib.recordEgress, {
      egressId: "EG_1",
      roomName: "standup",
      status: "EGRESS_COMPLETE",
    });

    egress = await t.query(api.lib.getEgress, { egressId: "EG_1" });
    expect(egress?.status).toBe("EGRESS_COMPLETE");
  });
});

describe("tracks", () => {
  test("recordTrack inserts then transitions to unpublished via markTrackUnpublished", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordTrack, {
      trackSid: "TR_1",
      roomName: "standup",
      participantIdentity: "user_1",
      type: "audio",
      source: "microphone",
      muted: false,
    });

    let track = await t.query(api.lib.getTrack, { trackSid: "TR_1" });
    expect(track?.source).toBe("microphone");
    expect(track?.unpublishedAt).toBeUndefined();

    await t.mutation(api.lib.markTrackUnpublished, { trackSid: "TR_1" });

    track = await t.query(api.lib.getTrack, { trackSid: "TR_1" });
    expect(track?.unpublishedAt).toBeDefined();
    // Unpublishing keeps the row (history), same as rooms/participants —
    // it doesn't delete it.
    expect(track?.source).toBe("microphone");
  });

  test("patchTrackMuted updates only muted", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordTrack, {
      trackSid: "TR_2",
      roomName: "standup",
      participantIdentity: "user_1",
      type: "audio",
      source: "microphone",
      muted: false,
    });

    await t.mutation(api.lib.patchTrackMuted, { trackSid: "TR_2", muted: true });

    const track = await t.query(api.lib.getTrack, { trackSid: "TR_2" });
    expect(track?.muted).toBe(true);
    expect(track?.source).toBe("microphone");
  });

  test("patchTrackMuted is a no-op for a track that isn't recorded yet", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.patchTrackMuted, { trackSid: "TR_ghost", muted: true });

    const track = await t.query(api.lib.getTrack, { trackSid: "TR_ghost" });
    expect(track).toBeNull();
  });

  test("listTracksByParticipant scopes to one participant in a room with several", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordTrack, {
      trackSid: "TR_10",
      roomName: "standup",
      participantIdentity: "user_1",
      type: "audio",
      source: "microphone",
      muted: false,
    });
    await t.mutation(api.lib.recordTrack, {
      trackSid: "TR_11",
      roomName: "standup",
      participantIdentity: "user_2",
      type: "video",
      source: "camera",
      muted: false,
    });

    const tracks = await t.query(api.lib.listTracksByParticipant, {
      roomName: "standup",
      participantIdentity: "user_1",
    });
    expect(tracks).toHaveLength(1);
    expect(tracks[0].trackSid).toBe("TR_10");
  });

  test("listTracksByRoom returns every track in the room, most-recently-updated first", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordTrack, {
      trackSid: "TR_20",
      roomName: "standup",
      participantIdentity: "user_1",
      type: "audio",
      source: "microphone",
      muted: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await t.mutation(api.lib.recordTrack, {
      trackSid: "TR_21",
      roomName: "standup",
      participantIdentity: "user_2",
      type: "video",
      source: "screen_share",
      muted: false,
    });

    const tracks = await t.query(api.lib.listTracksByRoom, { roomName: "standup" });
    expect(tracks).toHaveLength(2);
    expect(tracks[0].trackSid).toBe("TR_21");
  });
});

describe("ingress", () => {
  test("recordIngress upserts by ingressId", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordIngress, {
      ingressId: "IN_1",
      roomName: "standup",
      participantIdentity: "rtmp-encoder",
      inputType: "rtmp",
      url: "rtmp://ingest.example.com/live",
      streamKey: "sk_live_1",
    });

    let ingress = await t.query(api.lib.getIngress, { ingressId: "IN_1" });
    expect(ingress?.inputType).toBe("rtmp");
    expect(ingress?.state).toBeUndefined();

    await t.mutation(api.lib.recordIngress, {
      ingressId: "IN_1",
      roomName: "standup",
      participantIdentity: "rtmp-encoder",
      inputType: "rtmp",
      state: "ENDPOINT_PUBLISHING",
    });

    ingress = await t.query(api.lib.getIngress, { ingressId: "IN_1" });
    expect(ingress?.state).toBe("ENDPOINT_PUBLISHING");
  });

  test("removeIngress deletes the row, unlike the keep-history mutations for other tables", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordIngress, {
      ingressId: "IN_2",
      roomName: "standup",
      participantIdentity: "rtmp-encoder",
      inputType: "whip",
    });
    expect(await t.query(api.lib.getIngress, { ingressId: "IN_2" })).not.toBeNull();

    await t.mutation(api.lib.removeIngress, { ingressId: "IN_2" });
    expect(await t.query(api.lib.getIngress, { ingressId: "IN_2" })).toBeNull();
  });

  test("removeIngress is a no-op for an ingress that isn't recorded", async () => {
    const t = initConvexTest();
    await t.mutation(api.lib.removeIngress, { ingressId: "IN_ghost" });
    expect(await t.query(api.lib.getIngress, { ingressId: "IN_ghost" })).toBeNull();
  });

  test("listIngressByRoom scopes to one room", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordIngress, {
      ingressId: "IN_10",
      roomName: "standup",
      participantIdentity: "encoder-1",
      inputType: "rtmp",
    });
    await t.mutation(api.lib.recordIngress, {
      ingressId: "IN_11",
      roomName: "town-hall",
      participantIdentity: "encoder-2",
      inputType: "url",
    });

    const ingress = await t.query(api.lib.listIngressByRoom, { roomName: "standup" });
    expect(ingress).toHaveLength(1);
    expect(ingress[0].ingressId).toBe("IN_10");
  });
});

describe("dashboard queries", () => {
  test("getStats counts rooms, live rooms, joined participants, egress, tracks, ingress, and webhook events", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordRoom, { name: "r1", status: "started" });
    await t.mutation(api.lib.recordRoom, { name: "r2", status: "started" });
    await t.mutation(api.lib.markRoomFinished, { name: "r2" });

    await t.mutation(api.lib.recordParticipant, {
      participantSid: "PA_10",
      roomName: "r1",
      identity: "user_10",
      state: "joined",
    });
    await t.mutation(api.lib.recordParticipant, {
      participantSid: "PA_11",
      roomName: "r1",
      identity: "user_11",
      state: "left",
    });

    await t.mutation(api.lib.recordEgress, { egressId: "EG_10", status: "EGRESS_ACTIVE" });

    await t.mutation(api.lib.recordIngress, {
      ingressId: "IN_stats",
      roomName: "r1",
      participantIdentity: "encoder",
      inputType: "rtmp",
    });

    await t.mutation(api.lib.recordTrack, {
      trackSid: "TR_30",
      roomName: "r1",
      participantIdentity: "user_10",
      type: "audio",
      source: "microphone",
      muted: false,
    });
    await t.mutation(api.lib.recordTrack, {
      trackSid: "TR_31",
      roomName: "r1",
      participantIdentity: "user_10",
      type: "video",
      source: "camera",
      muted: false,
    });
    await t.mutation(api.lib.markTrackUnpublished, { trackSid: "TR_31" });

    await t.mutation(api.lib.checkAndRecordEvent, {
      eventId: "evt_10",
      eventType: "room_started",
      payload: "{}",
    });

    const stats = await t.query(api.lib.getStats, {});
    expect(stats.roomCount).toBe(2);
    expect(stats.liveRoomCount).toBe(1);
    expect(stats.participantCount).toBe(1);
    expect(stats.egressCount).toBe(1);
    expect(stats.trackCount).toBe(2);
    expect(stats.liveTrackCount).toBe(1);
    expect(stats.ingressCount).toBe(1);
    expect(stats.webhookEventCount).toBe(1);
  });

  test("listRecentParticipants returns participants most-recently-updated first", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordParticipant, {
      participantSid: "PA_20",
      roomName: "r1",
      identity: "user_20",
      state: "joined",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await t.mutation(api.lib.recordParticipant, {
      participantSid: "PA_21",
      roomName: "r1",
      identity: "user_21",
      state: "joined",
    });

    const recent = await t.query(api.lib.listRecentParticipants, {});
    expect(recent[0].participantSid).toBe("PA_21");
    expect(recent[1].participantSid).toBe("PA_20");
  });

  test("listRecentEgress returns egress jobs most-recently-updated first", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordEgress, { egressId: "EG_20", status: "EGRESS_STARTING" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await t.mutation(api.lib.recordEgress, { egressId: "EG_21", status: "EGRESS_STARTING" });

    const recent = await t.query(api.lib.listRecentEgress, {});
    expect(recent[0].egressId).toBe("EG_21");
    expect(recent[1].egressId).toBe("EG_20");
  });

  test("listRecentWebhookEvents returns events most-recent first", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.checkAndRecordEvent, {
      eventId: "evt_20",
      eventType: "room_started",
      payload: "{}",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await t.mutation(api.lib.checkAndRecordEvent, {
      eventId: "evt_21",
      eventType: "room_finished",
      payload: "{}",
    });

    const recent = await t.query(api.lib.listRecentWebhookEvents, {});
    expect(recent[0].eventId).toBe("evt_21");
    expect(recent[1].eventId).toBe("evt_20");
  });
});

describe("webhook idempotency", () => {
  test("checkAndRecordEvent flags duplicate event ids", async () => {
    const t = initConvexTest();

    const first = await t.mutation(api.lib.checkAndRecordEvent, {
      eventId: "evt_1",
      eventType: "room_started",
      payload: "{}",
    });
    expect(first.alreadyProcessed).toBe(false);

    const second = await t.mutation(api.lib.checkAndRecordEvent, {
      eventId: "evt_1",
      eventType: "room_started",
      payload: "{}",
    });
    expect(second.alreadyProcessed).toBe(true);
  });
});
