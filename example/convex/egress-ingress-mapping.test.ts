import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import schema from "../../src/component/schema.js";
import { api } from "./_generated/api.js";

// Fixed so example.ts (imported lazily by convex-test's module glob, the
// first time t.action runs) picks up known values from process.env.
process.env.LIVEKIT_API_KEY = "test-api-key";
process.env.LIVEKIT_API_SECRET = "test-api-secret";
process.env.LIVEKIT_HOST = "https://test.livekit.cloud";

const modules = import.meta.glob("./**/*.ts");
const componentModules = import.meta.glob("../../src/component/**/*.ts");

function initConvexTest() {
  const t = convexTest(schema, modules);
  t.registerComponent("convexLivekit", schema, componentModules);
  return t;
}

// LiveKit's Twirp APIs return protobuf JSON using the original snake_case
// proto field names — confirmed against a live StartRoomCompositeEgress
// response (`{ egress_id, room_name, started_at, ... }`), not the
// lowerCamelCase this client's response types assumed. Every fixture below
// mirrors that real shape; a fixture spelled `egressId` would pass even
// with the bug, since it wouldn't exercise the mismatch at all.
function mockFetchOnce(body: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Egress/Ingress Twirp responses (real snake_case field names)", () => {
  test("startRoomCompositeEgress maps egress_id/room_name to egressId/roomName", async () => {
    const t = initConvexTest();
    mockFetchOnce({
      egress_id: "EG_abc123",
      room_id: "RM_xyz",
      room_name: "main-stage",
      status: "EGRESS_STARTING",
    });

    const result = await t.action(api.example.startRoomCompositeEgress, {
      roomName: "main-stage",
      streamUrls: ["rtmp://example.com/live"],
    });

    // Before the fix this threw ArgumentValidationError: recordEgress
    // requires `egressId`, but `egressInfo.egressId` read off a snake_case
    // response was always undefined.
    expect(result.egressId).toBe("EG_abc123");
    expect(result.status).toBe("EGRESS_STARTING");

    const egress = await t.query(api.example.getEgress, { egressId: "EG_abc123" });
    expect(egress?.roomName).toBe("main-stage");
  });

  test("createIngress maps ingress_id/stream_key/input_type to camelCase", async () => {
    const t = initConvexTest();
    mockFetchOnce({
      ingress_id: "IN_abc123",
      name: "obs-stream",
      room_name: "main-stage",
      participant_identity: "obs-encoder",
      participant_name: "obs-encoder",
      input_type: "RTMP_INPUT",
      url: "rtmp://ingest.example.com/live",
      stream_key: "sk_live_abc",
      reusable: true,
      enabled: true,
    });

    const result = await t.action(api.example.createIngress, {
      inputType: "rtmp",
      name: "obs-stream",
      roomName: "main-stage",
      participantIdentity: "obs-encoder",
      participantName: "obs-encoder",
    });

    expect(result.ingressId).toBe("IN_abc123");
    expect(result.streamKey).toBe("sk_live_abc");

    const ingress = await t.query(api.example.listIngressByRoom, { roomName: "main-stage" });
    expect(ingress).toHaveLength(1);
    expect(ingress[0].participantIdentity).toBe("obs-encoder");
    expect(ingress[0].streamKey).toBe("sk_live_abc");
  });

  test("createRoom maps empty_timeout/max_participants/num_participants to camelCase", async () => {
    const t = initConvexTest();
    mockFetchOnce({
      sid: "RM_xyz",
      name: "main-stage",
      empty_timeout: 300,
      max_participants: 50,
      num_participants: 0,
      creation_time: 1700000000,
    });

    await t.action(api.example.createRoom, { name: "main-stage" });

    const room = await t.query(api.example.getRoom, { name: "main-stage" });
    // These were silently undefined before the fix — optional fields, so
    // the bug never threw here, it just quietly dropped the data.
    expect(room?.maxParticipants).toBe(50);
    expect(room?.emptyTimeout).toBe(300);
  });
});
