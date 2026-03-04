const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const statusNode = document.getElementById('status');
const eventsNode = document.getElementById('events');
const boardNode = document.getElementById('board');
const clogNode = document.getElementById('clog');

let socket;
let me;
let world;
let sessionId = localStorage.getItem('gw_phase5_session_id') || '';

function log(text) {
  const li = document.createElement('li');
  li.textContent = text;
  eventsNode.prepend(li);
}

function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return log('No conectado');
  socket.send(JSON.stringify(payload));
}

function render() {
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#1e293b';
  for (let x = 0; x < canvas.width; x += 32) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
  for (let y = 0; y < canvas.height; y += 32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
  if (!world) return;

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(world.npc.x, world.npc.y, 14, 0, Math.PI * 2);
  ctx.fill();

  world.players.forEach((p) => {
    ctx.fillStyle = p.id === me?.id ? '#22c55e' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
  });

  const current = world.players.find((p) => p.id === me?.id);
  if (current) hud.textContent = `HP: ${current.hp}/${current.maxHp} | Mana: ${current.mana}/${current.maxMana} | Score: ${current.score} | NPC HP: ${world.npc.hp}/${world.npc.maxHp}`;
}

function connect(useResume) {
  const wsUrl = document.getElementById('ws-url').value;
  const token = document.getElementById('token').value;

  const protocols = [];
  socket = new WebSocket(wsUrl, protocols);

  socket.onopen = () => {
    statusNode.textContent = 'Conectado';
    statusNode.className = 'ok';
    log(useResume ? 'Conectado (intentando sesión previa)' : 'Conectado');
    send({ type: 'auth', token, sessionId: useResume ? sessionId : undefined });
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'welcome') {
      me = msg.player;
      sessionId = msg.player.sessionId;
      localStorage.setItem('gw_phase5_session_id', sessionId);
      world = msg.world;
      log(`Welcome ${me.name} session=${sessionId}`);
      render();
      return;
    }
    if (msg.type === 'state_update') {
      world = msg.world;
      if (msg.leaderboard) boardNode.textContent = JSON.stringify(msg.leaderboard, null, 2);
      render();
      return;
    }
    log(`RX ${msg.type}: ${JSON.stringify(msg)}`);
  };

  socket.onerror = () => { statusNode.textContent = 'Error'; statusNode.className = 'warn'; };
  socket.onclose = () => { statusNode.textContent = 'Desconectado'; statusNode.className = 'warn'; };

  if (useResume && sessionId) {
    log(`Reusar session id en próximo connect: ${sessionId}`);
  }
}

async function loadLeaderboard() {
  const data = await fetch('http://localhost:8110/leaderboard').then((r) => r.json());
  boardNode.textContent = JSON.stringify(data.leaderboard, null, 2);
}

async function loadCombatLog() {
  const data = await fetch('http://localhost:8110/combat-log').then((r) => r.json());
  clogNode.textContent = JSON.stringify(data.events, null, 2);
}

document.getElementById('connect').addEventListener('click', () => connect(false));
document.getElementById('reconnect').addEventListener('click', () => connect(true));
document.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
  const map = { up:[0,-16], down:[0,16], left:[-16,0], right:[16,0] };
  const [dx, dy] = map[b.dataset.move];
  send({ type: 'move', dx, dy });
}));
document.getElementById('attack').addEventListener('click', () => send({ type:'attack' }));
document.getElementById('use-skill').addEventListener('click', () => send({ type:'use_skill', skillId: document.getElementById('skill').value }));
document.getElementById('use-item').addEventListener('click', () => send({ type:'use_item', itemId: document.getElementById('item').value }));
document.getElementById('load-board').addEventListener('click', loadLeaderboard);
document.getElementById('load-log').addEventListener('click', loadCombatLog);

render();
