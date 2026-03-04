const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8130);
const TOKEN = process.env.GW_DEMO_TOKEN || 'gw-phase7-demo';

const clients = new Map();
const rooms = new Map();
const queue = [];
const sseClients = new Set();

const metrics = { opened: 0, closed: 0, rx: 0, tx: 0, queueJoins: 0, matches: 0, sseEvents: 0 };

const now = () => Date.now();
const id = () => crypto.randomUUID().slice(0, 8);

function emitOps(event, data = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify({ ts: now(), ...data })}\n\n`;
  for (const res of sseClients) res.write(payload);
  metrics.sseEvents += 1;
}

function createPlayer() {
  return { id: `p-${id()}`, name: `Player-${Math.floor(Math.random() * 1000)}`, authenticated: false, roomId: null, score: 0, x: 80, y: 80, lastActionAt: 0 };
}

function ensureRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);
  const room = { id: roomId, npc: { id: 'npc-arena', hp: 260, maxHp: 260, x: 420, y: 220 }, players: new Set(), createdAt: now() };
  rooms.set(roomId, room);
  return room;
}

function encodeFrame(text) {
  const payload = Buffer.from(text);
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  if (payload.length < 65536) return Buffer.concat([Buffer.from([0x81, 126, (payload.length >> 8) & 255, payload.length & 255]), payload]);
  throw new Error('too_large');
}

function decodeFrame(buf) {
  const second = buf[1];
  if ((second & 0x80) === 0) throw new Error('unmasked');
  let len = second & 0x7f;
  let offset = 2;
  if (len === 126) { len = (buf[2] << 8) | buf[3]; offset = 4; }
  const mask = buf.subarray(offset, offset + 4);
  offset += 4;
  const payload = buf.subarray(offset, offset + len);
  const out = Buffer.alloc(len);
  for (let i = 0; i < len; i += 1) out[i] = payload[i] ^ mask[i % 4];
  return out.toString('utf8');
}

function send(socket, payload) {
  metrics.tx += 1;
  socket.write(encodeFrame(JSON.stringify(payload)));
}

function roomSnapshot(room) {
  return {
    roomId: room.id,
    ts: now(),
    npc: room.npc,
    players: Array.from(room.players).map((cid) => clients.get(cid)).filter(Boolean).map((c) => ({ id: c.player.id, name: c.player.name, x: c.player.x, y: c.player.y, score: c.player.score })),
  };
}

function broadcastRoom(roomId, payload) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const cid of room.players) {
    const c = clients.get(cid);
    if (c) send(c.socket, payload);
  }
}

function dequeueAndMatch() {
  while (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();
    const roomId = `arena-${id()}`;
    const room = ensureRoom(roomId);
    room.players.add(a);
    room.players.add(b);
    clients.get(a).player.roomId = roomId;
    clients.get(b).player.roomId = roomId;
    metrics.matches += 1;
    emitOps('match_created', { roomId, players: [clients.get(a).player.id, clients.get(b).player.id] });
    broadcastRoom(roomId, { type: 'match_found', room: roomSnapshot(room) });
  }
}

function applyAction(client, payload) {
  const p = client.player;

  if (payload.type === 'auth') {
    if (payload.token !== TOKEN) return { type: 'auth', ok: false };
    p.authenticated = true;
    emitOps('auth_ok', { playerId: p.id });
    return { type: 'auth', ok: true, playerId: p.id };
  }

  if (!p.authenticated) return { type: 'error', error: 'unauthenticated' };

  if (payload.type === 'queue_join') {
    if (!queue.includes(client.id)) {
      queue.push(client.id);
      metrics.queueJoins += 1;
      emitOps('queue_join', { playerId: p.id, queueSize: queue.length });
      dequeueAndMatch();
    }
    return { type: 'queue_join', ok: true, queueSize: queue.length, roomId: p.roomId };
  }

  if (!p.roomId || !rooms.has(p.roomId)) return { type: 'error', error: 'room_required' };
  const room = rooms.get(p.roomId);

  const elapsed = now() - p.lastActionAt;
  if (elapsed < 80) return { type: 'error', error: 'rate_limited' };
  p.lastActionAt = now();

  if (payload.type === 'move') {
    p.x = Math.max(0, Math.min(640, p.x + (payload.dx ?? 0)));
    p.y = Math.max(0, Math.min(360, p.y + (payload.dy ?? 0)));
    return { type: 'ack', action: 'move', x: p.x, y: p.y };
  }

  if (payload.type === 'attack') {
    room.npc.hp = Math.max(0, room.npc.hp - 18);
    p.score += 18;
    if (room.npc.hp === 0) {
      room.npc.hp = room.npc.maxHp;
      p.score += 70;
      emitOps('npc_respawn', { roomId: room.id, by: p.id });
    }
    return { type: 'combat', npcHp: room.npc.hp, score: p.score };
  }

  return { type: 'error', error: 'unsupported_action' };
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', clients: clients.size, rooms: rooms.size, queue: queue.length }));
    return;
  }

  if (req.url === '/rooms') {
    const list = Array.from(rooms.values()).map((r) => ({ id: r.id, players: r.players.size, npcHp: r.npc.hp }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ts: now(), rooms: list }));
    return;
  }

  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ts: now(), metrics, queueSize: queue.length, rooms: rooms.size }));
    return;
  }

  if (req.url === '/ops/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('\n');
    sseClients.add(res);
    emitOps('sse_connected', { listeners: sseClients.size });
    req.on('close', () => {
      sseClients.delete(res);
      emitOps('sse_disconnected', { listeners: sseClients.size });
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.on('upgrade', (req, socket) => {
  if (req.url !== '/ws') return socket.destroy();
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();

  const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '\r\n'].join('\r\n'));

  const clientId = id();
  clients.set(clientId, { id: clientId, socket, player: createPlayer() });
  metrics.opened += 1;
  emitOps('ws_connected', { clientId });

  send(socket, { type: 'welcome', player: clients.get(clientId).player, authRequired: true });

  socket.on('data', (chunk) => {
    metrics.rx += 1;
    try {
      const payload = JSON.parse(decodeFrame(chunk));
      const client = clients.get(clientId);
      if (!client) return;
      const response = applyAction(client, payload);
      send(socket, response);
      if (client.player.roomId && rooms.has(client.player.roomId)) {
        broadcastRoom(client.player.roomId, { type: 'state_update', room: roomSnapshot(rooms.get(client.player.roomId)) });
      }
    } catch {
      send(socket, { type: 'error', error: 'invalid_message' });
    }
  });

  const close = () => {
    const client = clients.get(clientId);
    if (!client) return;
    const idx = queue.indexOf(clientId);
    if (idx >= 0) queue.splice(idx, 1);

    const roomId = client.player.roomId;
    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId).players.delete(clientId);
      broadcastRoom(roomId, { type: 'state_update', room: roomSnapshot(rooms.get(roomId)) });
    }

    clients.delete(clientId);
    metrics.closed += 1;
    emitOps('ws_closed', { clientId });
  };

  socket.on('close', close);
  socket.on('error', close);
});

setInterval(() => {
  for (const room of rooms.values()) {
    broadcastRoom(room.id, { type: 'state_update', room: roomSnapshot(room) });
  }
}, 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ event: 'phase7_gateway_started', port: PORT, tokenHint: TOKEN }));
});
