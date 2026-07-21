import type { Prisma } from "@prisma/client";

export function normalizeEmployeeMutationIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const valueId of value) {
    if (typeof valueId !== "string") return null;
    const id = valueId.trim();
    if (!id) return null;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return ids.length > 0 ? ids : null;
}

type EmployeeMutation<TResult> = (
  tx: Prisma.TransactionClient
) => Promise<TResult>;

export async function runEmployeeMutationTransaction<TResult>(input: {
  mutation: EmployeeMutation<TResult>;
  transaction: (mutation: EmployeeMutation<TResult>) => Promise<TResult>;
  publish: (result: TResult) => Promise<void>;
}) {
  const result = await input.transaction(input.mutation);
  await input.publish(result);
  return result;
}
