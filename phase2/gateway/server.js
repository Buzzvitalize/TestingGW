const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8080);
const clients = new Set();

function encodeFrame(payloadText) {
  const payload = Buffer.from(payloadText);
  const length = payload.length;

  if (length >= 126) {
    throw new Error('Payload too large for minimal frame encoder');
  }

  return Buffer.concat([Buffer.from([0x81, length]), payload]);
}

function decodeFrame(buffer) {
  const secondByte = buffer[1];
  const isMasked = (secondByte & 0x80) !== 0;
  const payloadLength = secondByte & 0x7f;

  if (!isMasked) {
    throw new Error('Client frames must be masked');
  }

  const maskOffset = 2;
  const payloadOffset = maskOffset + 4;
  const mask = buffer.subarray(maskOffset, payloadOffset);
  const payload = buffer.subarray(payloadOffset, payloadOffset + payloadLength);
  const decoded = Buffer.alloc(payloadLength);

  for (let i = 0; i < payloadLength; i += 1) {
    decoded[i] = payload[i] ^ mask[i % 4];
  }

  return decoded.toString('utf8');
}

function sendJson(socket, message) {
  socket.write(encodeFrame(JSON.stringify(message)));
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', clients: clients.size }));
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

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
  ];

  socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
  clients.add(socket);
  sendJson(socket, { type: 'welcome', message: 'GW phase2 gateway online' });

  socket.on('data', (chunk) => {
    try {
      const text = decodeFrame(chunk);
      const payload = JSON.parse(text);

      if (payload.type === 'ping') {
        sendJson(socket, { type: 'pong', ts: Date.now(), echoTs: payload.ts ?? null });
      } else {
        sendJson(socket, { type: 'ack', receivedType: payload.type ?? null });
      }
    } catch {
      sendJson(socket, { type: 'error', error: 'invalid_message' });
    }
  });

  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`GW phase2 gateway listening on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);
});
