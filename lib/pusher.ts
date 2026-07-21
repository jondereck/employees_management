// DO NOT import this from any "use client" file.
import Pusher from "pusher";

let client: Pusher | undefined;

function getPusherServer() {
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } =
    process.env;
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
    return null;
  }

  client ??= new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true,
  });
  return client;
}

export const pusherServer = {
  trigger(channel: string | string[], event: string, data: unknown) {
    const configuredClient = getPusherServer();
    return configuredClient
      ? configuredClient.trigger(channel, event, data)
      : Promise.resolve();
  },
};
