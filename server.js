const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

const clients = new Map();

wss.on("connection", (ws) => {
  let myId = null;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "register") {
        myId = data.from;
        clients.set(myId, ws);
      }

      if (data.type === "message") {
        const toSocket = clients.get(data.to);
        if (toSocket && toSocket.readyState === WebSocket.OPEN) {
          toSocket.send(JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error("Failed to parse message", err);
    }
  });

  ws.on("close", () => {
    if (myId) clients.delete(myId);
  });
});
