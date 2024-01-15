const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const latestSTT = require("./models/schema");

// Connect with MongoDB
require("./database/connect");

// Express Server with Websocket connection
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

// Deepgram client
const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY);
let keepAlive;

// Setup Deepgram
const setupDeepgram = (ws) => {
  const deepgram = deepgramClient.listen.live({
    language: "en",
    punctuate: true,
    smart_format: true,
    model: "nova-2",
  });

  if (keepAlive) clearInterval(keepAlive);
  keepAlive = setInterval(() => {
    deepgram.keepAlive();
    console.log({ deepgram: "alive" });
  }, 10 * 1000);

  deepgram.addListener(LiveTranscriptionEvents.Open, async () => {
    console.log({ deepgram: "connection established" });

    deepgram.addListener(LiveTranscriptionEvents.Transcript, async (data) => {
      console.log({ deepgram: "packet received" });
      console.log({ deepgram: "transcript received" });
      ws.send(JSON.stringify(data));
      console.log({ socket: "transcript sent to client" });

      // Save the data to MongoDB
      if(data.channel.alternatives[0].transcript) {
        const newSTT = new latestSTT({
          normalText: data.channel.alternatives[0].transcript,
          confidenceScore: data.channel.alternatives[0].confidence
        })
        newSTT.save();
        console.log({ database: "data saved to db" });
      }
    });
  });

  deepgram.addListener(LiveTranscriptionEvents.Close, async () => {
    clearInterval(keepAlive);
    deepgram.finish();
    console.log({ deepgram: "disconnected" });
  });

  deepgram.addListener(LiveTranscriptionEvents.Error, async (err) => {
    console.log({ deepgram: "error occured" });
    console.log(err);
  });

  deepgram.addListener(LiveTranscriptionEvents.Warning, async (warning) => {
    console.log({ deepgram: "warning present" });
    console.log(warning);
  });

  deepgram.addListener(LiveTranscriptionEvents.Metadata, async (data) => {
    console.log({ deepgram: "packet received" });
    console.log({ deepgram: "metadata received" });
    console.log({ ws: "metadata sent to client" });
    ws.send(JSON.stringify({ metadata: data }));
  });

  return deepgram;
};

// Handle websocket
wss.on("connection", (ws) => {
  console.log({ socket: "connection established" });
  let deepgram = setupDeepgram(ws);

  ws.on("message", (message) => {
    console.log({ socket: "client data received" });
    if (deepgram.getReadyState() === 1) {
      console.log({ socket: "data sent to deepgram" });
      deepgram.send(message);
    } else if (deepgram.getReadyState() >= 2) {
      console.log({ socket: "data couldn't be sent to deepgram" });
      console.log({ socket: "retrying connection to deepgram" });

      deepgram.finish();
      deepgram.removeAllListeners();
      deepgram = setupDeepgram(socket);
    } else {
      console.log({ socket: "data couldn't be sent to deepgram" });
    }
  });

  ws.on("close", () => {
    console.log({ socket: "client disconnected" });
    deepgram.finish();
    deepgram.removeAllListeners();
    deepgram = null;
  });
});

// Routes
app.use(express.static("public/"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "./public/index.html");
});

// Start server
server.listen(PORT, () => {
  console.log("Server is listening on port", PORT);
});
