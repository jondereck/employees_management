"use client";
import { useEffect, useState } from "react";
import { pusherClient } from "@/lib/pusher-client";

export default function Page() {
  const [logs, setLogs] = useState<string[]>([]);
  useEffect(() => {
    const ch = pusherClient.subscribe("dev-hrps");
    const handler = (p: any) => setLogs(s => [`ping: ${JSON.stringify(p)}`, ...s]);
    ch.bind("ping", handler);
    return () => { ch.unbind("ping", handler); pusherClient.unsubscribe("dev-hrps"); };
  }, []);
  return (
    <div className="p-6 space-y-4">
      <button onClick={() => fetch("/api/dev/pusher-test",{method:"POST"})}
              className="rounded border px-3 py-2">
        Trigger server event
      </button>
      <div className="space-y-2 text-sm">
        {logs.map((l,i)=><div key={i} className="border rounded p-2 font-mono">{l}</div>)}
      </div>
    </div>
  );
}
