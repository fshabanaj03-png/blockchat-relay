// 🌐 FINAL BlockVault Relay Server — HTTPS/WSS-ready for Railway
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const express = require("express");
const WebSocket = require("ws");
const multer = require("multer");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.enable("trust proxy");

// 🧩 Generate unique IDs
function uuidv4() {
  return crypto.randomUUID();
}

// ✅ Allow Lovable + local origins
const allowedOrigins = [
  "https://preview--block-vault-chat.lovable.app",
  "https://block-vault-chat.lovable.app",
  "https://lovable.dev",
  "https://preview.lovable.dev",
  "http://localhost:5173",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else {
        console.log("❌ Blocked CORS origin:", origin);
        cb(new Error("CORS not allowed"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// 🧠 Redirect HTTP → HTTPS
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] === "http") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// 📂 File uploads
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  },
});
const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  console.log("✅ File uploaded:", fileUrl);
  res.json({ url: fileUrl });
});
app.use("/uploads", express.static(uploadDir));

// 🧩 HTTP(S) server (Railway auto-SSL)
const server = http.createServer(app);
const wss = new WebSocket.Server({
  server,
  verifyClient: (info, done) => {
    const origin = info.origin;
    if (!origin || allowedOrigins.includes(origin)) done(true);
    else {
      console.log("🚫 Rejected WebSocket from:", origin);
      done(false, 403, "Forbidden");
    }
  },
});

const clients = new Map();

wss.on("connection", (ws) => {
  console.log("🔗 WebSocket client connected");
  let id = null;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "register") {
        id = data.id;
        clients.set(id, ws);
        console.log(`✅ Registered client: ${id}`);
      } else if (data.to && clients.has(data.to)) {
        clients.get(data.to).send(JSON.stringify(data));
        console.log(`📨 ${data.type} from ${data.from} → ${data.to}`);
      }
    } catch (err) {
      console.error("❌ Parse error:", err);
    }
  });

  ws.on("close", () => {
    if (id) clients.delete(id);
    console.log(`🔴 Disconnected: ${id}`);
  });

  ws.on("error", (err) => {
    console.error("⚠️ WebSocket error:", err.message);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Relay running on port ${PORT}`);
});
