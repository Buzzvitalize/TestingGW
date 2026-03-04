const { spawn } = require('child_process');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} failed ${res.status}`);
  return res.json();
}

async function wsFlow() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:8110/ws');
    let okAuth = false;
    let okCombat = false;

    const timeout = setTimeout(() => reject(new Error('ws timeout')), 5000);

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'welcome') {
        ws.send(JSON.stringify({ type: 'auth', token: 'gw-phase5-demo' }));
        setTimeout(() => ws.send(JSON.stringify({ type: 'attack' })), 140);
      }
      if (msg.type === 'auth' && msg.ok) okAuth = true;
      if (msg.type === 'combat') okCombat = true;
      if (okAuth && okCombat) {
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    };

    ws.onerror = (e) => reject(e);
  });
}

(async () => {
  const child = spawn('node', ['phase5/gateway/server.js'], { stdio: 'ignore' });
  try {
    await wait(400);

    const health = await fetchJson('http://127.0.0.1:8110/health');
    if (health.status !== 'ok') throw new Error('health not ok');

    await wsFlow();

    const board = await fetchJson('http://127.0.0.1:8110/leaderboard');
    if (!Array.isArray(board.leaderboard)) throw new Error('leaderboard missing');

    const clog = await fetchJson('http://127.0.0.1:8110/combat-log');
    if (!Array.isArray(clog.events) || clog.events.length === 0) throw new Error('combat log empty');

    console.log('PHASE5_INTEGRATION_OK');
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  } finally {
    child.kill('SIGTERM');
  }
})();
