import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors({
  origin: [
    "https://preview--block-vault-chat.lovable.app",
    "https://block-vault-chat.lovable.app",
    "http://localhost:5173"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

// ---- Multer setup for file uploads ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
});

// Create /uploads folder if not exists
import fs from "fs";
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

// POST /upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  console.log(`✅ File uploaded: ${req.file.filename} (${(req.file.size / 1024).toFixed(2)} KB)`);

  res.json({
    url: fileUrl,
    mime: req.file.mimetype,
    size: req.file.size,
  });
});

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---- WebSocket setup ----
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  console.log("🌐 New WebSocket connection from:", req.headers.origin);

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);

      // Handle registration
      if (message.type === "register") {
        ws.walletAddress = message.address;
        ws.send(JSON.stringify({ type: "ack", address: message.address }));
        console.log(`✅ Registered: ${message.address?.slice(0, 10)}...`);
        return;
      }

      // Forward messages to recipient
      if (message.to) {
        console.log(`📨 Forwarding ${message.type} from ${message.from?.slice(0, 10)}... to ${message.to?.slice(0, 10)}...`);

        let delivered = false;

        wss.clients.forEach((client) => {
          if (
            client.walletAddress?.toLowerCase() === message.to.toLowerCase() &&
            client.readyState === WebSocket.OPEN
          ) {
            client.send(JSON.stringify(message));
            delivered = true;
            console.log(`✅ Delivered to ${message.to.slice(0, 10)}...`);
          }
        });

        if (!delivered) {
          console.warn(`⚠️ Recipient not connected: ${message.to}`);
        }
      }
    } catch (err) {
      console.error("💥 Error parsing WebSocket message:", err);
    }
  });

  ws.on("close", () => {
    console.log("🔌 Disconnected:", ws.walletAddress);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 BlockVault Relay running on port ${PORT}`);
});
