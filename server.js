// server.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import cors from "cors";

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Health check
app.get("/", (req, res) => {
  res.send("✅ BlockVault Relay is running");
});

// HTTP + WS server
const server = http.createServer(app);

// ✅ Allowable frontend origins
const allowedOrigins = [
  "https://preview--block-vault-chat.lovable.app",
  "https://block-vault-chat.lovable.app",
  "https://lovable.app",
  "https://lovable.dev",
  "https://preview.lovable.dev",
  "https://*.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000"
];

// ✅ Create WebSocket Server with origin verification
const wss = new WebSocketServer({
  server,
  verifyClient: (info, done) => {
    const origin = info.origin;
    console.log("🌍 Incoming WS origin:", origin);

    // Allow if origin is null (sometimes from browser extensions) or matches allowed list
    if (
      !origin ||
      allowedOrigins.some(o => origin.includes(o.replace("https://", "")))
    ) {
      done(true);
    } else {
      console.log("🚫 Rejected WebSocket from:", origin);
      done(false, 403, "Forbidden");
    }
  }
});

// ✅ Track clients
const clients = new Map();

wss.on("connection", (ws) => {
  console.log("🔗 WebSocket client connected");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      // ✅ Register user
      if (data.type === "register") {
        clients.set(data.address, ws);
        console.log(`🟢 Registered client: ${data.address}`);
        return;
      }

      // ✅ Handle messages between users
      if (data.type === "message" && data.to) {
        const receiver = clients.get(data.to);
        if (receiver && receiver.readyState === receiver.OPEN) {
          receiver.send(JSON.stringify(data));
          console.log(`📨 Message from ${data.from} to ${data.to}`);
        } else {
          console.log(`⚠️ Receiver ${data.to} not connected`);
        }
        return;
      }

      // ✅ Handle call events (offer, answer, ice)
      if (["call-offer", "call-answer", "ice-candidate"].includes(data.type)) {
        const receiver = clients.get(data.to);
        if (receiver && receiver.readyState === receiver.OPEN) {
          receiver.send(JSON.stringify(data));
          console.log(`📞 ${data.type} sent from ${data.from} to ${data.to}`);
        } else {
          console.log(`⚠️ Call target ${data.to} not connected`);
        }
      }
    } catch (err) {
      console.error("❌ Error handling message:", err);
    }
  });

  ws.on("close", () => {
    for (const [address, socket] of clients.entries()) {
      if (socket === ws) {
        clients.delete(address);
        console.log(`🔴 Disconnected: ${address}`);
        break;
      }
    }
  });

  ws.on("error", (err) => {
    console.error("⚡ WebSocket error:", err);
  });
});

// ✅ Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 BlockVault Relay running on port ${PORT}`);
});
