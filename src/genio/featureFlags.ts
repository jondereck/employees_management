type FlagScope = {
  departmentId: string;
  userId: string;
};

function parseCsv(value: string | undefined) {
  if (!value) return new Set<string>();
  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function isGenioV1Enabled(scope: FlagScope) {
  const globalFlag = process.env.GENIO_V1_ENABLED === "true";
  if (globalFlag) return true;

  const userAllowlist = parseCsv(process.env.GENIO_V1_USER_IDS);
  if (userAllowlist.has(scope.userId)) return true;

  const departmentAllowlist = parseCsv(process.env.GENIO_V1_DEPARTMENT_IDS);
  if (departmentAllowlist.has(scope.departmentId)) return true;

  return false;
}
