const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  })
);

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders: (res, filePath) => {
      if (path.extname(filePath) === ".wasm") {
        res.setHeader("Content-Type", "application/wasm");
      }
    },
  })
);

let selectedDocument = "";

io.on("connection", (socket) => {
  console.log("A user connected");

  if (selectedDocument) {
    socket.emit("documentSelected", { fileUrl: selectedDocument });
  }

  socket.on("documentSelected", ({ fileUrl }) => {
    selectedDocument = fileUrl;
    io.emit("documentSelected", { fileUrl });
  });

  socket.on("annotationUpdate", (data) => {
    console.log(`✅ Annotation from ${data.userRole}:`, data.xfdfString);
    
    // Send annotation update to ALL other users except the sender
    socket.broadcast.emit("annotationUpdate", data);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

server.listen(3001, () => {
  console.log("Server is running on http://localhost:3001");
});
