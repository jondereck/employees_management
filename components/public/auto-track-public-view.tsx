"use client";

import { useEffect } from "react";

function getOrCreateAnonId() {
  const k = "hrps.anonymousId";
  let v = localStorage.getItem(k);
  if (!v && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    v = crypto.randomUUID();
    localStorage.setItem(k, v);
  }
  return v || "anon";
}

/**
 * Fires once per tab per employee every 12h (sessionStorage keyed throttle).
 * Sends viewerId/employeeNo if the user had identified before (saved in localStorage).
 */
export default function AutoTrackPublicView(props: {
  viewedEmployeeId: string;    // params.employeeId
  departmentId: string;        // params.departmentId
}) {
  const { viewedEmployeeId, departmentId } = props;

  useEffect(() => {
    if (!viewedEmployeeId || !departmentId) return;

    const key = `pv:${viewedEmployeeId}`;
    const last = Number(sessionStorage.getItem(key) || "0");
    const now = Date.now();
    if (now - last < 12 * 60 * 60 * 1000) return; // throttle: 12h

    const viewerId = localStorage.getItem("hrps.viewerId") || null;               // previously saved UUID
    const viewerEmployeeNo = localStorage.getItem("hrps.viewerEmployeeNo") || null; // previously saved EmpNo
    const anonId = getOrCreateAnonId();

    (async () => {
      try {
        await fetch("/api/track/public-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            viewedEmployeeId,
            departmentId,
            viewerId,           // optional
            viewerEmployeeNo,   // optional
            anonId,             // used as distinctId if no viewer
          }),
          keepalive: true,
        });
        sessionStorage.setItem(key, String(now));
      } catch {
        /* silent */
      }
    })();
  }, [viewedEmployeeId, departmentId]);

  return null;
}
