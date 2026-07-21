import assert from "node:assert/strict";
import test from "node:test";

test("server Pusher is a no-op when credentials are absent", async () => {
  const names = [
    "PUSHER_APP_ID",
    "PUSHER_KEY",
    "PUSHER_SECRET",
    "PUSHER_CLUSTER",
  ] as const;
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];

  try {
    const { pusherServer } = await import("../lib/pusher");
    await assert.doesNotReject(() =>
      pusherServer.trigger("test-channel", "test:event", { ok: true })
    );
  } finally {
    for (const name of names) {
      const value = saved[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("browser Pusher exposes a no-op client when configuration is absent", async () => {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  delete process.env.NEXT_PUBLIC_PUSHER_KEY;
  delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  try {
    const { pusherClient } = await import("../lib/pusher-client");
    const channel = pusherClient.subscribe("test-channel");
    assert.doesNotThrow(() => channel.bind("test:event", () => {}));
    assert.doesNotThrow(() => channel.unbind("test:event"));
    assert.doesNotThrow(() => pusherClient.unsubscribe("test-channel"));
  } finally {
    if (key === undefined) delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    else process.env.NEXT_PUBLIC_PUSHER_KEY = key;
    if (cluster === undefined) delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    else process.env.NEXT_PUBLIC_PUSHER_CLUSTER = cluster;
  }
});
