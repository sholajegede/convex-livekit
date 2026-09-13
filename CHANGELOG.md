# Changelog

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
