import assert from "node:assert/strict";
import test from "node:test";
import { projectOem } from "./catalog-projection.mjs";

const entry = (status) => ({
  oem: {
    identity: status === undefined ? undefined : { status },
    part_numbers: [
      { number: null, role: "alternate" },
      { number: "74348-12010-14", role: "original" },
    ],
  },
  color_finish: { oem_colors: [{ code: "14", name: "Blue" }] },
  supersession: {
    chain: [
      { part_number: "74348-12010-14", type: null },
      { part_number: "74348-30010-01", type: "color_consolidated" },
    ],
  },
});

test("confirmed identity projects audited OEM claims", () => {
  assert.deepEqual(projectOem(entry("confirmed")), {
    oemIdentityStatus: "confirmed",
    oemNumber: "74348-12010-14",
    colors: ["Blue"],
    supersededTo: "74348-30010-01",
  });
});

for (const status of ["candidate", "disputed", "unknown"]) {
  test(`${status} identity quarantines number, color, and supersession`, () => {
    assert.deepEqual(projectOem(entry(status)), {
      oemIdentityStatus: status,
      oemNumber: null,
      colors: [],
      supersededTo: null,
    });
  });
}

test("missing or invalid identity fails closed", () => {
  for (const status of [undefined, "probably"]) {
    assert.deepEqual(projectOem(entry(status)), {
      oemIdentityStatus: "unknown",
      oemNumber: null,
      colors: [],
      supersededTo: null,
    });
  }
});
