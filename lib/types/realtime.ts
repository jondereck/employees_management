// types/realtime.ts
export type ApprovalEvent = {
  type:
    | "created"
    | "updated"
    | "request_deleted"
    | "request_created"
    | "request_updated"
    | "approved"
    | "rejected";
  entity: "timeline" | "award";
  approvalId: string;
  departmentId: string;
  employeeId: string;
  targetId?: string;
  title?: string | null;
  occurredAt?: string | null; // timeline
  givenAt?: string | null;    // award
  actorId: string;
  when: string;               // ISO
  status?: "APPROVED" | "REJECTED";
};


export type ApprovalResolvedEvent = {
  approvalId: string;
  departmentId: string;
  status: "APPROVED" | "REJECTED";
};
