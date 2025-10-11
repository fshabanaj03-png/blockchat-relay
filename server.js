// ------------------------
// 🌐 BlockVault Relay Server (Final — Stable for Lovable + Railway)
// ------------------------
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

// ------------------------
// 🧠 Helper: UUID
// ------------------------
function uuidv4() {
  return crypto.randomUUID();
}

// ------------------------
// 🌍 Allowed Origins
// ------------------------
const allowedOrigins = [
  "https://preview--block-vault-chat.lovable.app",
  "https://block-vault-chat.lovable.app",
  "https://block-vault-chat.lovable.dev",
  "https://lovable.dev",
  "https://preview.lovable.dev",
  "https://lovable.app",
  "http://localhost:5173",
  "http://localhost:3000"
];

// ------------------------
// ⚙️ Trust Proxy + HTTPS Redirect (Railway)
/// ------------------------
app.enable("trust proxy");
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] === "http") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// ------------------------
// 🧩 CORS Setup
// ------------------------
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ Blocked CORS origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// ------------------------
// 📁 File Uploads
// ------------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const upload = multer({ storage });

// ------------------------
// ⚡ WebSocket Server
// ------------------------
const wss = new WebSocket.Server({
  server,
  verifyClient: (info, done) => {
    const origin = info.origin;
    if (!origin || allowedOrigins.includes(origin)) {
      done(true);
    } else {
      console.warn("🚫 Rejected WebSocket from:", origin);
      done(false, 403, "Forbidden");
    }
  },
});

const clients = new Map();

wss.on("connection", (ws, req) => {
  console.log("🔗 WebSocket client connected");

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
        clients.get(data.to).send(JSON.stringify(data));
        console.log(`📨 ${data.type} from ${data.from} → ${data.to}`);
      }
    } catch (err) {
      console.error("❌ Message error:", err);
    }
  });

  ws.on("close", () => {
    if (clientId) clients.delete(clientId);
    console.log(`🔴 Client disconnected: ${clientId}`);
  });

  ws.on("error", (err) => {
    console.error("⚠️ WebSocket error:", err.message);
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

// Serve files
app.use("/uploads", express.static(uploadDir));

// ------------------------
// 🚀 Start Server
// ------------------------
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 BlockVault Relay live on port ${PORT}`);
});
