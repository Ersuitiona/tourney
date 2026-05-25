import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Setup file-backed state storage for tournament persistence
const STORE_PATH = path.join(process.cwd(), "tournament_store.json");
let tournamentStateMemory: any = null;

function loadStateFromDisk() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, "utf8");
      tournamentStateMemory = JSON.parse(data);
      console.log("Successfully loaded tournament state from disk persistence.");
    }
  } catch (err) {
    console.error("Failed to load tournament state from disk:", err);
  }
}

function saveStateToDisk(state: any) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf8");
    console.log("Successfully synced tournament state to disk persistence.");
  } catch (err) {
    console.error("Failed to save tournament state to disk:", err);
  }
}

// Initial state load
loadStateFromDisk();

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Tournament State Sync Endpoints
app.get("/api/tournament", (req, res) => {
  res.json(tournamentStateMemory || {});
});

app.post("/api/tournament", (req, res) => {
  tournamentStateMemory = req.body;
  saveStateToDisk(tournamentStateMemory);
  res.json({ success: true, message: "Tournament saved on server." });
});

app.post("/api/tournament/reset", (req, res) => {
  tournamentStateMemory = null;
  try {
    if (fs.existsSync(STORE_PATH)) {
      fs.unlinkSync(STORE_PATH);
      console.log("Cleaned up tournament store file.");
    }
  } catch (err) {
    console.error("Failed to delete tournament store file:", err);
  }
  res.json({ success: true, message: "Tournament reset successfully on server." });
});

// Endpoint: AI-based fixture scheduling
app.post("/api/generate-fixtures", async (req, res) => {
  const { clubs, groups, options } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({ error: "No Gemini API key configured in env. Please use standard scheduling." });
  }

  try {
    const prompt = `
      You are an expert sports league tournament scheduler.
      You are given:
      1. Clubs list: ${JSON.stringify(clubs)}
      2. Groups layout: ${JSON.stringify(groups)}
      3. Generation options: ${JSON.stringify(options)}

      Your task is to schedule a professional, balanced group-stage tournament schedule.
      CRITICAL RULE: A club must play AT MOST ONCE on any given Matchday. You must spread the matches across multiple Matchdays so that clubs also have sufficient rest and never play twice on the same Matchday.
      
      Generate a complete list of Matchdays, each having a unique label (e.g. "Matchday 1: Opening Clashes", "Matchday 2: Group Rivalries") and a list of matched fixtures.
      Each match object must have:
      - id: generate a unique random string (e.g. "match_xx")
      - type: "within" or "between"
      - groupId: the ID of the group the match belongs to
      - homeId: the actual club ID of the host team
      - awayId: the actual club ID of the visitor team
      - homeScore: 0
      - awayScore: 0
      - status: "scheduled"
      - round: integer round index
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional football match fixtures scheduler. Organize logical, mathematically isolated matchdays where no team has overlapping games on the same matchday.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of matchdays, where each matches belongs to a clean round.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING, description: "Theme label for the matchday, e.g. Matchday 1: Derby Clashes" },
              matches: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING },
                    groupId: { type: Type.STRING },
                    homeId: { type: Type.STRING },
                    awayId: { type: Type.STRING },
                    homeScore: { type: Type.INTEGER },
                    awayScore: { type: Type.INTEGER },
                    status: { type: Type.STRING },
                    round: { type: Type.INTEGER }
                  },
                  required: ["id", "type", "groupId", "homeId", "awayId", "homeScore", "awayScore", "status", "round"]
                }
              }
            },
            required: ["id", "label", "matches"]
          }
        }
      }
    });

    const jsonText = response.text || "[]";
    const matchdays = JSON.parse(jsonText.trim());
    return res.json({ matchdays });
  } catch (error: any) {
    console.error("Gemini Fixture Generation failed:", error);
    return res.status(500).json({ error: error.message || "Failed to generate AI schedule." });
  }
});

// Endpoint: AI-based bulk data match results parser
app.post("/api/parse-bulk-scores", async (req, res) => {
  const { text, clubs } = req.body;
  if (!text || !text.trim()) {
    return res.json({ matches: [] });
  }

  try {
    const prompt = `
      You are an expert sports scores transcriber. 
      You are given a raw text input containing a list of match results, and a reference list of registered Club/Team names.
      Your goal is to parse the scores and align the team names with the names of the registered Clubs provided.

      Registered Clubs reference list:
      ${JSON.stringify((clubs || []).map((c: any) => c.name))}

      User's input:
      "${text}"

      Identify each match result mentioned in the text.
      For each match result, return:
      - homeTeamName: Must match or be the closest registered club name. (e.g. if the user says "Madrid", and "Real Madrid" is in the clubs list, use "Real Madrid").
      - awayTeamName: Must match or be the closest registered club name.
      - homeScore: Int score of the home or first team.
      - awayScore: Int score of the away or second team.

      If a line does not specify score or is not a match, ignore it.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an automated machine parser. Convert unstructured text of match scores into beautiful, precise structured data matching the exact registered sports club names.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  homeTeamName: { type: Type.STRING },
                  awayTeamName: { type: Type.STRING },
                  homeScore: { type: Type.INTEGER },
                  awayScore: { type: Type.INTEGER }
                },
                required: ["homeTeamName", "awayTeamName", "homeScore", "awayScore"]
              }
            }
          },
          required: ["matches"]
        }
      }
    });

    const parsed = JSON.parse((response.text || "{}").trim());
    res.json(parsed);
  } catch (err: any) {
    console.error("Failed to parse scores via Gemini:", err);
    res.status(500).json({ error: err.message || "Failed to parse bulk data." });
  }
});

// Serve PWA manifest
app.get("/manifest.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json({
    short_name: "Arena Organizer",
    name: "Tournament Organizer Arena",
    description: "Manage professional tournaments, automatic fixtures, real-time standings, brackets, and AI bulk match scoring.",
    icons: [
      {
        src: "https://img.icons8.com/isometric/512/stadium.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "any maskable"
      },
      {
        src: "https://img.icons8.com/isometric/256/stadium.png",
        type: "image/png",
        sizes: "256x256",
        purpose: "any"
      }
    ],
    start_url: "/",
    background_color: "#020617",
    theme_color: "#6366f1",
    display: "standalone",
    orientation: "portrait"
  });
});

// Serve PWA service worker
app.get("/sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.send(`
    self.addEventListener('install', (e) => {
      self.skipWaiting();
    });
    self.addEventListener('activate', (e) => {
      e.waitUntil(clients.claim());
    });
    self.addEventListener('fetch', (e) => {
      // passthrough fetching
    });
  `);
});

// Configure Vite middleware in development or serve static in production
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running on http://localhost:${PORT}`);
  });
}

setupVite();
