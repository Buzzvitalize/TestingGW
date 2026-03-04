const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const info = document.getElementById('render-info');
const statusNode = document.getElementById('status');
const logNode = document.getElementById('log');

let socket;

function log(message) {
  const item = document.createElement('li');
  item.textContent = message;
  logNode.appendChild(item);
}

function drawBackgroundGrid() {
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

function renderSprite() {
  drawBackgroundGrid();
  const sprite = new Image();

  sprite.onload = () => {
    for (let i = 0; i < 5; i += 1) {
      ctx.drawImage(sprite, 20 + i * 56, 70, 32, 32);
    }
    info.textContent = 'Render OK: sprite cargado y dibujado en canvas.';
  };

  sprite.onerror = () => {
    info.textContent = 'No se pudo cargar el sprite seleccionado.';
  };

  sprite.src = '../../Client/UI/Texture/ico/Hand.ico';
}

function connect() {
  const url = document.getElementById('url').value;

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  }

  socket = new WebSocket(url);

  socket.addEventListener('open', () => {
    statusNode.textContent = 'Conectado';
    statusNode.className = 'ok';
    log('Socket conectado');
  });

  socket.addEventListener('message', (event) => {
    log(`RX: ${event.data}`);
  });

  socket.addEventListener('close', () => {
    statusNode.textContent = 'Desconectado';
    statusNode.className = 'warn';
    log('Socket cerrado');
  });

  socket.addEventListener('error', () => {
    statusNode.textContent = 'Error de conexión';
    statusNode.className = 'warn';
    log('Socket error');
  });
}

function sendPing() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    log('No hay conexión activa');
    return;
  }

  const payload = { type: 'ping', ts: Date.now() };
  socket.send(JSON.stringify(payload));
  log(`TX: ${JSON.stringify(payload)}`);
}

document.getElementById('connect').addEventListener('click', connect);
document.getElementById('ping').addEventListener('click', sendPing);

renderSprite();
