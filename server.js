// ✅ BlockVault Relay Server - CommonJS version for Railway
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ─────────────── Express Setup ───────────────
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: [
      "https://preview--block-vault-chat.lovable.app",
      "https://block-vault-chat.lovable.app",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// ─────────────── File Upload Setup ───────────────
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Serve uploaded files statically
app.use("/uploads", express.static(uploadDir));

const BASE_URL =
  process.env.PUBLIC_URL || "https://blockchat-relay-production.up.railway.app";

// POST /upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = `${BASE_URL}/uploads/${req.file.filename}`;
  console.log(
    `✅ File uploaded: ${req.file.filename} (${(req.file.size / 1024).toFixed(
      2
    )} KB)`
  );

  res.json({
    url: fileUrl,
    mime: req.file.mimetype,
    size: req.file.size,
  });
});

// ─────────────── HTTP + WebSocket Setup ───────────────
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Keep track of connected clients
const clients = new Map(); // addressLower -> ws

wss.on("connection", (ws, req) => {
  console.log("🌐 New WebSocket connection from:", req.headers.origin);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);

      // ───────── Register Client ─────────
      if (msg.type === "register" && msg.address) {
        const addr = msg.address.toLowerCase();
        clients.set(addr, ws);
        ws.send(JSON.stringify({ type: "ack", address: msg.address }));
        console.log(`✅ Registered: ${msg.address}`);
        return;
      }

      // ───────── Text / Media Messages ─────────
      if (msg.type === "message" && msg.to) {
        const peer = clients.get(String(msg.to).toLowerCase());
        if (peer && peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify(msg));
          console.log(`📨 Message forwarded to ${msg.to}`);
        } else {
          console.warn(`⚠️ Recipient not connected: ${msg.to}`);
        }
        return;
      }

      // ───────── Call, Status, Typing, Presence ─────────
      if (
        /^(call-|sdp-|ice-|message-status|presence|typing)$/.test(msg.type) &&
        msg.to
      ) {
        const peer = clients.get(String(msg.to).toLowerCase());
        if (peer && peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify(msg));
          console.log(`📡 ${msg.type} forwarded to ${msg.to}`);
        } else {
          console.warn(`⚠️ ${msg.type} recipient not connected: ${msg.to}`);
        }
      }
    } catch (err) {
      console.error("💥 Error parsing WebSocket message:", err);
    }
  });

  ws.on("close", () => {
    for (const [k, v] of clients) if (v === ws) clients.delete(k);
    console.log(`🔌 Disconnected: ${ws.walletAddress || "Unknown client"}`);
  });
});

// ─────────────── Health Check ───────────────
app.get("/", (req, res) => {
  res.send("✅ BlockVault Relay is live and stable!");
});

// ─────────────── Start Server ───────────────
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 BlockVault Relay running on port ${PORT}`);
});
