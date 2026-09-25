// 桔子好声音遥控器 - WebSocket中转
// 路径: /api/ws

const rooms = new Map();

export async function onRequestGet(context) {
  const upgradeHeader = context.request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  const url = new URL(context.request.url);
  const roomId = url.searchParams.get('room');
  const role = url.searchParams.get('role'); // host / remote

  if (!roomId) {
    server.close(1008, 'No room');
    return new Response('No room', { status: 400 });
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, { host: null, remotes: new Set() });
  }
  const room = rooms.get(roomId);

  if (role === 'host') {
    if (room.host) {
      try { room.host.close(1008, 'Host replaced'); } catch(e) {}
    }
    room.host = server;
  } else {
    room.remotes.add(server);
  }

  server.addEventListener('message', (event) => {
    const data = event.data;
    if (role === 'host') {
      room.remotes.forEach(remote => {
        try { remote.send(data); } catch(e) {}
      });
    } else {
      if (room.host) {
        try { room.host.send(data); } catch(e) {}
      }
    }
  });

  server.addEventListener('close', () => {
    if (role === 'host') {
      room.host = null;
    } else {
      room.remotes.delete(server);
    }
    if (!room.host && room.remotes.size === 0) {
      rooms.delete(roomId);
    }
  });

  return new Response(null, { status: 101, webSocket: client });
}
