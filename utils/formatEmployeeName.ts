type NameParts = {
  lastName: string | null | undefined;
  firstName: string | null | undefined;
  middleName?: string | null | undefined;
  suffix?: string | null | undefined;
};

export const formatEmployeeName = (parts: NameParts): string => {
  const last = parts.lastName?.trim();
  const first = parts.firstName?.trim();
  const middle = parts.middleName?.trim();
  const suffix = parts.suffix?.trim();

  const middleInitial = middle
    ? middle
        .split(/\s+/)
        .filter(Boolean)
        .map((segment) => `${segment.charAt(0).toUpperCase()}.`)
        .join(" ")
    : "";

  const pieces = [last, ", ", first];
  if (middleInitial) pieces.push(" ", middleInitial);
  if (suffix) pieces.push(" ", suffix);

  return pieces.filter(Boolean).join("") || first || last || "Unnamed";
};

