import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../../src/component/schema.js";
import { api } from "./_generated/api.js";

// Fixed so every test signs against the same values example/convex/http.ts
// picks up from process.env at import time (before this file ever calls
// initConvexTest / t.fetch, which is what triggers that module's first,
// lazy import).
const API_KEY = "test-api-key";
const API_SECRET = "test-api-secret";
process.env.LIVEKIT_API_KEY = API_KEY;
process.env.LIVEKIT_API_SECRET = API_SECRET;
process.env.LIVEKIT_HOST = "https://test.livekit.cloud";

const modules = import.meta.glob("./**/*.ts");
const componentModules = import.meta.glob("../../src/component/**/*.ts");

function initConvexTest() {
  const t = convexTest(schema, modules);
  t.registerComponent("convexLivekit", schema, componentModules);
  return t;
}

// ─── An independent HS256 JWT signer ───────────────────────────────────────
// Deliberately not imported from src/client/index.ts: this is a from-scratch
// re-implementation so the test actually exercises the handler's
// verification against a signature it didn't produce itself, the same way
// LiveKit's own server signs webhook requests.

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

async function sha256Base64(message: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message)),
  );
  let binary = "";
  for (let i = 0; i < digest.length; i++) binary += String.fromCharCode(digest[i]);
  return btoa(binary);
}

async function signWebhookToken(
  apiSecret: string,
  body: string,
  opts: { issuer?: string; expiresInSec?: number; bodyToDigest?: string } = {},
): Promise<string> {
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: opts.issuer ?? API_KEY,
    exp: now + (opts.expiresInSec ?? 60),
    nbf: now,
    sha256: await sha256Base64(opts.bodyToDigest ?? body),
  };
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = await hmacSha256(apiSecret, signingInput);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function postWebhook(
  t: TestConvex<typeof schema>,
  body: string,
  opts: { secret?: string; issuer?: string; expiresInSec?: number; bodyToDigest?: string; noAuth?: boolean } = {},
) {
  if (opts.noAuth) {
    return t.fetch("/webhooks/livekit", { method: "POST", body });
  }
  const token = await signWebhookToken(opts.secret ?? API_SECRET, body, opts);
  return t.fetch("/webhooks/livekit", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
}

function event(overrides: Record<string, unknown>) {
  return JSON.stringify({ id: "evt_1", event: "room_started", ...overrides });
}

describe("webhook signature verification", () => {
  test("rejects a request with no Authorization header", async () => {
    const t = initConvexTest();
    const res = await postWebhook(t, event({}), { noAuth: true });
    expect(res.status).toBe(400);
  });

  test("rejects a request signed with the wrong secret", async () => {
    const t = initConvexTest();
    const body = event({});
    const res = await postWebhook(t, body, { secret: "wrong-secret" });
    expect(res.status).toBe(401);
  });

  test("rejects a token whose issuer doesn't match the configured API key", async () => {
    const t = initConvexTest();
    const body = event({});
    const res = await postWebhook(t, body, { issuer: "someone-elses-key" });
    expect(res.status).toBe(401);
  });

  test("rejects an expired token", async () => {
    const t = initConvexTest();
    const body = event({});
    // 60s clock tolerance in the handler — go well past it.
    const res = await postWebhook(t, body, { expiresInSec: -300 });
    expect(res.status).toBe(401);
  });

  test("rejects a tampered body — signed for one payload, sent as another", async () => {
    const t = initConvexTest();
    const signedFor = event({ id: "evt_1" });
    const actuallySent = event({ id: "evt_2" });
    const token = await signWebhookToken(API_SECRET, signedFor);
    const res = await t.fetch("/webhooks/livekit", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: actuallySent,
    });
    expect(res.status).toBe(401);
  });

  test("accepts a validly signed event", async () => {
    const t = initConvexTest();
    const res = await postWebhook(
      t,
      event({
        room: { name: "standup", sid: "RM_1", numParticipants: 0 },
      }),
    );
    expect(res.status).toBe(200);
    const room = await t.query(api.example.getRoom, { name: "standup" });
    expect(room?.status).toBe("started");
  });
});

describe("webhook idempotency", () => {
  test("a duplicate event id is reported as duplicate and not reprocessed", async () => {
    const t = initConvexTest();
    const body = event({
      id: "evt_dup",
      room: { name: "standup", sid: "RM_1", numParticipants: 0 },
    });

    const first = await postWebhook(t, body);
    expect(first.status).toBe(200);
    expect((await first.json()).duplicate).toBeUndefined();

    const second = await postWebhook(t, body);
    expect(second.status).toBe(200);
    expect((await second.json()).duplicate).toBe(true);
  });
});

describe("participant lifecycle", () => {
  test("participant_connection_aborted marks the participant left, same as participant_left", async () => {
    const t = initConvexTest();

    await postWebhook(
      t,
      event({
        id: "evt_join",
        event: "participant_joined",
        room: { name: "standup" },
        participant: { sid: "PA_1", identity: "user_1" },
      }),
    );
    let participants = await t.query(api.example.listParticipantsByRoom, { roomName: "standup" });
    expect(participants[0].state).toBe("joined");

    await postWebhook(
      t,
      event({
        id: "evt_abort",
        event: "participant_connection_aborted",
        room: { name: "standup" },
        participant: { sid: "PA_1", identity: "user_1" },
      }),
    );
    participants = await t.query(api.example.listParticipantsByRoom, { roomName: "standup" });
    expect(participants[0].state).toBe("left");
  });
});

describe("ingress lifecycle", () => {
  test("ingress_started upserts the ingress row, ingress_ended patches its live state", async () => {
    const t = initConvexTest();

    await postWebhook(
      t,
      event({
        id: "evt_ingress_start",
        event: "ingress_started",
        ingressInfo: {
          ingressId: "IN_1",
          name: "obs-stream",
          roomName: "standup",
          participantIdentity: "rtmp-encoder",
          inputType: "RTMP_INPUT",
          url: "rtmp://ingest.example.com/live",
          streamKey: "sk_live_1",
          state: { status: "ENDPOINT_BUFFERING" },
        },
      }),
    );

    let ingress = await t.query(api.example.listIngressByRoom, { roomName: "standup" });
    expect(ingress).toHaveLength(1);
    expect(ingress[0].inputType).toBe("rtmp");
    expect(ingress[0].state).toBe("ENDPOINT_BUFFERING");

    await postWebhook(
      t,
      event({
        id: "evt_ingress_publishing",
        event: "ingress_ended",
        ingressInfo: {
          ingressId: "IN_1",
          roomName: "standup",
          participantIdentity: "rtmp-encoder",
          inputType: "RTMP_INPUT",
          state: { status: "ENDPOINT_COMPLETE" },
        },
      }),
    );

    ingress = await t.query(api.example.listIngressByRoom, { roomName: "standup" });
    expect(ingress[0].state).toBe("ENDPOINT_COMPLETE");
  });
});

describe("real LiveKit payload shape (snake_case)", () => {
  // The tests above all use camelCase fixtures, which happens to match
  // what the handler expected before the snake_case/camelCase fix — so
  // they'd have passed even with the bug. These mirror LiveKit's actual
  // wire format (confirmed against a live Egress response) and would have
  // failed against the old code, since `event.egressInfo`/`event.ingressInfo`
  // are undefined when the real top-level keys are `egress_info`/`ingress_info`.
  test("egress_started (egress_info, snake_case) records the egress row", async () => {
    const t = initConvexTest();
    await postWebhook(
      t,
      event({
        id: "evt_egress_start",
        event: "egress_started",
        egress_info: {
          egress_id: "EG_1",
          room_name: "standup",
          status: "EGRESS_STARTING",
        },
      }),
    );

    const egress = await t.query(api.example.getEgress, { egressId: "EG_1" });
    expect(egress?.status).toBe("EGRESS_STARTING");
    expect(egress?.roomName).toBe("standup");
  });

  test("ingress_started (ingress_info, snake_case) records the ingress row", async () => {
    const t = initConvexTest();
    await postWebhook(
      t,
      event({
        id: "evt_ingress_start_snake",
        event: "ingress_started",
        ingress_info: {
          ingress_id: "IN_2",
          room_name: "standup",
          participant_identity: "rtmp-encoder",
          input_type: "RTMP_INPUT",
          stream_key: "sk_live_2",
          state: { status: "ENDPOINT_BUFFERING" },
        },
      }),
    );

    const ingress = await t.query(api.example.listIngressByRoom, { roomName: "standup" });
    expect(ingress).toHaveLength(1);
    expect(ingress[0].participantIdentity).toBe("rtmp-encoder");
    expect(ingress[0].streamKey).toBe("sk_live_2");
    expect(ingress[0].state).toBe("ENDPOINT_BUFFERING");
  });

  test("room_started with num_participants (snake_case) syncs the live count", async () => {
    const t = initConvexTest();
    await postWebhook(
      t,
      event({
        id: "evt_room_snake",
        room: { name: "town-hall", sid: "RM_2", num_participants: 3, max_participants: 100 },
      }),
    );

    const room = await t.query(api.example.getRoom, { name: "town-hall" });
    expect(room?.numParticipants).toBe(3);
    expect(room?.maxParticipants).toBe(100);
  });
});

describe("track lifecycle", () => {
  test("track_published syncs a track, track_unpublished marks it unpublished", async () => {
    const t = initConvexTest();

    await postWebhook(
      t,
      event({
        id: "evt_track_pub",
        event: "track_published",
        room: { name: "standup" },
        participant: { sid: "PA_1", identity: "user_1" },
        track: { sid: "TR_1", type: "AUDIO", source: "MICROPHONE", muted: false },
      }),
    );

    let tracks = await t.query(api.example.listTracksByRoom, { roomName: "standup" });
    expect(tracks).toHaveLength(1);
    expect(tracks[0].type).toBe("audio");
    expect(tracks[0].source).toBe("microphone");
    expect(tracks[0].unpublishedAt).toBeUndefined();

    await postWebhook(
      t,
      event({
        id: "evt_track_unpub",
        event: "track_unpublished",
        room: { name: "standup" },
        participant: { sid: "PA_1", identity: "user_1" },
        track: { sid: "TR_1", type: "AUDIO", source: "MICROPHONE", muted: false },
      }),
    );

    tracks = await t.query(api.example.listTracksByRoom, { roomName: "standup" });
    expect(tracks[0].unpublishedAt).toBeDefined();
  });
});
