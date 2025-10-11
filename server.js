// ------------------------
// 🌐 BlockVault Relay Server — Stable Railway Build
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
// 🪪 Safe UUID generator
// ------------------------
function uuidv4() {
  return crypto.randomUUID();
}

const app = express();
const server = http.createServer(app);

// ------------------------
// 🌍 Allowed origins (Lovable + localhost)
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
// ⚙️ HTTPS redirect (Railway requirement)
// ------------------------
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] === "http") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// ------------------------
// ⚙️ CORS setup
// ------------------------
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// ------------------------
// 📁 File uploads
// ------------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  }
});

const upload = multer({ storage });

// ------------------------
// 🧠 WebSocket server (attached directly to HTTP server)
// ------------------------
const wss = new WebSocket.Server({ server });
const clients = new Map();

wss.on("connection", (ws, req) => {
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
      console.error("❌ Message error:", err);
    }
  });

  ws.on("close", () => {
    if (clientId) {
      clients.delete(clientId);
      console.log(`🔴 Disconnected: ${clientId}`);
    }
  });
});

// ------------------------
// 📤 File upload endpoint
// ------------------------
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  console.log("✅ Uploaded:", fileUrl);
  res.json({ url: fileUrl });
});

// Serve static uploads
app.use("/uploads", express.static(uploadDir));

// ------------------------
// 🚀 Start server
// ------------------------
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 BlockVault Relay running on port ${PORT}`);
});
