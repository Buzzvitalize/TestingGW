const { spawn } = require('child_process');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed ${url}`);
  return res.json();
}

async function queueClientAndAttack() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:8140/ws');
    let roomId;
    const timer = setTimeout(() => reject(new Error('timeout')), 8000);

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'welcome') {
        ws.send(JSON.stringify({ type: 'auth', token: 'gw-phase8-demo' }));
        setTimeout(() => ws.send(JSON.stringify({ type: 'queue_join' })), 80);
      }
      if (msg.type === 'match_found') {
        roomId = msg.room.roomId;
        setTimeout(() => ws.send(JSON.stringify({ type: 'attack' })), 120);
      }
      if (msg.type === 'combat' && roomId) {
        clearTimeout(timer);
        ws.close();
        resolve(roomId);
      }
    };

    ws.onerror = (e) => reject(e);
  });
}

(async () => {
  const child = spawn('node', ['phase8/gateway/server.js'], { stdio: 'ignore' });
  try {
    await wait(450);

    const health = await fetchJson('http://127.0.0.1:8140/health');
    if (health.status !== 'ok') throw new Error('health not ok');

    const [roomA, roomB] = await Promise.all([queueClientAndAttack(), queueClientAndAttack()]);
    if (!roomA || roomA !== roomB) throw new Error('room mismatch');

    const simulate = await fetchJson(`http://127.0.0.1:8140/simulate?roomId=${encodeURIComponent(roomA)}&ticks=5`);
    if (!simulate.ok) throw new Error('simulate failed');

    const ndjson = await fetch(`http://127.0.0.1:8140/events.ndjson?roomId=${encodeURIComponent(roomA)}`).then((r) => r.text());
    if (!ndjson.includes('attack') && !ndjson.includes('sim_tick')) throw new Error('ndjson missing events');

    const metrics = await fetchJson('http://127.0.0.1:8140/metrics');
    if (metrics.metrics.matches < 1 || metrics.metrics.simulations < 1) throw new Error('metrics not updated');

    console.log('PHASE8_INTEGRATION_OK');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    child.kill('SIGTERM');
  }
})();
