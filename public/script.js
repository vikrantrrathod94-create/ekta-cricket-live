async function fetchPublic(){
  try{
    const res = await fetch('/api/public');
    const j = await res.json();
    render(j);
  }catch(e){
    console.error(e);
  }
}

function render(data){
  const m = data.currentMatch;
  const players = data.players || [];
  document.getElementById('playersList').innerHTML = players.map(p=>`<li>${p.name} (${p.role}) #${p.jersey||''}</li>`).join('')||'<li>No players</li>';
  if(!m){
    document.getElementById('teams').innerText = 'No live match';
    document.getElementById('scoreline').innerText = '-- / -- (0.0)';
    document.getElementById('info').innerText = '';
    document.getElementById('ballsList').innerHTML = '';
    return;
  }
  document.getElementById('teams').innerText = m.teamA + ' vs ' + m.teamB;
  const inn = m.innings;
  const oversText = inn.overs + '.' + inn.balls;
  const battingName = (inn.battingTeam === 'teamA' ? m.teamA : m.teamB);
  document.getElementById('scoreline').innerText = `${battingName}: ${inn.runs} / ${inn.wickets} (${oversText})`;
  document.getElementById('info').innerText = `Venue: ${m.venue || '-'} • Overs: ${m.overs}`;
  const last = (inn.ballsLog||[]).slice().reverse().slice(0,12);
  const ul = document.getElementById('ballsList');
  ul.innerHTML = '';
  last.forEach(b=>{
    const li = document.createElement('li');
    li.innerText = (b.legal === false ? '[Extra] ' : '') + (b.isWicket ? 'W' : (b.runs||0)) + (b.extraType ? ' ('+b.extraType+')' : '');
    ul.appendChild(li);
  });
}

// SSE to auto-update
const evt = new EventSource('/api/stream');
evt.onmessage = function(e){
  try{
    const d = JSON.parse(e.data);
    fetchPublic();
  }catch(err){}
};

fetchPublic();
