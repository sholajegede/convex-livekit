import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "../../src/component/schema.js";

const modules = import.meta.glob("./**/*.ts");
const componentModules = import.meta.glob("../../src/component/**/*.ts");

function initConvexTest() {
  const t = convexTest(schema, modules);
  t.registerComponent("convexLivekit", schema, componentModules);
  return t;
}

test("getRoom returns null for unknown room", async () => {
  const t = initConvexTest();
  const result = await t.query(api.example.getRoom, { name: "unknown-room" });
  expect(result).toBe(null);
});

test("listRooms returns empty array with no rooms recorded", async () => {
  const t = initConvexTest();
  const result = await t.query(api.example.listRooms, {});
  expect(result).toEqual([]);
});
