const { spawn } = require('child_process');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed ${url}`);
  return res.json();
}

async function queueClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:8130/ws');
    const timer = setTimeout(() => reject(new Error('ws timeout')), 7000);

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'welcome') {
        ws.send(JSON.stringify({ type: 'auth', token: 'gw-phase7-demo' }));
        setTimeout(() => ws.send(JSON.stringify({ type: 'queue_join' })), 80);
      }
      if (msg.type === 'match_found') {
        clearTimeout(timer);
        ws.close();
        resolve(msg.room.roomId);
      }
    };

    ws.onerror = (e) => reject(e);
  });
}

(async () => {
  const child = spawn('node', ['phase7/gateway/server.js'], { stdio: 'ignore' });
  try {
    await wait(450);

    const health = await fetchJson('http://127.0.0.1:8130/health');
    if (health.status !== 'ok') throw new Error('health not ok');

    const [roomA, roomB] = await Promise.all([queueClient(), queueClient()]);
    if (!roomA || roomA !== roomB) throw new Error('matchmaking failed');

    const rooms = await fetchJson('http://127.0.0.1:8130/rooms');
    if (!Array.isArray(rooms.rooms) || rooms.rooms.length === 0) throw new Error('rooms empty');

    const metrics = await fetchJson('http://127.0.0.1:8130/metrics');
    if (metrics.metrics.matches < 1) throw new Error('matches metric not incremented');

    console.log('PHASE7_INTEGRATION_OK');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    child.kill('SIGTERM');
  }
})();
