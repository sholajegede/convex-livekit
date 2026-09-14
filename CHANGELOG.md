# Changelog

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
