// server.js
import express from "express";
import cors from "cors";
import { Low } from "lowdb";
import { JSONFilePreset } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Database setup (auto creates db.json if not exists)
const db = await JSONFilePreset("db.json", { matches: [] });

// Serve static frontend files (inside /public folder)
app.use(express.static(path.join(__dirname, "public")));

// Get all matches
app.get("/api/matches", async (req, res) => {
  res.json(db.data.matches);
});

// Add new match
app.post("/api/matches", async (req, res) => {
  db.data.matches.push(req.body);
  await db.write();
  res.json({ success: true });
});

// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
