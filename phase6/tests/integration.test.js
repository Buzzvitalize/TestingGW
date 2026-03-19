const { spawn } = require('child_process');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed ${url}`);
  return res.json();
}

async function wsFlow() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:8120/ws');
    let joined = false;
    let combat = false;

    const t = setTimeout(() => reject(new Error('timeout')), 6000);

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'welcome') {
        ws.send(JSON.stringify({ type: 'auth', token: 'gw-phase6-demo' }));
        setTimeout(() => ws.send(JSON.stringify({ type: 'join_room', roomId: 'test-room' })), 120);
        setTimeout(() => ws.send(JSON.stringify({ type: 'attack' })), 260);
      }
      if (msg.type === 'join_room' && msg.ok) joined = true;
      if (msg.type === 'combat') combat = true;
      if (joined && combat) {
        clearTimeout(t);
        ws.close();
        resolve();
      }
    };

    ws.onerror = (e) => reject(e);
  });
}

(async () => {
  const child = spawn('node', ['phase6/gateway/server.js'], { stdio: 'ignore' });
  try {
    await wait(450);

    const health = await fetchJson('http://127.0.0.1:8120/health');
    if (health.status !== 'ok') throw new Error('health not ok');

    await wsFlow();

    const rooms = await fetchJson('http://127.0.0.1:8120/rooms');
    if (!Array.isArray(rooms.rooms) || rooms.rooms.length === 0) throw new Error('rooms empty');

    const replay = await fetchJson('http://127.0.0.1:8120/replay?roomId=test-room');
    if (!Array.isArray(replay.events) || replay.events.length === 0) throw new Error('replay empty');

    console.log('PHASE6_INTEGRATION_OK');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    child.kill('SIGTERM');
  }
})();
