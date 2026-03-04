const canvas=document.getElementById('world');
const ctx=canvas.getContext('2d');
const hud=document.getElementById('hud');
const eventsNode=document.getElementById('events');
const roomsNode=document.getElementById('rooms-data');
const metricsNode=document.getElementById('metrics-data');
const opsNode=document.getElementById('ops-data');

let socket; let me; let roomState;

function log(t){const li=document.createElement('li');li.textContent=t;eventsNode.prepend(li);} 
function send(p){if(socket && socket.readyState===WebSocket.OPEN) socket.send(JSON.stringify(p));}

function render(){
  ctx.fillStyle='#0b1220';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#1e293b';
  for(let x=0;x<canvas.width;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
  for(let y=0;y<canvas.height;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
  if(!roomState) return;
  ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(roomState.npc.x,roomState.npc.y,14,0,Math.PI*2);ctx.fill();
  roomState.players.forEach(p=>{ctx.fillStyle=p.id===me?.id?'#22c55e':'#38bdf8';ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.fill();});
  const current=roomState.players.find(p=>p.id===me?.id);
  if(current) hud.textContent=`Room: ${roomState.roomId} | Score: ${current.score} | NPC HP: ${roomState.npc.hp}/${roomState.npc.maxHp}`;
}

function connect(){
  socket=new WebSocket(document.getElementById('ws-url').value);
  const token=document.getElementById('token').value;
  socket.onopen=()=>log('Conectado');
  socket.onmessage=(ev)=>{
    const msg=JSON.parse(ev.data);
    if(msg.type==='welcome'){me=msg.player;send({type:'auth',token});return;}
    if(msg.type==='match_found'){roomState=msg.room;render();log(`Match found: ${msg.room.roomId}`);return;}
    if(msg.type==='state_update'){roomState=msg.room;render();return;}
    log(`RX ${msg.type}: ${JSON.stringify(msg)}`);
  };
}

async function loadRooms(){const d=await fetch('http://localhost:8130/rooms').then(r=>r.json());roomsNode.textContent=JSON.stringify(d.rooms,null,2);} 
async function loadMetrics(){const d=await fetch('http://localhost:8130/metrics').then(r=>r.json());metricsNode.textContent=JSON.stringify(d,null,2);} 
function connectOps(){
  const es = new EventSource('http://localhost:8130/ops/stream');
  es.onmessage = () => {};
  ['sse_connected','queue_join','match_created','npc_respawn','ws_connected','ws_closed','auth_ok'].forEach((name)=>{
    es.addEventListener(name,(evt)=>{opsNode.textContent = `${name}: ${evt.data}\n` + opsNode.textContent;});
  });
}

document.getElementById('connect').addEventListener('click',connect);
document.getElementById('queue').addEventListener('click',()=>send({type:'queue_join'}));
document.getElementById('rooms').addEventListener('click',loadRooms);
document.getElementById('metrics').addEventListener('click',loadMetrics);
document.getElementById('ops').addEventListener('click',connectOps);
document.querySelectorAll('[data-move]').forEach((b)=>b.addEventListener('click',()=>{const m={up:[0,-16],down:[0,16],left:[-16,0],right:[16,0]};const [dx,dy]=m[b.dataset.move];send({type:'move',dx,dy});}));
document.getElementById('attack').addEventListener('click',()=>send({type:'attack'}));

render();
