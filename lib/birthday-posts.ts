import { getCurrentYearInTimeZone } from "@/lib/birthday";

export type BirthdayPostMode = "individual" | "monthly";
export type BirthdayPostStatus = "posted" | "postingUnavailable";
export type BirthdayHeadsFilter = "all" | "heads-only";

export type BirthdayPostPerson = {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  prefix?: string | null;
  middleName?: string | null;
  suffix?: string | null;
  officeName?: string | null;
  position?: string | null;
  birthday?: string | Date | null;
  isHead?: boolean;
};

export type GenerateBirthdayCaptionInput = {
  mode: BirthdayPostMode;
  month: number;
  year?: number;
  person?: BirthdayPostPerson | null;
  celebrants?: BirthdayPostPerson[];
  departmentName?: string | null;
  officeName?: string | null;
  headsFilter?: BirthdayHeadsFilter;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const HRMO_OFFICE_KEYS = [
  "human resource management office",
  "human resources management office",
  "hrmo",
  "human resource office",
];

const INDIVIDUAL_FALLBACK_OPENERS = [
  "Happy birthday to our valued celebrant",
  "Warm birthday greetings to",
  "Celebrating a special day for",
  "Sending cheerful birthday wishes to",
];

const MONTHLY_FALLBACK_OPENERS = [
  "Happy birthday to all our",
  "Warm birthday wishes to our",
  "Celebrating the wonderful",
  "Cheers to the",
];

const GENERAL_CLOSERS = [
  "Wishing you joy, good health, and continued success in the year ahead.",
  "May your day be filled with gratitude, happiness, and memorable moments.",
  "We hope your celebration brings you renewed energy, blessings, and success.",
];

const SUBTLE_EMOJI_SETS = [
  ["🎉", "🎂", "✨"],
  ["🎈", "🎉", "✨"],
  ["🌷", "🎉", "🎂"],
] as const;

function monthLabel(month: number) {
  return MONTH_NAMES[Math.min(11, Math.max(0, month))] ?? MONTH_NAMES[0];
}

function normalizeOfficeName(value?: string | null) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeRoleText(value?: string | null) {
  return ` ${(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
}

export function isHrmoOffice(value?: string | null) {
  const normalized = normalizeOfficeName(value);
  return HRMO_OFFICE_KEYS.some((key) => normalized.includes(key));
}

function pickVariant<T>(variants: readonly T[], seed: number) {
  return variants[Math.abs(seed) % variants.length]!;
}

function pickEmojiSet(seed: number) {
  return pickVariant(SUBTLE_EMOJI_SETS, seed);
}

function buildDisplayName(person: BirthdayPostPerson) {
  const prefix = person.prefix?.trim();
  const firstName = person.firstName.trim();
  const middleName = person.middleName?.trim();
  const lastName = person.lastName.trim();
  const suffix = person.suffix?.trim();

  const middleInitial = middleName
    ? middleName
        .split(/\s+/)
        .map((word) => word[0])
        .filter(Boolean)
        .join("")
    : "";

  return [prefix, [firstName, middleInitial ? `${middleInitial}.` : null, lastName].filter(Boolean).join(" "), suffix]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHashtags(month: number, hrmo: boolean) {
  const monthTag = monthLabel(month).replace(/\s+/g, "");
  const tags = hrmo
    ? ["#HappyBirthday", "#HRMOInsights", "#BirthdayCheers", `#${monthTag}Celebrants`]
    : ["#HappyBirthday", "#HRMOInsights", "#BirthdayCelebrators", `#${monthTag}Celebrants`];
  return tags.join(" ");
}

function buildMonthlyHashtags(month: number) {
  const monthTag = monthLabel(month).replace(/\s+/g, "");
  return ["#HRMOInsights", `#${monthTag}Celebrants`, "#HappyBirthday", "#BirthdayCheers"].join("\n");
}

function buildRoleInspiredLine(position: string | null | undefined, seed: number) {
  if (seed % 3 !== 0) return null;

  const text = normalizeRoleText(position);
  if (!text.trim()) return null;

  if (/( nurse | midwife | medical | health | sanitary | doctor | dentist | nutrition )/.test(text)) {
    return "Your care and compassion continue to make a meaningful difference in the lives of others.";
  }

  if (/( teacher | daycare | educator | instructor | child development )/.test(text)) {
    return "Your patience and guidance continue to inspire learning, growth, and brighter possibilities.";
  }

  if (/( engineer | architect | planning | technical | inspector | agriculturist | environment )/.test(text)) {
    return "Your skill and dedication help turn public service into steady progress for the community.";
  }

  if (/( clerk | encoder | admin | records | processor | secretary | bookkeeper )/.test(text)) {
    return "Your diligence and quiet dedication help keep meaningful public service moving each day.";
  }

  if (/( head | chief | mayor | administrator | supervisor | officer )/.test(text)) {
    return "Your leadership and commitment continue to encourage service, teamwork, and progress.";
  }

  return pickVariant(
    [
      "Your dedication to public service is sincerely appreciated.",
      "Your commitment and kindness continue to leave a positive mark.",
      "Your steady service is part of the work that keeps our community moving forward.",
    ],
    seed
  );
}

function normalizeCaptionSpacing(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ensureRequiredHashtags(value: string) {
  const required = ["#HappyBirthday", "#HRMOInsights"];
  const missing = required.filter((tag) => !new RegExp(`${tag}\\b`, "i").test(value));
  if (missing.length === 0) return value;
  return `${value.trim()}\n\n${missing.join(" ")}`;
}

function ensureMonthlyHashtags(value: string, month: number) {
  const required = ["#HRMOInsights", `#${monthLabel(month).replace(/\s+/g, "")}Celebrants`, "#HappyBirthday", "#BirthdayCheers"];
  const missing = required.filter((tag) => !new RegExp(`${tag}\\b`, "i").test(value));
  if (missing.length === 0) return value;
  return `${value.trim()}\n${missing.join("\n")}`;
}

function hasMonthlyMonthMismatch(value: string, month: number) {
  const expectedMonth = monthLabel(month);
  const expectedMonthTag = `#${expectedMonth.replace(/\s+/g, "")}Celebrants`;
  const hasExpectedMonth = new RegExp(`\\b${expectedMonth}\\b`, "i").test(value);
  const hasExpectedMonthTag = new RegExp(`${expectedMonthTag}\\b`, "i").test(value);
  const hasOtherMonth = MONTH_NAMES.some((monthName) => {
    if (monthName === expectedMonth) return false;
    return new RegExp(`\\b${monthName}\\b`, "i").test(value) || new RegExp(`#${monthName}Celebrants\\b`, "i").test(value);
  });

  return hasOtherMonth || (!hasExpectedMonth && !hasExpectedMonthTag);
}

export function buildBirthdayCaptionFallback(input: GenerateBirthdayCaptionInput) {
  const year = input.year ?? getCurrentYearInTimeZone();
  const officeName = input.officeName ?? input.person?.officeName ?? null;
  const hrmo = isHrmoOffice(officeName);
  const seedBase = year + input.month + (input.person?.id.length ?? input.celebrants?.length ?? 0);

  if (input.mode === "individual" && input.person) {
    const personName = buildDisplayName(input.person);
    const opener = pickVariant(INDIVIDUAL_FALLBACK_OPENERS, seedBase);
    const closer = pickVariant(GENERAL_CLOSERS, seedBase + 3);
    const [startEmoji, middleEmoji, endEmoji] = pickEmojiSet(seedBase + 5);
    const roleLine = buildRoleInspiredLine(input.person.position, seedBase);
    const body = [roleLine, closer].filter(Boolean).join(" ");

    return normalizeCaptionSpacing(`${startEmoji} ${opener}, ${personName}! ${middleEmoji} ${endEmoji}\n\n${body}\n\n${buildHashtags(input.month, hrmo)}`);
  }

  const celebrants = input.celebrants ?? [];
  const month = monthLabel(input.month);
  const monthUpper = month.toUpperCase();
  const opener = pickVariant(MONTHLY_FALLBACK_OPENERS, seedBase + celebrants.length);
  const [startEmoji, middleEmoji, endEmoji] = pickEmojiSet(seedBase + 11);
  const [extraEmoji, closingEmoji] = pickEmojiSet(seedBase + 17);
  const celebratorLabel =
    input.headsFilter === "heads-only"
      ? "special birthday celebrators"
      : `${month} celebrators`;

  return normalizeCaptionSpacing(
    `${startEmoji} ${monthUpper} BIRTHDAY CELEBRATORS ${middleEmoji}\n\n${opener} ${celebratorLabel}! ${endEmoji}\nMay this bright and meaningful month bring you joy, good health, and success in all that you do. ${extraEmoji}\n\nDon't forget to scan your IDs for your personalized greeting card! ${closingEmoji}\n\nWishing you a wonderful year ahead filled with happiness and meaningful moments. Enjoy your special day!\n\n${buildMonthlyHashtags(input.month)}`
  );
}

type BirthdayCaptionAiResponse = {
  caption: string;
};

export async function generateBirthdayCaption(input: GenerateBirthdayCaptionInput) {
  const fallback = buildBirthdayCaptionFallback(input);
  const apiKey = process.env.OPENAI_API_KEY;
  const enabled = process.env.BIRTHDAY_GREETING_AI_ENABLED !== "false";
  if (!enabled || !apiKey) {
    return fallback;
  }

  try {
    const model =
      process.env.BIRTHDAY_GREETING_AI_MODEL ||
      process.env.WORKFORCE_SUGGESTION_AI_MODEL ||
      "gpt-4.1-mini";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You write short Facebook-ready birthday greetings for the HRMO Facebook page of a government office. Return only JSON. Keep the caption warm, concise, varied, and free of markdown. Add at least 3 but no more than 5 subtle birthday-appropriate emoji total and do not overload the caption. Avoid repeating the same opener and closer. The request includes selectedMonthName; always use that exact month name for monthly captions. For individual mode, use exactly three short paragraphs separated by blank lines: headline, greeting body, hashtags. For monthly mode, use the monthly board format: uppercase '{MONTH} BIRTHDAY CELEBRATORS' headline, a short greeting paragraph for all monthly celebrators, a scan-ID reminder paragraph for personalized greeting cards, a warm closing paragraph, then a hashtag block with each hashtag on its own line. Do not list all monthly celebrant names by default. Position may be provided only as private context; only sometimes use it to inspire generic wording about service, care, leadership, diligence, or dedication, and never mention the actual position/title. Do not mention the celebrant's assigned office as the sender and never say phrases like 'Rural Health Unit family', 'office family', or '[office] family'. Always include #HappyBirthday and #HRMOInsights. For monthly mode, also include the selected month celebrants hashtag such as #MayCelebrants and #BirthdayCheers.",
          },
          {
            role: "user",
            content: JSON.stringify({
              ...input,
              monthIndexZeroBased: input.month,
              selectedMonthNumber: input.month + 1,
              selectedMonthName: monthLabel(input.month),
              fallback,
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "birthday_caption",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                caption: { type: "string" },
              },
              required: ["caption"],
            },
          },
        },
      }),
    });

    if (!response.ok) return fallback;

    const payload = await response.json();
    const text = payload?.output?.[0]?.content?.[0]?.text;
    if (typeof text !== "string") return fallback;

    const parsed = JSON.parse(text) as BirthdayCaptionAiResponse;
    const normalizedCaption = parsed.caption ? normalizeCaptionSpacing(parsed.caption) : "";
    if (!normalizedCaption) return fallback;
    if (input.mode === "monthly" && normalizedCaption && hasMonthlyMonthMismatch(normalizedCaption, input.month)) {
      return fallback;
    }
    const caption =
      input.mode === "monthly"
        ? ensureMonthlyHashtags(normalizedCaption, input.month)
        : ensureRequiredHashtags(normalizedCaption);
    return caption || fallback;
  } catch {
    return fallback;
  }
}
