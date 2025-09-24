// lib/uiToDbEventType.ts
import type { EmploymentEventType } from "@prisma/client";

const UI_TO_DB: Record<string, EmploymentEventType> = {
  // 1:1
  HIRED: "HIRED",
  PROMOTION: "PROMOTED",
  TRANSFER: "TRANSFERRED",
  REASSIGNED: "REASSIGNED",
  AWARD: "AWARDED",
  SEPARATION: "TERMINATED",
  CONTRACT_RENEWAL: "CONTRACT_RENEWAL",
  OTHER: "OTHER",

  // UI-only label that doesn't exist in DB
  TRAINING: "OTHER",
};

export function uiToDbEventType(ui: unknown): EmploymentEventType {
  if (!ui) return "OTHER";
  const key = String(ui).toUpperCase().trim();
  return UI_TO_DB[key] ?? "OTHER";
}
