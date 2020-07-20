import { serve } from "https://deno.land/std/http/server.ts";
import {
  acceptWebSocket,
  isWebSocketCloseEvent,
  isWebSocketPingEvent,
  WebSocket,
  acceptable,
} from "https://deno.land/std/ws/mod.ts";
import { handleMessageWS } from "./controllers/messageHandler.ts";
import requestParser from "./utils/requestParser.ts";

async function handleWs(sock: WebSocket) {
  console.log("socket connected!");
  try {
    for await (const ev of sock) {
      if (typeof ev === "string") {
        handleMessageWS(ev as string);
      } else if (ev instanceof Uint8Array) {
        // binary message
        console.log("ws:Binary", ev);
      } else if (isWebSocketPingEvent(ev)) {
        const [, body] = ev;
        // ping
        console.log("ws:Ping", body);
      } else if (isWebSocketCloseEvent(ev)) {
        // close
        const { code, reason } = ev;
        console.log("ws:Close", code, reason);
      }
    }
  } catch (err) {
    console.error(`failed to receive frame: ${err}`);

    if (!sock.isClosed) {
      await sock.close(1000).catch(console.error);
    }
  }
}

if (import.meta.main) {
  /** websocket echo server */
  const port = Deno.args[0] || "8080";
  console.log(`websocket server is running on :${port}`);

  for await (const req of serve(`:${port}`)) {
    const { conn, r: bufReader, w: bufWriter, headers } = req;

    if (acceptable(req)) {
      acceptWebSocket({
        conn,
        bufReader,
        bufWriter,
        headers,
      })
        .then(handleWs)
        .catch(async (err) => {
          console.error(`failed to accept websocket: ${err}`);
          await req.respond({ status: 400 });
        });
    } else {
      // API server
      requestParser(req);
    }
  }
}
