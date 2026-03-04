const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const statusNode = document.getElementById('status');
const eventsNode = document.getElementById('events');
const metricsNode = document.getElementById('metrics');

let socket;
let me;
let world;
let rtt = null;
let lastPing = 0;

function log(text) {
  const li = document.createElement('li');
  li.textContent = text;
  eventsNode.prepend(li);
}

function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    log('No conectado');
    return;
  }
  socket.send(JSON.stringify(payload));
}

function drawGrid() {
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#1e293b';

  for (let x = 0; x < canvas.width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function render() {
  drawGrid();
  if (!world) return;

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(world.npc.x, world.npc.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText('NPC', world.npc.x - 12, world.npc.y - 18);

  world.players.forEach((player) => {
    ctx.fillStyle = player.id === me?.id ? '#22c55e' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 10, 0, Math.PI * 2);
    ctx.fill();
  });

  const current = world.players.find((x) => x.id === me?.id);
  if (current) {
    hud.textContent = `HP: ${current.hp}/${current.maxHp} | Mana: ${current.mana}/${current.maxMana} | NPC HP: ${world.npc.hp}/${world.npc.maxHp} | RTT: ${rtt ?? '-'} ms`;
  }
}

async function refreshMetrics() {
  try {
    const response = await fetch('http://localhost:8100/metrics');
    const data = await response.json();
    metricsNode.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    metricsNode.textContent = `No se pudo cargar métricas: ${error.message}`;
  }
}

function connect() {
  const url = document.getElementById('ws-url').value;
  const token = document.getElementById('token').value;

  socket = new WebSocket(url);

  socket.onopen = () => {
    statusNode.textContent = 'Conectado';
    statusNode.className = 'ok';
    log('Conectado. Enviando auth...');
    send({ type: 'auth', token });

    setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      lastPing = Date.now();
      send({ type: 'move', dx: 0, dy: 0 });
    }, 4000);
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'welcome') {
      me = msg.player;
      world = msg.world;
      log(`Welcome ${me.name}`);
      render();
      return;
    }

    if (msg.type === 'auth') {
      log(msg.ok ? 'Auth OK' : 'Auth fail');
      return;
    }

    if (msg.type === 'state_update') {
      world = msg.world;
      rtt = Date.now() - lastPing;
      render();
      return;
    }

    log(`RX ${msg.type}: ${JSON.stringify(msg)}`);
  };

  socket.onerror = () => {
    statusNode.textContent = 'Error';
    statusNode.className = 'warn';
    log('Error de conexión');
  };

  socket.onclose = () => {
    statusNode.textContent = 'Desconectado';
    statusNode.className = 'warn';
    log('Conexión cerrada');
  };
}

document.getElementById('connect').addEventListener('click', connect);
document.getElementById('refresh-metrics').addEventListener('click', refreshMetrics);
document.querySelectorAll('[data-move]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const dir = btn.dataset.move;
    const map = { up: [0, -16], down: [0, 16], left: [-16, 0], right: [16, 0] };
    const [dx, dy] = map[dir];
    send({ type: 'move', dx, dy });
  });
});

document.getElementById('attack').addEventListener('click', () => send({ type: 'attack' }));
document.getElementById('use-skill').addEventListener('click', () => send({ type: 'use_skill', skillId: document.getElementById('skill').value }));
document.getElementById('use-item').addEventListener('click', () => send({ type: 'use_item', itemId: document.getElementById('item').value }));

render();
