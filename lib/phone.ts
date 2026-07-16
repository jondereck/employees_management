/**
 * Strip spaces/special chars and coerce pasted PH mobiles into local 10-digit form
 * (after country code): 9950049187 — not 0995… or +63995…
 */
export function formatPhilippineMobileLocalInput(input: string) {
  let digits = input.replace(/\D/g, "");

  if (digits.startsWith("63") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }

  // Keep only a PH mobile subscriber number (starts with 9, max 10 digits).
  if (digits.length > 0 && !digits.startsWith("9")) {
    const nineIndex = digits.indexOf("9");
    digits = nineIndex >= 0 ? digits.slice(nineIndex) : "";
  }

  return digits.slice(0, 10);
}

export function isValidPhilippineMobileLocal(localDigits: string) {
  return /^9\d{9}$/.test(localDigits);
}

export function toE164FromPhilippineLocal(localDigits: string) {
  if (!isValidPhilippineMobileLocal(localDigits)) {
    return { ok: false as const, error: "Enter a valid PH mobile number (10 digits after +63)." };
  }
  return { ok: true as const, value: `+63${localDigits}` };
}

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
