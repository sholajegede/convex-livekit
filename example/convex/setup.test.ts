import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../../src/component/schema.js";

const modules = import.meta.glob("./**/*.ts");
const componentModules = import.meta.glob("../../src/component/**/*.ts");

test("component schema loads", async () => {
  const t = convexTest(schema, { ...modules, ...componentModules });
  expect(t).toBeDefined();
});
