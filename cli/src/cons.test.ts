import { assertEquals } from "jsr:@std/assert";
import { build, field, string } from "./spec.ts";

Deno.test("build", () => {
  const b = build("test").description("test").inputs({ name: field({ d: "name", kind: string }) }).outputs({ name: field({ d: "name", kind: string }) }).spec();
  assertEquals(b.name, "test");
  assertEquals(b.description, "test");
  assertEquals(b.inputs.name, { d: "name", kind: { type: "string" } });
  assertEquals(b.outputs.name, { d: "name", kind: { type: "string" } });
});
