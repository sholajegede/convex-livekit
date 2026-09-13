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

describe("dashboard queries", () => {
  test("getStats counts rooms, live rooms, joined participants, egress, and webhook events", async () => {
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
