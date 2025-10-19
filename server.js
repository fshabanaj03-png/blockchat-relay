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
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
});

// POST /upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const BASE_URL =
    process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
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

// Serve uploaded files statically
app.use("/uploads", express.static(uploadDir));

// ─────────────── HTTP + WebSocket Setup ───────────────
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store active clients (wallet -> WebSocket)
const clients = new Map();

wss.on("connection", (ws, req) => {
  console.log("🌐 New WebSocket connection from:", req.headers.origin);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);

      // ───────── Register Client ─────────
      if (msg.type === "register" && msg.address) {
        const addr = msg.address.toLowerCase();
        clients.set(addr, ws);
        ws.walletAddress = addr;
        ws.send(JSON.stringify({ type: "ack", address: msg.address }));
        console.log(`✅ Registered: ${msg.address}`);
        return;
      }

      // ───────── Forward Messages, Calls, and Events ─────────
      if (msg.to) {
        const targetAddr = String(msg.to).toLowerCase();
        const peer = clients.get(targetAddr);

        if (peer && peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify(msg));
          console.log(`📡 Forwarded ${msg.type} → ${targetAddr}`);
        } else {
          console.warn(`⚠️ Recipient not connected: ${msg.to}`);
        }
      }
    } catch (err) {
      console.error("💥 Error parsing message:", err);
    }
  });

  ws.on("close", () => {
    if (ws.walletAddress) {
      clients.delete(ws.walletAddress);
      console.log(`🔌 Disconnected: ${ws.walletAddress}`);
    }
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
