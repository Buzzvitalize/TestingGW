const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8100);
const AUTH_TOKEN = process.env.GW_DEMO_TOKEN || 'gw-phase4-demo';
const TICK_MS = 1000;

const clients = new Map();
const metrics = {
  connectionsOpened: 0,
  connectionsClosed: 0,
  messagesRx: 0,
  messagesTx: 0,
  actions: { move: 0, attack: 0, use_skill: 0, use_item: 0, unsupported: 0 },
  errors: { invalidJson: 0, unauthenticated: 0, invalidMessage: 0, rateLimited: 0 },
};

const world = {
  npc: { id: 'npc-warden-1', name: 'Ruins Warden', hp: 220, maxHp: 220, x: 420, y: 220 },
};

const now = () => Date.now();
const randomId = () => crypto.randomUUID().slice(0, 8);

function log(event, data = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}

function createPlayerState() {
  return {
    id: `p-${randomId()}`,
    name: `Player-${Math.floor(Math.random() * 999)}`,
    hp: 100,
    maxHp: 100,
    mana: 60,
    maxMana: 60,
    x: 80,
    y: 80,
    inventory: [
      { id: 'potion-small', qty: 3, heal: 25 },
      { id: 'ether-small', qty: 2, mana: 20 },
    ],
    skills: [
      { id: 'slash', manaCost: 0, damage: 12 },
      { id: 'fireball', manaCost: 18, damage: 28 },
    ],
    lastActionAt: 0,
    authenticated: false,
  };
}

function encodeFrame(payloadText) {
  const payload = Buffer.from(payloadText);
  const length = payload.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload]);
  }

  if (length < 65536) {
    const header = Buffer.from([0x81, 126, (length >> 8) & 255, length & 255]);
    return Buffer.concat([header, payload]);
  }

  throw new Error('payload_too_large');
}

function decodeFrame(buffer) {
  const secondByte = buffer[1];
  const masked = (secondByte & 0x80) !== 0;
  const lengthMarker = secondByte & 0x7f;
  if (!masked) throw new Error('unmasked_client_frame');

  let payloadLength = lengthMarker;
  let offset = 2;

  if (lengthMarker === 126) {
    payloadLength = (buffer[2] << 8) | buffer[3];
    offset = 4;
  }

  const mask = buffer.subarray(offset, offset + 4);
  offset += 4;
  const payload = buffer.subarray(offset, offset + payloadLength);
  const decoded = Buffer.alloc(payloadLength);

  for (let i = 0; i < payloadLength; i += 1) {
    decoded[i] = payload[i] ^ mask[i % 4];
  }

  return decoded.toString('utf8');
}

function send(socket, message) {
  metrics.messagesTx += 1;
  socket.write(encodeFrame(JSON.stringify(message)));
}

function snapshot() {
  return {
    ts: now(),
    npc: world.npc,
    players: Array.from(clients.values()).map((client) => ({
      id: client.player.id,
      name: client.player.name,
      hp: client.player.hp,
      maxHp: client.player.maxHp,
      mana: client.player.mana,
      maxMana: client.player.maxMana,
      x: client.player.x,
      y: client.player.y,
      authenticated: client.player.authenticated,
    })),
  };
}

function broadcast(message) {
  for (const client of clients.values()) {
    send(client.socket, message);
  }
}

function useItem(player, itemId) {
  const item = player.inventory.find((entry) => entry.id === itemId && entry.qty > 0);
  if (!item) return { ok: false, error: 'item_not_available' };

  item.qty -= 1;
  if (item.heal) player.hp = Math.min(player.maxHp, player.hp + item.heal);
  if (item.mana) player.mana = Math.min(player.maxMana, player.mana + item.mana);
  return { ok: true };
}

function damageNpc(points) {
  world.npc.hp = Math.max(0, world.npc.hp - points);
  if (world.npc.hp === 0) {
    world.npc.hp = world.npc.maxHp;
  }
}

function ensureAuthenticated(client) {
  if (client.player.authenticated) return true;
  metrics.errors.unauthenticated += 1;
  send(client.socket, { type: 'error', error: 'unauthenticated', hint: 'send auth first' });
  return false;
}

function applyAction(client, payload) {
  const { player } = client;

  if (payload.type === 'auth') {
    if (payload.token !== AUTH_TOKEN) {
      metrics.errors.unauthenticated += 1;
      return { type: 'auth', ok: false };
    }
    player.authenticated = true;
    return { type: 'auth', ok: true, playerId: player.id };
  }

  if (!ensureAuthenticated(client)) return null;

  const elapsed = now() - player.lastActionAt;
  if (elapsed < 110) {
    metrics.errors.rateLimited += 1;
    return { type: 'error', error: 'rate_limited' };
  }
  player.lastActionAt = now();

  if (payload.type === 'move') {
    metrics.actions.move += 1;
    player.x = Math.max(0, Math.min(640, player.x + (payload.dx ?? 0)));
    player.y = Math.max(0, Math.min(360, player.y + (payload.dy ?? 0)));
    return { type: 'ack', action: 'move', x: player.x, y: player.y };
  }

  if (payload.type === 'attack') {
    metrics.actions.attack += 1;
    damageNpc(10);
    return { type: 'combat', action: 'attack', dealt: 10, npcHp: world.npc.hp };
  }

  if (payload.type === 'use_skill') {
    metrics.actions.use_skill += 1;
    const skill = player.skills.find((x) => x.id === payload.skillId);
    if (!skill) return { type: 'error', error: 'skill_not_found' };
    if (player.mana < skill.manaCost) return { type: 'error', error: 'not_enough_mana' };

    player.mana -= skill.manaCost;
    damageNpc(skill.damage);
    return { type: 'combat', action: 'use_skill', skillId: skill.id, dealt: skill.damage, npcHp: world.npc.hp, mana: player.mana };
  }

  if (payload.type === 'use_item') {
    metrics.actions.use_item += 1;
    const result = useItem(player, payload.itemId);
    if (!result.ok) return { type: 'error', error: result.error };
    return { type: 'inventory', action: 'use_item', hp: player.hp, mana: player.mana, inventory: player.inventory };
  }

  metrics.actions.unsupported += 1;
  return { type: 'error', error: 'unsupported_action' };
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', clients: clients.size, npcHp: world.npc.hp }));
    return;
  }

  if (req.url === '/snapshot') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(snapshot()));
    return;
  }

  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ts: now(), clients: clients.size, metrics }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.on('upgrade', (req, socket) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '\r\n',
  ].join('\r\n'));

  const id = randomId();
  const player = createPlayerState();
  clients.set(id, { socket, player });
  metrics.connectionsOpened += 1;
  log('socket_connected', { id, playerId: player.id });

  send(socket, { type: 'welcome', player: { id: player.id, name: player.name }, world: snapshot(), authRequired: true });

  socket.on('data', (chunk) => {
    metrics.messagesRx += 1;
    try {
      const payload = JSON.parse(decodeFrame(chunk));
      const response = applyAction(clients.get(id), payload);
      if (response) send(socket, response);
      broadcast({ type: 'state_update', world: snapshot() });
    } catch (error) {
      metrics.errors.invalidMessage += 1;
      send(socket, { type: 'error', error: 'invalid_message' });
    }
  });

  const closeHandler = () => {
    if (!clients.has(id)) return;
    clients.delete(id);
    metrics.connectionsClosed += 1;
    log('socket_closed', { id, playerId: player.id });
    broadcast({ type: 'state_update', world: snapshot() });
  };

  socket.on('close', closeHandler);
  socket.on('error', closeHandler);
});

setInterval(() => {
  if (clients.size > 0) {
    broadcast({ type: 'state_update', world: snapshot() });
  }
}, TICK_MS);

server.listen(PORT, '0.0.0.0', () => {
  log('gateway_started', { port: PORT, ws: `ws://0.0.0.0:${PORT}/ws`, authTokenHint: AUTH_TOKEN });
});
