import { httpActionGeneric } from "convex/server";
import type { GenericActionCtx, GenericDataModel } from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";

export type LiveKitOptions = {
  apiKey: string;
  apiSecret: string;
  /** Your LiveKit server/Cloud project URL, e.g. "https://my-project.livekit.cloud". */
  host: string;
};

export type CreateRoomArgs = {
  name: string;
  emptyTimeout?: number;
  maxParticipants?: number;
  metadata?: string;
};

export type CreateRoomTokenArgs = {
  roomName: string;
  identity: string;
  name?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  metadata?: string;
  ttlSeconds?: number;
};

export type UpdateParticipantArgs = {
  roomName: string;
  identity: string;
  metadata?: string;
  name?: string;
  /** LiveKit Agents uses this map to broadcast agent state (e.g. "lk.agent.state"). */
  attributes?: Record<string, string>;
  permission?: {
    canSubscribe?: boolean;
    canPublish?: boolean;
    canPublishData?: boolean;
    hidden?: boolean;
  };
};

export type MutePublishedTrackArgs = {
  roomName: string;
  identity: string;
  trackSid: string;
  muted: boolean;
};

export type StartRoomCompositeEgressArgs = {
  roomName: string;
  layout?: string;
  audioOnly?: boolean;
  videoOnly?: boolean;
  /** Writes the recording to this file path, via whatever storage (S3/GCP/Azure/local) your LiveKit server is configured with. */
  filepath?: string;
  /** Livestreams the recording out to one or more RTMP(S) URLs. */
  streamUrls?: string[];
};

export type CreateIngressArgs = {
  inputType: "rtmp" | "whip" | "url";
  name: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
  /** Required when inputType is "url"; ignored otherwise. */
  url?: string;
  /** WHIP ingress cannot disable transcoding. */
  enableTranscoding?: boolean;
};

export type UpdateIngressArgs = {
  ingressId: string;
  name?: string;
  roomName?: string;
  participantIdentity?: string;
  participantName?: string;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function bytesToBinaryString(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return binary;
}

function base64Encode(bytes: Uint8Array): string {
  return btoa(bytesToBinaryString(bytes));
}

function base64UrlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecodeToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(signature);
}

/**
 * Signs a LiveKit access token (HS256 JWT) carrying the given video grant.
 * Used both for short-lived server-API call tokens (`roomCreate`/`roomAdmin`
 * grants) and for room-join tokens handed to clients (`roomJoin` grant).
 */
async function signLiveKitToken(
  apiKey: string,
  apiSecret: string,
  videoGrant: Record<string, unknown>,
  opts: { identity?: string; name?: string; metadata?: string; ttlSeconds?: number } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = opts.ttlSeconds ?? 600;
  const enc = new TextEncoder();

  const header = { alg: "HS256", typ: "JWT" };
  const payload: Record<string, unknown> = {
    iss: apiKey,
    nbf: now,
    exp: now + ttl,
    jti: crypto.randomUUID(),
    video: videoGrant,
  };
  if (opts.identity) payload.sub = opts.identity;
  if (opts.name) payload.name = opts.name;
  if (opts.metadata) payload.metadata = opts.metadata;

  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = await hmacSha256(apiSecret, signingInput);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

const TWIRP_MAX_ATTEMPTS = 3;
const TWIRP_BASE_DELAY_MS = 300;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exponential backoff (300ms, 600ms, 1200ms, ...) plus jitter, so a burst of
// retries from several concurrent calls doesn't all land on the same tick
// and immediately re-trip whatever rate limit tripped them.
function backoffDelayMs(attempt: number): number {
  return TWIRP_BASE_DELAY_MS * 2 ** attempt + Math.random() * TWIRP_BASE_DELAY_MS;
}

/**
 * Calls a LiveKit Twirp RPC (RoomService, Egress, or Ingress). Retries on
 * 429 and 5xx responses and on network-level failures (DNS, connection
 * reset), honoring `Retry-After` when LiveKit sends one; anything else
 * (400s other than 429) fails immediately since retrying a real client
 * error — a bad room name, say — would only waste time.
 */
async function twirpRequest<T>(
  host: string,
  apiKey: string,
  apiSecret: string,
  service: string,
  method: string,
  videoGrant: Record<string, unknown>,
  body: Record<string, unknown>,
): Promise<T> {
  const token = await signLiveKitToken(apiKey, apiSecret, videoGrant);
  const url = `${host.replace(/\/$/, "")}/twirp/livekit.${service}/${method}`;
  const payload = JSON.stringify(body);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  for (let attempt = 0; attempt < TWIRP_MAX_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === TWIRP_MAX_ATTEMPTS - 1;
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers, body: payload });
    } catch (err) {
      if (isLastAttempt) throw err;
      await sleep(backoffDelayMs(attempt));
      continue;
    }

    if (res.ok) {
      return (await res.json()) as T;
    }

    if (isLastAttempt || !isRetryableStatus(res.status)) {
      throw new Error(`LiveKit API error (${service}.${method}): ${res.status} ${await res.text()}`);
    }

    const retryAfterSeconds = Number(res.headers.get("Retry-After"));
    await sleep(
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : backoffDelayMs(attempt),
    );
  }

  // Unreachable — the loop above always returns or throws — but keeps this
  // function's return type honest for TypeScript.
  throw new Error(`LiveKit API error (${service}.${method}): exhausted retries`);
}

/** "RTMP_INPUT" | "WHIP_INPUT" | "URL_INPUT" -> "rtmp" | "whip" | "url". */
function mapInputTypeFromLiveKit(value: string): CreateIngressArgs["inputType"] {
  if (value === "WHIP_INPUT") return "whip";
  if (value === "URL_INPUT") return "url";
  return "rtmp";
}

const INPUT_TYPE_TO_LIVEKIT: Record<CreateIngressArgs["inputType"], string> = {
  rtmp: "RTMP_INPUT",
  whip: "WHIP_INPUT",
  url: "URL_INPUT",
};

type LiveKitRoom = {
  sid: string;
  name: string;
  emptyTimeout?: number;
  maxParticipants?: number;
  metadata?: string;
  creationTime?: number | string;
  numParticipants?: number;
};

type LiveKitEgressInfo = {
  egressId: string;
  roomName?: string;
  status: string;
  error?: string;
};

type LiveKitIngressInfo = {
  ingressId: string;
  name?: string;
  streamKey?: string;
  url?: string;
  inputType: string;
  roomName: string;
  participantIdentity: string;
  participantName?: string;
  reusable?: boolean;
  enabled?: boolean;
};

export class LiveKit {
  webhookHandler: ReturnType<typeof httpActionGeneric>;

  constructor(
    private component: ComponentApi,
    private options: LiveKitOptions,
  ) {
    const component_ = component;
    const { apiKey, apiSecret } = options;

    this.webhookHandler = httpActionGeneric(async (ctx, request) => {
      const rawBody = await request.text();
      let authHeader = request.headers.get("authorization");

      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (authHeader.toLowerCase().startsWith("bearer ")) {
        authHeader = authHeader.slice(7);
      }

      const parts = authHeader.split(".");
      if (parts.length !== 3) {
        return new Response(JSON.stringify({ error: "Malformed webhook token" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const [headerB64, payloadB64, signatureB64] = parts;

      const expectedSignature = base64UrlEncode(
        await hmacSha256(apiSecret, `${headerB64}.${payloadB64}`),
      );
      if (!timingSafeEqual(expectedSignature, signatureB64)) {
        console.error("convex-livekit: webhook signature mismatch");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const claims = JSON.parse(
        new TextDecoder().decode(base64UrlDecodeToBytes(payloadB64)),
      ) as Record<string, unknown>;

      if (claims.iss !== apiKey) {
        console.error("convex-livekit: webhook token issuer mismatch");
        return new Response(JSON.stringify({ error: "Invalid issuer" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const clockToleranceSec = 60;
      if (typeof claims.exp === "number" && nowSec > claims.exp + clockToleranceSec) {
        console.error("convex-livekit: webhook token expired");
        return new Response(JSON.stringify({ error: "Expired webhook token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const bodyDigest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody)),
      );
      if (claims.sha256 !== base64Encode(bodyDigest)) {
        console.error("convex-livekit: webhook body hash mismatch");
        return new Response(JSON.stringify({ error: "Body hash mismatch" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const event = JSON.parse(rawBody) as Record<string, unknown>;
      const eventId = event.id ? String(event.id) : undefined;
      const eventType = (event.event as string) ?? "unknown";

      if (!eventId) {
        return new Response(JSON.stringify({ error: "Missing event id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { alreadyProcessed } = await ctx.runMutation(component_.lib.checkAndRecordEvent, {
        eventId,
        eventType,
        payload: rawBody,
      });

      if (alreadyProcessed) {
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const room = event.room as Record<string, unknown> | undefined;
      const participant = event.participant as Record<string, unknown> | undefined;
      const track = event.track as Record<string, unknown> | undefined;
      const egressInfo = event.egressInfo as Record<string, unknown> | undefined;
      const ingressInfo = event.ingressInfo as Record<string, unknown> | undefined;

      // room_started/room_finished/participant_joined/participant_left all
      // embed the same live Room object — sync numParticipants off whichever
      // one arrives, not just room_started, so it never goes stale. No-ops
      // if the room isn't recorded yet or the field is absent from this event.
      if (room && typeof room.numParticipants === "number") {
        await ctx.runMutation(component_.lib.patchRoomParticipantCount, {
          name: String(room.name),
          numParticipants: room.numParticipants,
        });
      }

      if (eventType === "room_started" && room) {
        await ctx.runMutation(component_.lib.recordRoom, {
          name: String(room.name),
          sid: (room.sid as string) ?? undefined,
          status: "started",
          numParticipants: (room.numParticipants as number) ?? undefined,
          maxParticipants: (room.maxParticipants as number) ?? undefined,
          emptyTimeout: (room.emptyTimeout as number) ?? undefined,
          metadata: (room.metadata as string) ?? undefined,
          startedAt: room.creationTime ? Number(room.creationTime) * 1000 : Date.now(),
        });
      } else if (eventType === "room_finished" && room) {
        await ctx.runMutation(component_.lib.markRoomFinished, { name: String(room.name) });
      } else if (eventType === "participant_joined" && room && participant) {
        await ctx.runMutation(component_.lib.recordParticipant, {
          participantSid: String(participant.sid),
          roomName: String(room.name),
          identity: String(participant.identity),
          name: (participant.name as string) ?? undefined,
          state: "joined",
          metadata: (participant.metadata as string) ?? undefined,
          attributes: (participant.attributes as Record<string, string>) ?? undefined,
          joinedAt: Date.now(),
        });
      } else if (
        (eventType === "participant_left" || eventType === "participant_connection_aborted") &&
        room &&
        participant
      ) {
        // Both events mean the participant is gone — a clean leave vs. an
        // unexpected connection drop. Treated identically here: without
        // this, an aborted connection would leave the row stuck at
        // state "joined" forever, since LiveKit never follows up with a
        // separate participant_left for the same disconnect.
        await ctx.runMutation(component_.lib.recordParticipant, {
          participantSid: String(participant.sid),
          roomName: String(room.name),
          identity: String(participant.identity),
          name: (participant.name as string) ?? undefined,
          state: "left",
          leftAt: Date.now(),
        });
      } else if (
        (eventType === "track_published" || eventType === "track_unpublished") &&
        room &&
        participant &&
        track
      ) {
        const trackSid = String(track.sid);
        if (eventType === "track_published") {
          await ctx.runMutation(component_.lib.recordTrack, {
            trackSid,
            roomName: String(room.name),
            participantIdentity: String(participant.identity),
            type: String(track.type ?? "unknown").toLowerCase(),
            source: String(track.source ?? "unknown").toLowerCase(),
            name: (track.name as string) ?? undefined,
            muted: Boolean(track.muted),
            mimeType: (track.mimeType as string) ?? undefined,
            publishedAt: Date.now(),
          });
        } else {
          await ctx.runMutation(component_.lib.markTrackUnpublished, { trackSid });
        }
      } else if (
        (eventType === "egress_started" ||
          eventType === "egress_updated" ||
          eventType === "egress_ended") &&
        egressInfo
      ) {
        await ctx.runMutation(component_.lib.recordEgress, {
          egressId: String(egressInfo.egressId),
          roomName: (egressInfo.roomName as string) ?? undefined,
          status: String(egressInfo.status ?? "unknown"),
          error: (egressInfo.error as string) ?? undefined,
          startedAt: eventType === "egress_started" ? Date.now() : undefined,
          endedAt: eventType === "egress_ended" ? Date.now() : undefined,
        });
      } else if (
        (eventType === "ingress_started" || eventType === "ingress_ended") &&
        ingressInfo
      ) {
        // ingressInfo is the full current IngressInfo either way (LiveKit
        // doesn't send a partial diff), so this is a plain upsert — same
        // shape as createIngress/updateIngress below.
        const state = ingressInfo.state as Record<string, unknown> | undefined;
        await ctx.runMutation(component_.lib.recordIngress, {
          ingressId: String(ingressInfo.ingressId),
          name: (ingressInfo.name as string) ?? undefined,
          roomName: String(ingressInfo.roomName ?? ""),
          participantIdentity: String(ingressInfo.participantIdentity ?? ""),
          participantName: (ingressInfo.participantName as string) ?? undefined,
          inputType: mapInputTypeFromLiveKit(String(ingressInfo.inputType ?? "RTMP_INPUT")),
          url: (ingressInfo.url as string) ?? undefined,
          streamKey: (ingressInfo.streamKey as string) ?? undefined,
          reusable: (ingressInfo.reusable as boolean) ?? undefined,
          enabled: (ingressInfo.enabled as boolean) ?? undefined,
          state:
            state && typeof state.status === "string" ? (state.status as string) : undefined,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  }

  async createRoom(
    ctx: RunMutationCtx,
    args: CreateRoomArgs,
  ): Promise<{ sid: string; name: string }> {
    const room = await twirpRequest<LiveKitRoom>(
      this.options.host,
      this.options.apiKey,
      this.options.apiSecret,
      "RoomService",
      "CreateRoom",
      { roomCreate: true },
      {
        name: args.name,
        emptyTimeout: args.emptyTimeout,
        maxParticipants: args.maxParticipants,
        metadata: args.metadata,
      },
    );

    await ctx.runMutation(this.component.lib.recordRoom, {
      name: room.name,
      sid: room.sid,
      status: "started",
      numParticipants: room.numParticipants,
      maxParticipants: room.maxParticipants,
      emptyTimeout: room.emptyTimeout,
      metadata: room.metadata,
      startedAt: room.creationTime ? Number(room.creationTime) * 1000 : Date.now(),
    });

    return { sid: room.sid, name: room.name };
  }

  async deleteRoom(
    ctx: RunMutationCtx,
    args: { name: string },
  ): Promise<void> {
    await twirpRequest(
      this.options.host,
      this.options.apiKey,
      this.options.apiSecret,
      "RoomService",
      "DeleteRoom",
      { roomCreate: true },
      { room: args.name },
    );
    await ctx.runMutation(this.component.lib.markRoomFinished, { name: args.name });
  }

  async updateRoomMetadata(
    ctx: RunMutationCtx,
    args: { name: string; metadata: string },
  ): Promise<void> {
    await twirpRequest(
      this.options.host,
      this.options.apiKey,
      this.options.apiSecret,
      "RoomService",
      "UpdateRoomMetadata",
      { roomAdmin: true, room: args.name },
      { room: args.name, metadata: args.metadata },
    );
    await ctx.runMutation(this.component.lib.patchRoomMetadata, args);
  }

  async removeParticipant(
    ctx: RunMutationCtx,
    args: { roomName: string; identity: string },
  ): Promise<void> {
    await twirpRequest(
      this.options.host,
      this.options.apiKey,
      this.options.apiSecret,
      "RoomService",
      "RemoveParticipant",
      { roomAdmin: true, room: args.roomName },
      { room: args.roomName, identity: args.identity },
    );
    await ctx.runMutation(this.component.lib.markParticipantLeftByIdentity, args);
  }

  /**
   * Updates a participant's permissions, metadata, display name, or
   * attributes. `attributes` is the field LiveKit Agents uses to broadcast
   * agent state (e.g. listening / thinking / speaking) — set it here to
   * push agent state that a Convex-backed UI can read reactively.
   */
  async updateParticipant(
    ctx: RunMutationCtx,
    args: UpdateParticipantArgs,
  ): Promise<void> {
    await twirpRequest(
      this.options.host,
      this.options.apiKey,
      this.options.apiSecret,
      "RoomService",
      "UpdateParticipant",
      { roomAdmin: true, room: args.roomName },
      {
        room: args.roomName,
        identity: args.identity,
        metadata: args.metadata,
        name: args.name,
        attributes: args.attributes,
        permission: args.permission,
      },
    );
    await ctx.runMutation(this.component.lib.patchParticipant, {
      roomName: args.roomName,
      identity: args.identity,
      metadata: args.metadata,
      name: args.name,
      attributes: args.attributes,
    });
  }

  /**
   * Mutes or unmutes a participant's published track. Only reflects mute
   * changes this component itself makes — LiveKit has no webhook for a
   * participant muting themselves client-side, so that case won't be
   * reflected in Convex until the track is next published/unpublished.
   */
  async mutePublishedTrack(
    ctx: RunMutationCtx,
    args: MutePublishedTrackArgs,
  ): Promise<void> {
    await twirpRequest(
      this.options.host,
      this.options.apiKey,
      this.options.apiSecret,
      "RoomService",
      "MutePublishedTrack",
      { roomAdmin: true, room: args.roomName },
      {
        room: args.roomName,
        identity: args.identity,
        trackSid: args.trackSid,
        muted: args.muted,
      },
    );
    await ctx.runMutation(this.component.lib.patchTrackMuted, {
      trackSid: args.trackSid,
      muted: args.muted,
    });
  }

  /**
   * Starts a room-composite recording or livestream. Uses LiveKit's
   * RoomCompositeEgress RPC — the original per-room egress API — rather
   * than the newer unified StartEgress endpoint: this request shape is
   * stable and fully documented, and room-composite already covers the two
   * cases this component is built for (record the whole room to a file, or
   * push it out as a livestream). LiveKit marks RoomCompositeEgress
   * "deprecated" in favor of StartEgress but continues to support it.
   */
  async startRoomCompositeEgress(
    ctx: RunMutationCtx,
    args: StartRoomCompositeEgressArgs,
  ): Promise<{ egressId: string; status: string }> {
    const fileOutputs = args.filepath ? [{ filepath: args.filepath }] : undefined;
    const streamOutputs = args.streamUrls?.length ? [{ urls: args.streamUrls }] : undefined;

    const egressInfo = await twirpRequest<LiveKitEgressInfo>(
      this.options.host,
      this.options.apiKey,
      this.options.apiSecret,
      "Egress",
      "StartRoomCompositeEgress",
      { roomRecord: true },
      {
        roomName: args.roomName,
        layout: args.layout,
        audioOnly: args.audioOnly,
        videoOnly: args.videoOnly,
        fileOutputs,
        streamOutputs,
      },
    );

    await ctx.runMutation(this.component.lib.recordEgress, {
      egressId: egressInfo.egressId,
      roomName: egressInfo.roomName ?? args.roomName,
      status: egressInfo.status ?? "EGRESS_STARTING",
      startedAt: Date.now(),
    });

    return { egressId: egressInfo.egressId, status: egressInfo.status };
  }

  /** Stops a running egress. LiveKit follows up with an `egress_ended` webhook once it fully finishes. */
  async stopEgress(
    ctx: RunMutationCtx,
    args: { egressId: string },
  ): Promise<{ status: string }> {
    const egressInfo = await twirpRequest<LiveKitEgressInfo>(
      this.options.host,
      this.options.apiKey,
      this.options.apiSecret,
      "Egress",
      "StopEgress",
      { roomRecord: true },
      { egressId: args.egressId },
    );

    // recordEgress (not a partial patch) since StopEgress's response is the
    // full current EgressInfo, same as the webhook path.
    await ctx.runMutation(this.component.lib.recordEgress, {
      egressId: args.egressId,
      roomName: egressInfo.roomName,
      status: egressInfo.status ?? "EGRESS_ENDING",
      error: egressInfo.error,
    });

    return { status: egressInfo.status };
  }

  /**
   * Provisions an ingress endpoint (RTMP, WHIP, or a pulled URL) that
   * publishes into a room as a regular participant — useful for bringing an
   * external encoder, OBS, or a existing stream into a LiveKit room.
   */
  async createIngress(
    ctx: RunMutationCtx,
    args: CreateIngressArgs,
  ): Promise<{ ingressId: string; url?: string; streamKey?: string }> {
    const ingressInfo = await twirpRequest<LiveKitIngressInfo>(
      this.options.host,
      this.options.apiKey,
      this.options.apiSecret,
      "Ingress",
      "CreateIngress",
      { ingressAdmin: true },
      {
        inputType: INPUT_TYPE_TO_LIVEKIT[args.inputType],
        name: args.name,
        roomName: args.roomName,
        participantIdentity: args.participantIdentity,
        participantName: args.participantName,
        url: args.url,
        enableTranscoding: args.enableTranscoding,
      },
    );

    await ctx.runMutation(this.component.lib.recordIngress, {
      ingressId: ingressInfo.ingressId,
      name: ingressInfo.name,
      roomName: ingressInfo.roomName,
      participantIdentity: ingressInfo.participantIdentity,
      participantName: ingressInfo.participantName,
      inputType: mapInputTypeFromLiveKit(ingressInfo.inputType),
      url: ingressInfo.url,
      streamKey: ingressInfo.streamKey,
      reusable: ingressInfo.reusable,
      enabled: ingressInfo.enabled,
    });

    return { ingressId: ingressInfo.ingressId, url: ingressInfo.url, streamKey: ingressInfo.streamKey };
  }

  /** Updates a reusable (RTMP/WHIP) ingress's name, target room, or participant identity/name. */
  async updateIngress(
    ctx: RunMutationCtx,
    args: UpdateIngressArgs,
  ): Promise<void> {
    const ingressInfo = await twirpRequest<LiveKitIngressInfo>(
      this.options.host,
      this.options.apiKey,
      this.options.apiSecret,
      "Ingress",
      "UpdateIngress",
      { ingressAdmin: true },
      {
        ingressId: args.ingressId,
        name: args.name,
        roomName: args.roomName,
        participantIdentity: args.participantIdentity,
        participantName: args.participantName,
      },
    );

    await ctx.runMutation(this.component.lib.recordIngress, {
      ingressId: ingressInfo.ingressId,
      name: ingressInfo.name,
      roomName: ingressInfo.roomName,
      participantIdentity: ingressInfo.participantIdentity,
      participantName: ingressInfo.participantName,
      inputType: mapInputTypeFromLiveKit(ingressInfo.inputType),
      url: ingressInfo.url,
      streamKey: ingressInfo.streamKey,
      reusable: ingressInfo.reusable,
      enabled: ingressInfo.enabled,
    });
  }

  /** Permanently removes an ingress endpoint. */
  async deleteIngress(
    ctx: RunMutationCtx,
    args: { ingressId: string },
  ): Promise<void> {
    await twirpRequest(
      this.options.host,
      this.options.apiKey,
      this.options.apiSecret,
      "Ingress",
      "DeleteIngress",
      { ingressAdmin: true },
      { ingressId: args.ingressId },
    );
    await ctx.runMutation(this.component.lib.removeIngress, { ingressId: args.ingressId });
  }

  /** Mints a room-join access token for a client to connect with. Touches no database. */
  async createRoomToken(args: CreateRoomTokenArgs): Promise<{ token: string }> {
    const token = await signLiveKitToken(
      this.options.apiKey,
      this.options.apiSecret,
      {
        roomJoin: true,
        room: args.roomName,
        canPublish: args.canPublish ?? true,
        canSubscribe: args.canSubscribe ?? true,
        canPublishData: args.canPublishData ?? true,
      },
      { identity: args.identity, name: args.name, metadata: args.metadata, ttlSeconds: args.ttlSeconds },
    );
    return { token };
  }

  async getRoom(ctx: RunQueryCtx, args: { name: string }) {
    return await ctx.runQuery(this.component.lib.getRoom, args);
  }

  async listRooms(ctx: RunQueryCtx, args: { limit?: number } = {}) {
    return await ctx.runQuery(this.component.lib.listRooms, args);
  }

  async listParticipantsByRoom(ctx: RunQueryCtx, args: { roomName: string; limit?: number }) {
    return await ctx.runQuery(this.component.lib.listParticipantsByRoom, args);
  }

  async getEgress(ctx: RunQueryCtx, args: { egressId: string }) {
    return await ctx.runQuery(this.component.lib.getEgress, args);
  }

  async listEgressByRoom(ctx: RunQueryCtx, args: { roomName: string; limit?: number }) {
    return await ctx.runQuery(this.component.lib.listEgressByRoom, args);
  }

  async getTrack(ctx: RunQueryCtx, args: { trackSid: string }) {
    return await ctx.runQuery(this.component.lib.getTrack, args);
  }

  async listTracksByRoom(ctx: RunQueryCtx, args: { roomName: string; limit?: number }) {
    return await ctx.runQuery(this.component.lib.listTracksByRoom, args);
  }

  async listTracksByParticipant(
    ctx: RunQueryCtx,
    args: { roomName: string; participantIdentity: string; limit?: number },
  ) {
    return await ctx.runQuery(this.component.lib.listTracksByParticipant, args);
  }

  async getIngress(ctx: RunQueryCtx, args: { ingressId: string }) {
    return await ctx.runQuery(this.component.lib.getIngress, args);
  }

  async listIngressByRoom(ctx: RunQueryCtx, args: { roomName: string; limit?: number }) {
    return await ctx.runQuery(this.component.lib.listIngressByRoom, args);
  }

  async getStats(ctx: RunQueryCtx) {
    return await ctx.runQuery(this.component.lib.getStats, {});
  }

  async listRecentParticipants(ctx: RunQueryCtx, args: { limit?: number } = {}) {
    return await ctx.runQuery(this.component.lib.listRecentParticipants, args);
  }

  async listRecentEgress(ctx: RunQueryCtx, args: { limit?: number } = {}) {
    return await ctx.runQuery(this.component.lib.listRecentEgress, args);
  }

  async listRecentWebhookEvents(ctx: RunQueryCtx, args: { limit?: number } = {}) {
    return await ctx.runQuery(this.component.lib.listRecentWebhookEvents, args);
  }
}

type RunQueryCtx = {
  runQuery: GenericActionCtx<GenericDataModel>["runQuery"];
};

// Action-side methods (createRoom, startRoomCompositeEgress, createIngress,
// etc.) only ever call ctx.runMutation — never runQuery, runAction, the
// scheduler, or storage. Typing them against this minimal structural type
// instead of the full GenericActionCtx<GenericDataModel> means they accept
// any real app's ActionCtx, whose DataModel is a concrete set of tables
// (not assignable to the generic GenericDataModel once an app defines any
// tables of its own).
type RunMutationCtx = {
  runMutation: GenericActionCtx<GenericDataModel>["runMutation"];
};
