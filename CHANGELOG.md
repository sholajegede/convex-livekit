# Changelog

## 0.0.5

### Patch Changes

- Fix every action method on `LiveKit` (`createRoom`, `startRoomCompositeEgress`, `createIngress`, and the rest) being typed as `ctx: GenericActionCtx<GenericDataModel>`, which only type-checks when the calling app's schema is empty. Any real app with its own tables — which is every real app — got a compile error on every one of these calls. They now accept a minimal structural ctx type instead, matching the pattern query methods already used.

## 0.0.4

### Patch Changes

- Add egress control: `startRoomCompositeEgress` and `stopEgress`, wrapping LiveKit's `StartRoomCompositeEgress`/`StopEgress` RPCs and patching the `egress` row immediately.
- Add ingress support: a new `ingress` table plus `createIngress`, `updateIngress`, `deleteIngress`, `getIngress`, and `listIngressByRoom`, with `ingress_started`/`ingress_ended` webhooks keeping live endpoint state in sync.
- Add retry with exponential backoff and jitter to every outbound LiveKit server API call, on `429`/`5xx` responses and network failures, honoring `Retry-After` when present.
- Fix `mutePublishedTrack`'s request body to use `trackSid` instead of `track_sid`, matching the camelCase convention every other request body already used.

## 0.0.3

### Patch Changes

- Handle `participant_connection_aborted` webhook events the same as `participant_left`, so an aborted connection no longer leaves a participant stuck at state "joined".
- Add track state: a `tracks` table plus `getTrack`, `listTracksByRoom`, and `listTracksByParticipant` queries, kept in sync from `track_published` and `track_unpublished` webhook events.
- Add participant `attributes` (for LiveKit Agents state such as `lk.agent.state`), and `updateParticipant` / `mutePublishedTrack` methods to change them and a track's mute state directly.
- Add HTTP-level test coverage for the webhook handler itself (signature verification, idempotency, participant and track lifecycle), not just its underlying mutations.

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
