// Safe for the browser
import Pusher from "pusher-js";

type EventHandler = (...args: any[]) => void;

const noOpChannel = {
  bind(_eventName: string, _handler: EventHandler) {
    return noOpChannel;
  },
  unbind(_eventName?: string, _handler?: EventHandler) {
    return noOpChannel;
  },
};

let client: Pusher | undefined;

function getPusherClient() {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return null;

  client ??= new Pusher(key, { cluster, forceTLS: true });
  return client;
}

export const pusherClient = {
  subscribe(channelName: string) {
    return getPusherClient()?.subscribe(channelName) ?? noOpChannel;
  },
  channel(channelName: string) {
    return getPusherClient()?.channel(channelName) ?? null;
  },
  unsubscribe(channelName: string) {
    getPusherClient()?.unsubscribe(channelName);
  },
};
