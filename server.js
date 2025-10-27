import express from "express";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = path.join(__dirname, "db.json");

const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

const app = express();
app.use(express.json());

// ✅ Fix: Initialize data if empty
await db.read();
db.data ||= { matches: [], players: [], teams: [], liveScore: { teamA: "", teamB: "", scoreA: "", scoreB: "", overs: "" } };
await db.write();

app.get("/", (req, res) => {
  res.send("Server running successfully!");
});

app.listen(10000, () => console.log("✅ Server running on port 10000"));
