// 桔子好声音 WebSocket 中继（Room Durable Object）
// 同房间的所有连接互相转发消息，替代 EMQX MQTT broker
export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      server.accept();
      this.sessions.add(server);
      server.addEventListener('message', (event) => {
        const data = event.data;
        for (const s of this.sessions) {
          if (s === server) continue;
          try {
            s.send(data);
          } catch (e) {
            this.sessions.delete(s);
          }
        }
      });
      const cleanup = () => {
        this.sessions.delete(server);
        try { server.close(); } catch (e) {}
      };
      server.addEventListener('close', cleanup);
      server.addEventListener('error', cleanup);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/') {
      return new Response('JUZI RELAY — room connections: ' + this.sessions.size);
    }
    return new Response('Not Found', { status: 404 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const room = url.searchParams.get('room');
      if (!room || !/^[A-Za-z0-9_-]{1,32}$/.test(room)) {
        return new Response('Valid room required (use /ws?room=XXXX)', { status: 400 });
      }
      const id = env.ROOM.idFromName(room);
      return env.ROOM.get(id).fetch(request);
    }
    if (url.pathname === '/') {
      return new Response('JUZI RELAY — connect to /ws?room=XXXX');
    }
    return new Response('Not Found', { status: 404 });
  }
};
