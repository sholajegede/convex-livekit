import { test } from "vitest";
import {
  defineSchema,
  defineTable,
  type GenericActionCtx,
  type DataModelFromSchemaDefinition,
} from "convex/server";
import { v } from "convex/values";
import type { LiveKit } from "./index.js";

// Regression guard: every LiveKit action method used to be typed as
// `ctx: GenericActionCtx<GenericDataModel>`, which only type-checks for an
// app whose schema is empty. The moment a real app defines a table of its
// own (as any real consumer will), its generated ActionCtx stops being
// assignable to that generic type and every call site breaks. The fix
// types these methods against a minimal structural ctx instead (see
// RunMutationCtx in ./index.ts). This file proves the fix against a fake
// app schema with a real table — the example app's own schema is
// deliberately empty and would never have caught this.
//
// This file only needs to compile; nothing here runs at test time.
const _fakeAppSchema = defineSchema({
  widgets: defineTable({ name: v.string() }),
});
type FakeAppDataModel = DataModelFromSchemaDefinition<typeof _fakeAppSchema>;

function _typeCheckActionCtxCompat(ctx: GenericActionCtx<FakeAppDataModel>, livekit: LiveKit) {
  void livekit.createRoom(ctx, { name: "test" });
  void livekit.deleteRoom(ctx, { name: "test" });
  void livekit.updateRoomMetadata(ctx, { name: "test", metadata: "{}" });
  void livekit.removeParticipant(ctx, { roomName: "test", identity: "user_1" });
  void livekit.updateParticipant(ctx, { roomName: "test", identity: "user_1" });
  void livekit.mutePublishedTrack(ctx, { roomName: "test", identity: "user_1", trackSid: "TR_1", muted: true });
  void livekit.startRoomCompositeEgress(ctx, { roomName: "test" });
  void livekit.stopEgress(ctx, { egressId: "EG_1" });
  void livekit.createIngress(ctx, {
    inputType: "rtmp",
    name: "test",
    roomName: "test",
    participantIdentity: "user_1",
    participantName: "user_1",
  });
  void livekit.updateIngress(ctx, { ingressId: "IN_1" });
  void livekit.deleteIngress(ctx, { ingressId: "IN_1" });
}
void _typeCheckActionCtxCompat;

test("setup", () => {});
