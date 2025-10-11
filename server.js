// ------------------------
// 🌐 BlockVault Relay Server (Final Version)
// ------------------------
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const crypto = require("crypto");

// ------------------------
// 🪪 Generate UUID safely
// ------------------------
function uuidv4() {
  return crypto.randomUUID();
}

const app = express();
const server = http.createServer(app);

// ------------------------
// 🌍 Allowed Origins (Includes all Lovable URLs + local)
// ------------------------
const allowedOrigins = [
  "https://preview--block-vault-chat.lovable.app",
  "https://block-vault-chat.lovable.app",
  "https://block-vault-chat.lovable.dev",
  "https://lovable.dev",
  "https://preview.lovable.dev",
  "http://localhost:5173",
  "http://localhost:3000"
];

// ------------------------
// 🧩 Force HTTPS for WSS (required by Lovable + Railway)
// ------------------------
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] === "http") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// ------------------------
// ⚙️ CORS Configuration
// ------------------------
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.use(cors({ origin: allowedOrigins }));

// ------------------------
// 📁 Upload Directory Setup
// ------------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer setup for file uploads (images, videos, audio)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    const uniqueName = `${Date.now()}_${safeName}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// ------------------------
// 🧠 WebSocket Server Setup
// ------------------------
const wss = new WebSocket.Server({ noServer: true });
const clients = new Map();

// ✅ Add headers to WebSocket handshake for CORS
wss.on("headers", (headers, req) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    headers.push(`Access-Control-Allow-Origin: ${origin}`);
    headers.push("Access-Control-Allow-Credentials: true");
  }
});

// 🧩 Handle WebSocket connections
wss.on("connection", (ws, req) => {
  console.log("🔗 New WebSocket client connected");

  let clientId = null;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      // Register new client
      if (data.type === "register" && data.id) {
        clientId = data.id;
        clients.set(clientId, ws);
        console.log(`✅ Registered client: ${clientId}`);
        return;
      }

      // Relay messages between users
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
// 🔄 WebSocket Upgrade Handler (for WSS CORS Safety)
// ------------------------
server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

// ------------------------
// 📤 File Upload Endpoint
// ------------------------
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  console.log("✅ File uploaded:", fileUrl);
  res.json({ url: fileUrl });
});

// Serve uploaded files
app.use("/uploads", express.static(uploadDir));

// ------------------------
// 🚀 Start Relay Server
// ------------------------
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 BlockVault Relay running on port ${PORT}`);
});
