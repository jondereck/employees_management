import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBirthdayCaptionFallback,
  generateBirthdayCaption,
  isHrmoOffice,
} from "../lib/birthday-posts";

function subtleEmojiCount(value: string) {
  return Array.from(value.matchAll(/[🎉🎂🎈✨🌷]/gu)).length;
}

test("detects HRMO office variants", () => {
  assert.equal(isHrmoOffice("Human Resource Management Office"), true);
  assert.equal(isHrmoOffice("HRMO - LGU Lingayen"), true);
  assert.equal(isHrmoOffice("Accounting Office"), false);
});

test("builds individual fallback caption with office-aware tone", () => {
  const caption = buildBirthdayCaptionFallback({
    mode: "individual",
    month: 4,
    year: 2026,
    person: {
      id: "emp-1",
      firstName: "Lorna",
      lastName: "Idos",
      officeName: "Human Resource Management Office",
    },
  });

  assert.match(caption, /Lorna Idos/i);
  assert.match(caption, /HRMO/i);
  assert.match(caption, /#HappyBirthday/i);
  assert.match(caption, /#HRMOInsights/i);
  assert.match(caption, /#MayCelebrants/i);
  assert.match(caption, /\n\n/);
  assert.ok(subtleEmojiCount(caption) >= 3);
});

test("individual fallback does not use assigned office as sender", () => {
  const caption = buildBirthdayCaptionFallback({
    mode: "individual",
    month: 4,
    year: 2026,
    person: {
      id: "emp-rhu",
      firstName: "Shayne",
      lastName: "Borling",
      officeName: "Rural Health Unit III",
    },
  });

  assert.doesNotMatch(caption, /Rural Health Unit/i);
  assert.doesNotMatch(caption, /office family/i);
  assert.match(caption, /#HappyBirthday/i);
  assert.match(caption, /#HRMOInsights/i);
});

test("individual fallback can use position context without naming the position", () => {
  const caption = buildBirthdayCaptionFallback({
    mode: "individual",
    month: 4,
    year: 2026,
    person: {
      id: "emp-rhu",
      firstName: "Shayne",
      lastName: "Borling",
      officeName: "Rural Health Unit III",
      position: "Nurse III",
    },
  });

  assert.match(caption, /care|compassion|meaningful difference/i);
  assert.doesNotMatch(caption, /Nurse III/i);
  assert.doesNotMatch(caption, /Rural Health Unit/i);
});

test("builds monthly fallback caption with monthly posting format", () => {
  const caption = buildBirthdayCaptionFallback({
    mode: "monthly",
    month: 4,
    year: 2026,
    celebrants: [
      { id: "1", firstName: "Ajam", lastName: "One" },
      { id: "2", firstName: "Eric", lastName: "Two" },
      { id: "3", firstName: "Maricar", lastName: "Three" },
      { id: "4", firstName: "Rolly", lastName: "Four" },
    ],
  });

  assert.match(caption, /MAY BIRTHDAY CELEBRATORS/i);
  assert.match(caption, /Happy birthday|Warm birthday|Celebrating|Cheers/i);
  assert.match(caption, /scan your IDs/i);
  assert.match(caption, /^#HRMOInsights$/im);
  assert.match(caption, /^#MayCelebrants$/im);
  assert.match(caption, /^#HappyBirthday$/im);
  assert.match(caption, /^#BirthdayCheers$/im);
  assert.match(caption, /\n\n/);
  assert.ok(subtleEmojiCount(caption) >= 3);
});

test("heads-only monthly fallback uses special celebrator wording", () => {
  const caption = buildBirthdayCaptionFallback({
    mode: "monthly",
    month: 4,
    year: 2026,
    headsFilter: "heads-only",
    celebrants: [
      { id: "1", firstName: "Lorna", lastName: "Idos", officeName: "Human Resource Management Office" },
    ],
  });

  assert.match(caption, /special birthday celebrators/i);
  assert.doesNotMatch(caption, /office-head birthday celebrators/i);
});

test("monthly AI caption falls back when it uses the wrong selected month", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalEnabled = process.env.BIRTHDAY_GREETING_AI_ENABLED;

  process.env.OPENAI_API_KEY = "test-key";
  process.env.BIRTHDAY_GREETING_AI_ENABLED = "true";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        output: [
          {
            content: [
              {
                text: JSON.stringify({
                  caption:
                    "APRIL BIRTHDAY CELEBRATORS 🎂\n\nHappy birthday to all our April celebrators! 🎉✨\n\n#HappyBirthday\n#HRMOInsights\n#AprilCelebrants\n#BirthdayCheers",
                }),
              },
            ],
          },
        ],
      }),
      { status: 200 }
    );

  try {
    const caption = await generateBirthdayCaption({
      mode: "monthly",
      month: 4,
      year: 2026,
      celebrants: [{ id: "1", firstName: "Ajam", lastName: "One" }],
    });

    assert.match(caption, /MAY BIRTHDAY CELEBRATORS/i);
    assert.doesNotMatch(caption, /APRIL BIRTHDAY CELEBRATORS/i);
    assert.match(caption, /^#MayCelebrants$/im);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalEnabled === undefined) delete process.env.BIRTHDAY_GREETING_AI_ENABLED;
    else process.env.BIRTHDAY_GREETING_AI_ENABLED = originalEnabled;
  }
});
