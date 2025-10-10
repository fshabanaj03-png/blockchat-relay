// server.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Config ----------
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// IMPORTANT: set your public base URL (Railway URL or your custom domain)
const RELAY_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  "https://blockchat-relay-production.up.railway.app";

// Allow only your frontends to call this server
const allowedOrigins = [
  "https://preview--block-vault-chat.lovable.app",
  "https://block-vault-chat.lovable.app",
  "https://preview--blockvault-chat.lovable.app", // safety alias
  "https://blockvault-chat.lovable.app",           // safety alias
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());

// ---------- Static uploads ----------
const uploadsDir = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

// ---------- Health ----------
app.get("/", (_req, res) => {
  res.send("✅ BlockVault Relay is live and stable!");
});

// ---------- Multer storage for uploads ----------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${Date.now()}_${uuidv4()}${ext || ""}`);
  },
});
const upload = multer({ storage });

// Upload endpoint (returns absolute HTTPS URL)
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const fileUrl = `${RELAY_BASE_URL}/uploads/${req.file.filename}`;
  return res.json({ url: fileUrl, name: req.file.originalname });
});

// ---------- WebSocket relay ----------
const clients = new Map(); // id -> ws

const sendToClient = (id, payload) => {
  const ws = clients.get(id);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
    console.log(`[RELAY] Sent ${payload.type} → ${id}`);
  } else {
    console.log(`[RELAY] Client ${id} not found or not open`);
  }
};

wss.on("connection", (ws) => {
  console.log("✅ New client connected");
  let myId = null;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      switch (data.type) {
        case "register": {
          myId = data.id;
          clients.set(myId, ws);
          console.log(`🟢 Registered client: ${myId}`);
          ws.send(JSON.stringify({ type: "registered", id: myId }));
          break;
        }

        // Chat
        case "message": {
          sendToClient(data.to, data);
          break;
        }

        // Call signaling
        case "call-request":
        case "call-accept":
        case "call-decline":
        case "call-offer":
        case "call-answer":
        case "sdp-offer":
        case "sdp-answer":
        case "ice-candidate":
        case "call-end": {
          if (!data.callId) data.callId = uuidv4();
          sendToClient(data.to, data);
          console.log(`[CALL] ${data.type} (${data.callId}) ${data.from} → ${data.to}`);
          break;
        }

        // Optional
        case "presence":
        case "ack": {
          console.log(`[RELAY] ${data.type} from ${data.from}`);
          break;
        }

        default:
          console.log(`⚠️ Unknown message type: ${data.type}`);
      }
    } catch (err) {
      console.error("❌ Failed to parse message:", err);
    }
  });

  ws.on("close", () => {
    if (myId) {
      clients.delete(myId);
      console.log(`🔴 Client disconnected: ${myId}`);
    }
  });
});

// ---------- Start ----------
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 BlockVault Relay running on port ${PORT}`);
});
