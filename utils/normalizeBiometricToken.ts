const FIXED_WIDTH = 6;

const DIGITS_REGEX = /^\d+$/;

export const normalizeBiometricToken = (input: string | null | undefined): string => {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  let token = raw;
  if (DIGITS_REGEX.test(token)) {
    token = token.padStart(FIXED_WIDTH, "0");
  }

  return token.toUpperCase();
};

export const normalizeBiometricTokenOrNull = (
  input: string | null | undefined
): string | null => {
  const normalized = normalizeBiometricToken(input);
  return normalized ? normalized : null;
};

