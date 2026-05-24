import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
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
