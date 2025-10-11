// ------------------------
// 🌐 BlockVault Relay Server
// ------------------------
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const crypto = require("crypto");

// Fallback uuid generator
function uuidv4() {
  return crypto.randomUUID();
}

const app = express();
const server = http.createServer(app);

// ------------------------
// ✅ CORS Configuration
// ------------------------
const allowedOrigins = [
  "https://preview--block-vault-chat.lovable.app",
  "https://block-vault-chat.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.use(cors({ origin: allowedOrigins }));

// ------------------------
// 📁 Uploads Configuration
// ------------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// ------------------------
// 🧩 WebSocket Setup
// ------------------------
const wss = new WebSocket.Server({ server, path: "/", perMessageDeflate: false });
const clients = new Map();

wss.on("headers", (headers, req) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    headers.push(`Access-Control-Allow-Origin: ${origin}`);
  }
});

wss.on("connection", (ws) => {
  console.log("🔗 New WebSocket client connected");

  let clientId = null;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "register" && data.id) {
        clientId = data.id;
        clients.set(clientId, ws);
        console.log(`✅ Registered client: ${clientId}`);
        return;
      }

      if (data.to && clients.has(data.to)) {
        const target = clients.get(data.to);
        target.send(JSON.stringify(data));
        console.log(`📨 ${data.type} from ${data.from} → ${data.to}`);
      }
    } catch (err) {
      console.error("❌ Failed to parse message:", err);
    }
  });

  ws.on("close", () => {
    if (clientId) {
      clients.delete(clientId);
      console.log(`🔴 Client disconnected: ${clientId}`);
    }
  });
});

// ------------------------
// 📤 Upload Endpoint
// ------------------------
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  console.log("✅ File uploaded:", fileUrl);
  res.json({ url: fileUrl });
});

app.use("/uploads", express.static(uploadDir));

// ------------------------
// 🚀 Start Server
// ------------------------
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`🚀 BlockVault Relay running on port ${PORT}`));
