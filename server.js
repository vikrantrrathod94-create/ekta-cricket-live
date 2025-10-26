// server.js
import express from "express";
import cors from "cors";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Setup database (db.json)
const file = path.join(__dirname, "db.json");
const adapter = new JSONFile(file);
const db = new Low(adapter, { matches: [] });

// Read DB on start
await db.read();
db.data ||= { matches: [] };

// Serve public folder (frontend)
app.use(express.static(path.join(__dirname, "public")));

// API endpoints
app.get("/api/matches", async (req, res) => {
  res.json(db.data.matches);
});

app.post("/api/matches", async (req, res) => {
  db.data.matches.push(req.body);
  await db.write();
  res.json({ success: true });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
