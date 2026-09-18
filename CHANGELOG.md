# Changelog

## 0.0.9

### Patch Changes

- Fix the Convex directory badge image URL, which still pointed at `badge/sholajegede/convex-livekit` after the link URL was corrected in a previous release; both now use the plain `badge/convex-livekit` path.

## 0.0.8

### Patch Changes

- Drop the username scope from the Convex directory badge link in README, matching the directory's updated URL format

## 0.0.7

### Patch Changes

- Correct the 0.0.6 changelog and code comments, which claimed LiveKit's webhook
  payloads use snake_case field names (`event.egress_info`,
  `event.ingress_info`) the same way Twirp API responses do. Verified against
  real received webhook events: they're plain camelCase (`event.egressInfo`,
  `event.ingressInfo`, `room.numParticipants`), so the
  `egress_started`/`egress_ended`/`ingress_started`/`ingress_ended` webhook
  branches were never actually broken. The normalization still runs on webhook
  payloads — harmless, since it's a no-op on data that's already camelCase — but
  only Twirp API responses genuinely needed it. No runtime behavior changes.

## 0.0.6

### Patch Changes

- Fix every Twirp API response and webhook payload being read as if LiveKit's
  server returned camelCase JSON (`egressId`, `roomName`, `numParticipants`). It
  actually returns the original protobuf field names — snake_case (`egress_id`,
  `room_name`, `num_participants`) — confirmed against a live
  `StartRoomCompositeEgress` response. This broke two ways: a required field
  like `EgressInfo.egress_id` came back `undefined` and
  `startRoomCompositeEgress`/`createIngress`/`stopEgress`/`updateIngress` threw
  `ArgumentValidationError` on every call, while an optional field like
  `Room.num_participants` or `Room.max_participants` was silently dropped
  instead of erroring. The
  `egress_started`/`egress_ended`/`ingress_started`/`ingress_ended` webhook
  branches were affected worst of all: LiveKit sends
  `event.egress_info`/`event.ingress_info`, not
  `event.egressInfo`/`event.ingressInfo`, so those branches'
  `&& egressInfo`/`&& ingressInfo` guards were always false and silently never
  ran. Every Twirp response and webhook payload is now normalized from
  snake_case to camelCase (shallow — one level of keys at a time, so it never
  touches the caller-defined keys inside a map like
  `ParticipantInfo.attributes`) before any field on it is read.

## 0.0.5

### Patch Changes

- Fix every action method on `LiveKit` (`createRoom`,
  `startRoomCompositeEgress`, `createIngress`, and the rest) being typed as
  `ctx: GenericActionCtx<GenericDataModel>`, which only type-checks when the
  calling app's schema is empty. Any real app with its own tables — which is
  every real app — got a compile error on every one of these calls. They now
  accept a minimal structural ctx type instead, matching the pattern query
  methods already used.

## 0.0.4

### Patch Changes

- Add egress control: `startRoomCompositeEgress` and `stopEgress`, wrapping
  LiveKit's `StartRoomCompositeEgress`/`StopEgress` RPCs and patching the
  `egress` row immediately.
- Add ingress support: a new `ingress` table plus `createIngress`,
  `updateIngress`, `deleteIngress`, `getIngress`, and `listIngressByRoom`, with
  `ingress_started`/`ingress_ended` webhooks keeping live endpoint state in
  sync.
- Add retry with exponential backoff and jitter to every outbound LiveKit server
  API call, on `429`/`5xx` responses and network failures, honoring
  `Retry-After` when present.
- Fix `mutePublishedTrack`'s request body to use `trackSid` instead of
  `track_sid`, matching the camelCase convention every other request body
  already used.

## 0.0.3

### Patch Changes

- Handle `participant_connection_aborted` webhook events the same as
  `participant_left`, so an aborted connection no longer leaves a participant
  stuck at state "joined".
- Add track state: a `tracks` table plus `getTrack`, `listTracksByRoom`, and
  `listTracksByParticipant` queries, kept in sync from `track_published` and
  `track_unpublished` webhook events.
- Add participant `attributes` (for LiveKit Agents state such as
  `lk.agent.state`), and `updateParticipant` / `mutePublishedTrack` methods to
  change them and a track's mute state directly.
- Add HTTP-level test coverage for the webhook handler itself (signature
  verification, idempotency, participant and track lifecycle), not just its
  underlying mutations.

## 0.0.2

### Patch Changes

- Add demo screenshot to README

## 0.0.1

- Keep a room's participant count current instead of frozen at room_started,
  using the live count LiveKit reports on every room event.
- Add dashboard queries: getStats, listRecentParticipants, listRecentEgress, and
  listRecentWebhookEvents.
- Rebuild the example app with a console UI, a Rooms panel with participant
  management, a live WebRTC join flow via @livekit/components-react, a Webhooks
  feed, and cross-room History.

## 0.0.0

- Initial release.
