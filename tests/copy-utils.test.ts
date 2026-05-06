import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPreview } from "@/utils/copy-utils";

describe("copy-utils", () => {
  it("keeps Roman numerals uppercase and tightens office abbreviations", () => {
    const preview = buildPreview(
      {
        fullName: "Juan Dela Cruz",
        position: "Position (Detailed Title III)",
        office: "Commission On Election (Comelec)",
      },
      {
        fields: ["fullName", "position", "office"],
        format: "capitalize",
      }
    );

    assert.equal(
      preview,
      "Juan Dela Cruz, Position(Detailed Title III), Commission on Election(COMELEC)"
    );
  });
});
