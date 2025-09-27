import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

// Map to store connected clients
const clients = new Map();

// Health check endpoint for Railway
app.get("/", (req, res) => {
  res.send("✅ Blockchat relay is running!");
});

wss.on("connection", (ws) => {
  console.log("✅ New client connected");

  let myId = null;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      switch (data.type) {
        case "register":
          myId = data.id;
          clients.set(myId, ws);
          console.log(`🟢 Registered client: ${myId}`);

          ws.send(JSON.stringify({ type: "registered", id: myId }));
          break;

        case "message":
        case "call-request":
        case "call-accept":
        case "call-decline":
        case "sdp-offer":
        case "sdp-answer":
        case "ice-candidate":
          const recipient = clients.get(data.to);
          if (recipient) {
            recipient.send(JSON.stringify(data));
            console.log(
              `📨 Relayed ${data.type} from ${data.from} to ${data.to}`
            );
          }
          break;

        default:
          console.log("⚠️ Unknown message type:", data.type);
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

// Use Railway port or fallback
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Relay running on port ${PORT}`);
});
