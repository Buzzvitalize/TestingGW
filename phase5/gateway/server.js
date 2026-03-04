const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8110);
const AUTH_TOKEN = process.env.GW_DEMO_TOKEN || 'gw-phase5-demo';

const clients = new Map();
const sessions = new Map();
const leaderboard = new Map();
const combatLog = [];

const world = {
  npc: { id: 'npc-colossus', name: 'Ancient Colossus', hp: 400, maxHp: 400, x: 420, y: 220 },
};

const metrics = {
  opened: 0,
  closed: 0,
  rx: 0,
  tx: 0,
  resumedSessions: 0,
  actions: { auth: 0, move: 0, attack: 0, use_skill: 0, use_item: 0, unsupported: 0 },
};

const now = () => Date.now();
const id = () => crypto.randomUUID().slice(0, 8);

function createPlayer() {
  const playerId = `p-${id()}`;
  return {
    id: playerId,
    sessionId: `s-${id()}`,
    name: `Player-${Math.floor(Math.random() * 1000)}`,
    hp: 100,
    maxHp: 100,
    mana: 70,
    maxMana: 70,
    x: 80,
    y: 80,
    authenticated: false,
    inventory: [
      { id: 'potion-small', qty: 3, heal: 25 },
      { id: 'ether-small', qty: 2, mana: 20 },
    ],
    skills: [
      { id: 'slash', manaCost: 0, damage: 14 },
      { id: 'fireball', manaCost: 20, damage: 34 },
    ],
    score: 0,
    lastActionAt: 0,
  };
}

function frameEncode(text) {
  const payload = Buffer.from(text);
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  if (payload.length < 65536) return Buffer.concat([Buffer.from([0x81, 126, (payload.length >> 8) & 255, payload.length & 255]), payload]);
  throw new Error('payload_too_large');
}

function frameDecode(buf) {
  const secondByte = buf[1];
  const masked = (secondByte & 0x80) !== 0;
  if (!masked) throw new Error('unmasked');

  let len = secondByte & 0x7f;
  let offset = 2;
  if (len === 126) {
    len = (buf[2] << 8) | buf[3];
    offset = 4;
  }

  const mask = buf.subarray(offset, offset + 4);
  offset += 4;
  const payload = buf.subarray(offset, offset + len);
  const decoded = Buffer.alloc(len);
  for (let i = 0; i < len; i += 1) decoded[i] = payload[i] ^ mask[i % 4];
  return decoded.toString('utf8');
}

function send(socket, payload) {
  metrics.tx += 1;
  socket.write(frameEncode(JSON.stringify(payload)));
}

function addCombatLog(entry) {
  combatLog.unshift({ ts: now(), ...entry });
  if (combatLog.length > 50) combatLog.pop();
}

function score(player, points) {
  player.score += points;
  leaderboard.set(player.id, { id: player.id, name: player.name, score: player.score });
}

function snapshot() {
  return {
    ts: now(),
    npc: world.npc,
    players: Array.from(clients.values()).map((c) => ({
      id: c.player.id,
      name: c.player.name,
      hp: c.player.hp,
      maxHp: c.player.maxHp,
      mana: c.player.mana,
      maxMana: c.player.maxMana,
      x: c.player.x,
      y: c.player.y,
      score: c.player.score,
    })),
  };
}

function topLeaderboard() {
  return Array.from(leaderboard.values()).sort((a, b) => b.score - a.score).slice(0, 10);
}

function broadcast(payload) {
  for (const c of clients.values()) send(c.socket, payload);
}

function npcTakeDamage(amount, player) {
  world.npc.hp = Math.max(0, world.npc.hp - amount);
  addCombatLog({ playerId: player.id, playerName: player.name, dealt: amount, npcHp: world.npc.hp });
  score(player, amount);

  if (world.npc.hp === 0) {
    score(player, 50);
    world.npc.hp = world.npc.maxHp;
    addCombatLog({ system: 'npc_respawn', by: player.id, npcHp: world.npc.hp });
  }
}

function applyAction(client, payload) {
  const player = client.player;

  if (payload.type === 'auth') {
    metrics.actions.auth += 1;
    if (payload.token !== AUTH_TOKEN) return { type: 'auth', ok: false };

    if (payload.sessionId && sessions.has(payload.sessionId)) {
      const resumed = sessions.get(payload.sessionId);
      Object.assign(player, resumed);
      metrics.resumedSessions += 1;
    }

    player.authenticated = true;
    sessions.set(player.sessionId, player);
    return { type: 'auth', ok: true, playerId: player.id, sessionId: player.sessionId, resumed: Boolean(payload.sessionId) };
  }

  if (!player.authenticated) return { type: 'error', error: 'unauthenticated' };

  const elapsed = now() - player.lastActionAt;
  if (elapsed < 90) return { type: 'error', error: 'rate_limited' };
  player.lastActionAt = now();

  if (payload.type === 'move') {
    metrics.actions.move += 1;
    player.x = Math.max(0, Math.min(640, player.x + (payload.dx ?? 0)));
    player.y = Math.max(0, Math.min(360, player.y + (payload.dy ?? 0)));
    return { type: 'ack', action: 'move', x: player.x, y: player.y };
  }

  if (payload.type === 'attack') {
    metrics.actions.attack += 1;
    npcTakeDamage(12, player);
    return { type: 'combat', action: 'attack', dealt: 12, npcHp: world.npc.hp, score: player.score };
  }

  if (payload.type === 'use_skill') {
    metrics.actions.use_skill += 1;
    const skill = player.skills.find((x) => x.id === payload.skillId);
    if (!skill) return { type: 'error', error: 'skill_not_found' };
    if (player.mana < skill.manaCost) return { type: 'error', error: 'not_enough_mana' };
    player.mana -= skill.manaCost;
    npcTakeDamage(skill.damage, player);
    return { type: 'combat', action: 'use_skill', skillId: skill.id, dealt: skill.damage, npcHp: world.npc.hp, mana: player.mana, score: player.score };
  }

  if (payload.type === 'use_item') {
    metrics.actions.use_item += 1;
    const item = player.inventory.find((x) => x.id === payload.itemId && x.qty > 0);
    if (!item) return { type: 'error', error: 'item_not_available' };
    item.qty -= 1;
    if (item.heal) player.hp = Math.min(player.maxHp, player.hp + item.heal);
    if (item.mana) player.mana = Math.min(player.maxMana, player.mana + item.mana);
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

  if (req.url === '/leaderboard') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ts: now(), leaderboard: topLeaderboard() }));
    return;
  }

  if (req.url === '/combat-log') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ts: now(), events: combatLog }));
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

  const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '\r\n',
  ].join('\r\n'));

  const player = createPlayer();


  const cid = id();
  clients.set(cid, { socket, player });
  leaderboard.set(player.id, { id: player.id, name: player.name, score: player.score });
  metrics.opened += 1;

  send(socket, { type: 'welcome', player: { id: player.id, name: player.name, sessionId: player.sessionId }, world: snapshot(), authRequired: true });
  broadcast({ type: 'state_update', world: snapshot(), leaderboard: topLeaderboard() });

  socket.on('data', (chunk) => {
    metrics.rx += 1;
    try {
      const payload = JSON.parse(frameDecode(chunk));
      const response = applyAction(clients.get(cid), payload);
      send(socket, response);
      broadcast({ type: 'state_update', world: snapshot(), leaderboard: topLeaderboard() });
    } catch {
      send(socket, { type: 'error', error: 'invalid_message' });
    }
  });

  const close = () => {
    if (!clients.has(cid)) return;
    clients.delete(cid);
    sessions.set(player.sessionId, player);
    metrics.closed += 1;
    broadcast({ type: 'state_update', world: snapshot(), leaderboard: topLeaderboard() });
  };

  socket.on('close', close);
  socket.on('error', close);
});

setInterval(() => {
  if (clients.size > 0) {
    broadcast({ type: 'state_update', world: snapshot(), leaderboard: topLeaderboard() });
  }
}, 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ event: 'phase5_gateway_started', port: PORT, tokenHint: AUTH_TOKEN }));
});
