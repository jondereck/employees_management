// types/realtime.ts
export type ApprovalEvent = {
  type:
    | "request_created"
    | "request_updated"
    | "request_deleted"
    | "approved"
    | "rejected"
    | "created"
    | "updated"
    | "deleted";
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
};


export type ApprovalResolvedEvent = {
  approvalId: string;
  departmentId: string;
  status: "APPROVED" | "REJECTED";
};
