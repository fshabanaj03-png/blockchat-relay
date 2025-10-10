import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Map();

// ─────────────── CORS (Allow all for now) ───────────────
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

// ─────────────── Upload folder setup ───────────────
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}_${file.originalname}`;
    cb(null, unique);
  },
});

const upload = multer({ storage });

// ─────────────── Health Check ───────────────
app.get("/", (req, res) => {
  res.send("✅ BlockVault Relay is live and stable!");
});

// ─────────────── Upload Endpoint ───────────────
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const fileUrl = `https://blockchat-relay-production.up.railway.app/uploads/${req.file.filename}`;
  console.log(`📸 File uploaded: ${fileUrl}`);
  res.json({ url: fileUrl });
});

// Serve uploaded files statically
app.use("/uploads", express.static(uploadDir));

// ─────────────── Helper ───────────────
const sendToClient = (id, payload) => {
  const ws = clients.get(id);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
    console.log(`[RELAY] Sent ${payload.type} → ${id}`);
  } else {
    console.log(`[RELAY] Client ${id} not found or not open`);
  }
};

// ─────────────── WebSocket Handling ───────────────
wss.on("connection", (ws) => {
  console.log("✅ New client connected");
  let myId = null;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      switch (data.type) {
        case "register":
          myId = data.id;
          clients.set(myId, ws);
          console.log(`🟢 Registered client: ${myId}`);
          ws.send(JSON.stringify({ type: "registered", id: myId }));
          break;

        case "message":
          sendToClient(data.to, data);
          break;

        case "call-offer":
        case "call-answer":
        case "ice-candidate":
        case "call-end":
        case "call-request":
        case "call-accept":
        case "call-decline":
        case "sdp-offer":
        case "sdp-answer":
          if (!data.callId) data.callId = uuidv4();
          sendToClient(data.to, data);
          console.log(`[CALL] ${data.type} (${data.callId}) from ${data.from} → ${data.to}`);
          break;

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

// ─────────────── Start Server ───────────────
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 BlockVault Relay running on port ${PORT}`);
});
