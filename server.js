import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// lowdb setup
const dbFile = path.join(__dirname, 'db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter);
await db.read();
db.data ||= {
  players: [],
  matches: [],
  currentMatch: null
};
await db.write();

// SSE clients
let clients = [];
function sendEvent(data){
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => {
    try { res.write(payload); } catch(e){}
  });
}

// Public API
app.get('/api/public', async (req, res) => {
  await db.read();
  res.json({ players: db.data.players, currentMatch: db.data.currentMatch });
});

// Admin endpoints (open)
app.post('/api/admin/createMatch', async (req, res) => {
  const { teamA, teamB, venue, date, overs } = req.body;
  await db.read();
  const match = {
    id: nanoid(8),
    teamA: teamA || 'Ekta Cricket Club',
    teamB: teamB || 'Opponent',
    venue: venue || '',
    date: date || '',
    overs: overs || 20,
    playingXI: { teamA: [], teamB: [] },
    innings: { battingTeam: null, runs:0, wickets:0, overs:0, balls:0, ballsLog:[] },
    status: 'not_started'
  };
  db.data.matches.push(match);
  db.data.currentMatch = match;
  await db.write();
  sendEvent({ type:'match_created', match });
  res.json(match);
});

app.post('/api/admin/startInnings', async (req, res) => {
  const { battingTeam } = req.body;
  await db.read();
  const m = db.data.currentMatch;
  if(!m) return res.status(400).json({ error:'no_match' });
  m.innings = { battingTeam, runs:0, wickets:0, overs:0, balls:0, ballsLog:[] };
  m.status = 'live';
  await db.write();
  sendEvent({ type:'start_innings', match: m });
  res.json(m);
});

app.post('/api/admin/addBall', async (req, res) => {
  const { ball } = req.body; // ball: { runs, isWicket, extraType }
  await db.read();
  const m = db.data.currentMatch;
  if(!m || m.status !== 'live') return res.status(400).json({ error:'no_live_match' });
  const extra = ball.extraType || null;
  const entry = { id: nanoid(8), legal: !(extra === 'wide' || extra === 'no-ball'), runs: ball.runs||0, isWicket: !!ball.isWicket, extraType: extra||'', time: Date.now() };
  if(entry.legal){
    m.innings.runs += entry.runs;
    if(entry.isWicket) m.innings.wickets += 1;
    m.innings.balls += 1;
    if(m.innings.balls >= 6){ m.innings.overs += 1; m.innings.balls = 0; }
  } else {
    m.innings.runs += (entry.runs + 1);
  }
  m.innings.ballsLog.push(entry);
  await db.write();
  sendEvent({ type:'ball', match: m, lastBall: entry });
  res.json(m);
});

// SSE stream
app.get('/api/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();
  res.write('retry: 2000\n\n');
  clients.push(res);
  req.on('close', () => { clients = clients.filter(c => c !== res); });
});

// Redirect root to public page
app.get('/', (req, res) => {
  res.redirect('/public/index.html');
});

app.listen(PORT, () => console.log('✅ Server running on port', PORT));
