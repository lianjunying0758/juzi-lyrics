// Pages Function: /ws —— 同域 WebSocket 中继入口，转发给 Room Durable Object
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const room = url.searchParams.get('room');
  if (!room || !/^[A-Za-z0-9_-]{1,32}$/.test(room)) {
    return new Response('Valid room required (use /ws?room=XXXX)', { status: 400 });
  }
  const id = context.env.ROOM.idFromName(room);
  const stub = context.env.ROOM.get(id);
  return stub.fetch(context.request);
}
