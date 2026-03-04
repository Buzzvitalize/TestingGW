let socket;

async function loadInventory() {
  const response = await fetch('../asset_inventory.json');
  const data = await response.json();

  const summary = document.getElementById('inventory-summary');
  summary.textContent = `Total: ${data.total_files} archivos · Web directos: ${data.summary.browser_ready_files} · Legacy/custom: ${data.summary.legacy_or_custom_files}`;

  const topExt = document.getElementById('top-ext');
  topExt.innerHTML = '';
  data.extensions.slice(0, 8).forEach((row) => {
    const li = document.createElement('li');
    li.textContent = `${row.ext}: ${row.count} (${row.browser_ready ? 'web-directo' : 'requiere conversión'})`;
    topExt.appendChild(li);
  });
}

function logMessage(text) {
  const li = document.createElement('li');
  li.textContent = text;
  document.getElementById('ws-log').appendChild(li);
}

document.getElementById('connect').addEventListener('click', () => {
  const wsStatus = document.getElementById('ws-status');
  const wsUrl = document.getElementById('ws-url').value;

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  }

  socket = new WebSocket(wsUrl);

  socket.addEventListener('open', () => {
    wsStatus.textContent = 'Conectado';
    wsStatus.className = 'ok';
    logMessage('Conexión abierta.');
  });

  socket.addEventListener('message', (event) => {
    logMessage(`Mensaje recibido: ${event.data}`);
  });

  socket.addEventListener('close', () => {
    wsStatus.textContent = 'Desconectado';
    wsStatus.className = 'warn';
    logMessage('Conexión cerrada.');
  });

  socket.addEventListener('error', () => {
    wsStatus.textContent = 'Error de conexión';
    wsStatus.className = 'warn';
    logMessage('Error WebSocket (revisa URL/gateway).');
  });
});

document.getElementById('ping').addEventListener('click', () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    logMessage('No hay conexión activa para enviar ping.');
    return;
  }

  const payload = JSON.stringify({ type: 'ping', ts: Date.now() });
  socket.send(payload);
  logMessage(`Ping enviado: ${payload}`);
});

loadInventory().catch((error) => {
  document.getElementById('inventory-summary').textContent = `No se pudo cargar inventario: ${error.message}`;
});
