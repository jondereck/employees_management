export function normalizePhilippineMobileNumber(input: string) {
  const raw = input.trim();
  if (!raw) {
    return { ok: false as const, error: "Phone number is required." };
  }

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");

  let normalized = "";
  if (hasPlus && digits.startsWith("639") && digits.length === 12) {
    normalized = `+${digits}`;
  } else if (digits.startsWith("09") && digits.length === 11) {
    normalized = `+63${digits.slice(1)}`;
  } else if (digits.startsWith("9") && digits.length === 10) {
    normalized = `+63${digits}`;
  } else if (digits.startsWith("639") && digits.length === 12) {
    normalized = `+${digits}`;
  }

  if (!/^\+639\d{9}$/.test(normalized)) {
    return {
      ok: false as const,
      error: "Use a valid PH mobile number like 09171234567 or +639171234567.",
    };
  }

  return { ok: true as const, value: normalized };
}
