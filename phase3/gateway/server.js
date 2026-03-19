const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8090);
const clients = new Map();

const world = {
  npc: { id: 'npc-goblin-1', name: 'Goblin Scout', hp: 140, maxHp: 140, x: 320, y: 180 },
};

function now() {
  return Date.now();
}

function randomId() {
  return crypto.randomUUID().slice(0, 8);
}

function createPlayerState() {
  return {
    id: `p-${randomId()}`,
    name: `Player-${Math.floor(Math.random() * 999)}`,
    hp: 100,
    maxHp: 100,
    mana: 50,
    maxMana: 50,
    x: 80,
    y: 80,
    inventory: [
      { id: 'potion-small', qty: 3, heal: 25 },
      { id: 'ether-small', qty: 2, mana: 20 },
    ],
    skills: [
      { id: 'slash', manaCost: 0, damage: 10 },
      { id: 'fireball', manaCost: 15, damage: 24 },
    ],
    cooldowns: {},
    lastActionAt: 0,
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

  if (!masked) {
    throw new Error('unmasked_client_frame');
  }

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
    })),
  };
}

function broadcast(message) {
  for (const client of clients.values()) {
    send(client.socket, message);
  }
}

function applyDamageToNpc(damage) {
  world.npc.hp = Math.max(0, world.npc.hp - damage);
  if (world.npc.hp === 0) {
    world.npc.hp = world.npc.maxHp;
  }
}

function useInventory(player, itemId) {
  const item = player.inventory.find((entry) => entry.id === itemId && entry.qty > 0);
  if (!item) return { ok: false, error: 'item_not_available' };

  item.qty -= 1;
  if (item.heal) {
    player.hp = Math.min(player.maxHp, player.hp + item.heal);
  }
  if (item.mana) {
    player.mana = Math.min(player.maxMana, player.mana + item.mana);
  }
  return { ok: true, itemId };
}

function applyAction(client, payload) {
  const { player } = client;
  const elapsed = now() - player.lastActionAt;
  if (elapsed < 120) {
    return { type: 'error', error: 'rate_limited' };
  }
  player.lastActionAt = now();

  if (payload.type === 'move') {
    player.x = Math.max(0, Math.min(640, player.x + (payload.dx ?? 0)));
    player.y = Math.max(0, Math.min(360, player.y + (payload.dy ?? 0)));
    return { type: 'ack', action: 'move', x: player.x, y: player.y };
  }

  if (payload.type === 'attack') {
    applyDamageToNpc(8);
    return { type: 'combat', action: 'attack', dealt: 8, npcHp: world.npc.hp };
  }

  if (payload.type === 'use_skill') {
    const skill = player.skills.find((entry) => entry.id === payload.skillId);
    if (!skill) return { type: 'error', error: 'skill_not_found' };
    if (player.mana < skill.manaCost) return { type: 'error', error: 'not_enough_mana' };

    player.mana -= skill.manaCost;
    applyDamageToNpc(skill.damage);
    return {
      type: 'combat',
      action: 'use_skill',
      skillId: skill.id,
      dealt: skill.damage,
      npcHp: world.npc.hp,
      playerMana: player.mana,
    };
  }

  if (payload.type === 'use_item') {
    const result = useInventory(player, payload.itemId);
    if (!result.ok) return { type: 'error', error: result.error };
    return {
      type: 'inventory',
      action: 'use_item',
      itemId: payload.itemId,
      hp: player.hp,
      mana: player.mana,
      inventory: player.inventory,
    };
  }

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

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.on('upgrade', (req, socket) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  const acceptKey = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');

  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '\r\n',
  ].join('\r\n'));

  const player = createPlayerState();
  const id = randomId();
  clients.set(id, { socket, player });

  send(socket, { type: 'welcome', player, world: snapshot() });
  broadcast({ type: 'state_update', world: snapshot() });

  socket.on('data', (chunk) => {
    try {
      const payload = JSON.parse(decodeFrame(chunk));
      const response = applyAction(clients.get(id), payload);
      send(socket, response);
      broadcast({ type: 'state_update', world: snapshot() });
    } catch {
      send(socket, { type: 'error', error: 'invalid_message' });
    }
  });

  socket.on('close', () => {
    clients.delete(id);
    broadcast({ type: 'state_update', world: snapshot() });
  });
  socket.on('error', () => clients.delete(id));
});

setInterval(() => {
  if (clients.size > 0) {
    broadcast({ type: 'state_update', world: snapshot() });
  }
}, 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`GW phase3 gateway listening on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);
});
