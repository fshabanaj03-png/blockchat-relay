import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Map();

// Health check endpoint for Railway
app.get("/", (req, res) => {
  res.send("✅ BlockVault Relay is live and stable!");
});

// Broadcast helper
const sendToClient = (id, payload) => {
  const ws = clients.get(id);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
    console.log(`[RELAY] Sent ${payload.type} → ${id}`);
  } else {
    console.log(`[RELAY] Client ${id} not found or not open`);
  }
};

wss.on("connection", (ws) => {
  console.log("✅ New client connected");
  let myId = null;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      switch (data.type) {
        // ─────────────── Register Client ───────────────
        case "register":
          myId = data.id;
          clients.set(myId, ws);
          console.log(`🟢 Registered client: ${myId}`);
          ws.send(JSON.stringify({ type: "registered", id: myId }));
          break;

        // ─────────────── Chat Message ───────────────
        case "message":
          sendToClient(data.to, data);
          break;

        // ─────────────── Call Signaling ───────────────
        case "call-offer":
        case "call-answer":
        case "ice-candidate":
        case "call-end":
        case "call-request":
        case "call-accept":
        case "call-decline":
        case "sdp-offer":
        case "sdp-answer":
          if (!data.callId) data.callId = uuidv4(); // Ensure callId
          sendToClient(data.to, data);
          console.log(`[CALL] ${data.type} (${data.callId}) from ${data.from} → ${data.to}`);
          break;

        // ─────────────── Presence ───────────────
        case "presence":
          // Optional: ignore or handle later
          console.log(`[RELAY] Presence update from ${data.from}`);
          break;

        // ─────────────── Acknowledgments ───────────────
        case "ack":
          console.log(`[RELAY] ACK from ${data.from} for ${data.callId || "unknown call"}`);
          break;

        // ─────────────── Unknown ───────────────
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
