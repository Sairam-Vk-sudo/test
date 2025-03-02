const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

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

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const rooms = {}; // Stores roomId -> { fileUrl, annotations, masterId }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Create Room (Host Only)
  socket.on("createRoom", () => {
    const roomId = uuidv4();
    rooms[roomId] = { fileUrl: "", annotations: "", masterId: socket.id };
    socket.join(roomId);
    console.log(`✅ Room ${roomId} created by ${socket.id}`);
    socket.emit("roomCreated", { roomId });
  });

  // Join Room (Auto as Sub)
  socket.on("joinRoom", (roomId) => {
    if (rooms[roomId]) {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId} as sub`);
      
      // 🔥 Send document & existing annotations **immediately**
      socket.emit("documentSelected", { fileUrl: rooms[roomId].fileUrl });
      if (rooms[roomId].annotations) {
        socket.emit("annotationUpdate", { xfdfString: rooms[roomId].annotations });
      }
    } else {
      socket.emit("error", "Invalid Room ID");
    }
  });

  // Upload Document (Master Only)
  socket.on("documentSelected", ({ roomId, fileUrl }) => {
    if (rooms[roomId] && rooms[roomId].masterId === socket.id) {
      rooms[roomId].fileUrl = fileUrl;
      console.log(`📄 Document uploaded in room ${roomId}: ${fileUrl}`);
      io.to(roomId).emit("documentSelected", { fileUrl });
    }
  });

  // Handle Annotation Updates
  socket.on("annotationUpdate", ({ roomId, xfdfString }) => {
    if (rooms[roomId]) {
      rooms[roomId].annotations = xfdfString; // Save annotations
      console.log(`📌 Annotation updated in room ${roomId}`);
      io.to(roomId).emit("annotationUpdate", { xfdfString }); // Send to all users
    }
  });

  // Handle Disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    Object.keys(rooms).forEach((roomId) => {
      if (rooms[roomId].masterId === socket.id) {
        console.log(`🚨 Host left, closing room ${roomId}`);
        io.to(roomId).emit("roomClosed");
        delete rooms[roomId];
      }
    });
  });
});

server.listen(3001, () => {
  console.log("✅ Server running on port 3001");
});
