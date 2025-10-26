// server.js - Render-ready (Express + lowdb v6 + SSE)
const express = require('express');
const path = require('path');
const cors = require('cors');
const { LowSync, JSONFileSync } = require('lowdb');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// DB setup (lowdb v6 sync)
const dbFile = path.join(__dirname, 'db.json');
const adapter = new JSONFileSync(dbFile);
const db = new LowSync(adapter);
db.read();
db.data = db.data || {
  players: [
    { id: 'p1', name: 'V R Rathod', age: '28', role: 'All-rounder', jersey: '10' },
    { id: 'p2', name: 'D B Rathod', age: '32', role: 'Batsman', jersey: '7' }
  ],
  matches: [],
  currentMatch: null
};
db.write();

// SSE clients
let clients = [];

function sendEvent(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => {
    try { res.write(payload); } catch(e) {}
  });
}

app.get('/api/public', (req, res) => {
  db.read();
  res.json({ players: db.data.players, currentMatch: db.data.currentMatch });
});

app.post('/api/admin/addPlayer', (req, res) => {
  const { password, name, age, role, jersey } = req.body;
  if (password !== '1234') return res.status(403).json({ error: 'auth' });
  db.read();
  const p = { id: nanoid(6), name, age, role, jersey };
  db.data.players.push(p);
  db.write();
  sendEvent({ type: 'players_updated' });
  res.json(p);
});

app.post('/api/admin/createMatch', (req, res) => {
  const { password, teamA, teamB, venue, date, overs } = req.body;
  if (password !== '1234') return res.status(403).json({ error: 'auth' });
  db.read();
  const match = {
    id: nanoid(8),
    teamA: teamA || 'Ekta Cricket Club',
    teamB: teamB || 'Opponent',
    venue: venue || '',
    date: date || '',
    overs: overs || 20,
    playingXI: { teamA: [], teamB: [] },
    innings: {
      battingTeam: null,
      runs: 0,
      wickets: 0,
      overs: 0,
      balls: 0,
      ballsLog: []
    },
    status: 'not_started'
  };
  db.data.matches.push(match);
  db.data.currentMatch = match;
  db.write();
  sendEvent({ type: 'match_created', match });
  res.json(match);
});

app.post('/api/admin/setPlayingXI', (req, res) => {
  const { password, team, playerIds } = req.body;
  if (password !== '1234') return res.status(403).json({ error: 'auth' });
  db.read();
  if (!db.data.currentMatch) return res.status(400).json({ error: 'no_match' });
  db.data.currentMatch.playingXI[team] = playerIds;
  db.write();
  sendEvent({ type: 'playingXI', match: db.data.currentMatch });
  res.json(db.data.currentMatch);
});

app.post('/api/admin/startInnings', (req, res) => {
  const { password, battingTeam } = req.body;
  if (password !== '1234') return res.status(403).json({ error: 'auth' });
  db.read();
  const m = db.data.currentMatch;
  if (!m) return res.status(400).json({ error: 'no_match' });
  m.innings = { battingTeam, runs: 0, wickets: 0, overs: 0, balls: 0, ballsLog: [] };
  m.status = 'live';
  db.write();
  sendEvent({ type: 'start_innings', match: m });
  res.json(m);
});

app.post('/api/admin/addBall', (req, res) => {
  const { password, ball } = req.body;
  if (password !== '1234') return res.status(403).json({ error: 'auth' });
  db.read();
  const m = db.data.currentMatch;
  if (!m || m.status !== 'live') return res.status(400).json({ error: 'no_live_match' });

  const extra = ball.extraType || null;
  const entry = {
    id: nanoid(8),
    legal: !(extra === 'wide' || extra === 'no-ball'),
    runs: ball.runs || 0,
    isWicket: !!ball.isWicket,
    extraType: extra || '',
    time: Date.now()
  };

  if (entry.legal) {
    m.innings.runs += entry.runs;
    if (entry.isWicket) m.innings.wickets += 1;
    m.innings.balls += 1;
    if (m.innings.balls >= 6) {
      m.innings.overs += 1;
      m.innings.balls = 0;
    }
  } else {
    m.innings.runs += (entry.runs + 1);
  }
  m.innings.ballsLog.push(entry);
  db.write();
  sendEvent({ type: 'ball', match: m, lastBall: entry });
  res.json(m);
});

// SSE for live updates
app.get('/api/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();
  res.write('retry: 2000\n\n');
  clients.push(res);
  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

app.get('/', (req, res) => {
  res.redirect('/public/index.html');
});

app.listen(PORT, () => {
  console.log('✅ Server started on port', PORT);
});
