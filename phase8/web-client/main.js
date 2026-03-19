const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const logNode = document.getElementById('log');
const eventsDataNode = document.getElementById('events-data');

let socket;
let me;
let roomState;

function log(t){const li=document.createElement('li');li.textContent=t;logNode.prepend(li);} 
function send(p){ if(socket && socket.readyState===WebSocket.OPEN) socket.send(JSON.stringify(p)); }

function render(){
  ctx.fillStyle='#0b1220';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(!roomState) return;
  ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(roomState.npc.x,roomState.npc.y,14,0,Math.PI*2);ctx.fill();
  roomState.players.forEach((p)=>{ctx.fillStyle=p.id===me?.id?'#22c55e':'#38bdf8';ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.fill();});
  const current = roomState.players.find((p)=>p.id===me?.id);
  if(current) hud.textContent = `Room: ${roomState.roomId} | Score: ${current.score} | Wins: ${current.wins} | Round: ${roomState.tournament.round}`;
}

function connect(){
  socket = new WebSocket(document.getElementById('ws-url').value);
  const token = document.getElementById('token').value;
  socket.onmessage = (ev)=>{
    const msg = JSON.parse(ev.data);
    if(msg.type==='welcome'){ me=msg.player; send({type:'auth',token}); return; }
    if(msg.type==='match_found'){ roomState=msg.room; render(); log(`Match: ${msg.room.roomId}`); return; }
    if(msg.type==='state_update'){ roomState=msg.room; render(); return; }
    log(`RX ${msg.type}: ${JSON.stringify(msg)}`);
  };
}

async function simulate(){
  if(!roomState) return log('No room');
  const data = await fetch(`http://localhost:8140/simulate?roomId=${encodeURIComponent(roomState.roomId)}&ticks=8`).then(r=>r.json());
  log(`Simulado ticks=${data.result.ticks}`);
}

async function loadNdjson(){
  if(!roomState) return log('No room');
  const text = await fetch(`http://localhost:8140/events.ndjson?roomId=${encodeURIComponent(roomState.roomId)}`).then(r=>r.text());
  eventsDataNode.textContent = text.split('\n').filter(Boolean).slice(-15).join('\n');
}

document.getElementById('connect').addEventListener('click', connect);
document.getElementById('queue').addEventListener('click', ()=>send({type:'queue_join'}));
document.getElementById('attack').addEventListener('click', ()=>send({type:'attack'}));
document.getElementById('simulate').addEventListener('click', simulate);
document.getElementById('events').addEventListener('click', loadNdjson);

render();
