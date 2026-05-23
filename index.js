/**
 * LabShare Server
 * Real-time file sharing via Socket.IO + WebRTC signaling
 * No database — all state is ephemeral in-memory
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const rateLimit = require("express-rate-limit");
const path = require("path");
const os = require("os");

const app = express();
const server = http.createServer(app);

// ─── Socket.IO Setup ──────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB max per chunk
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));
app.use(express.json());

// Rate limiting — prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests, please try again later.",
});
app.use("/api/", limiter);

// ─── In-Memory Store ──────────────────────────────────────────────────────────
/**
 * rooms: Map<roomCode, RoomData>
 * RoomData = {
 *   code: string,
 *   createdAt: Date,
 *   lastActivity: Date,
 *   users: Map<socketId, UserData>,
 *   messages: ChatMessage[],
 * }
 */
const rooms = new Map();

// ─── Room Code Generator ──────────────────────────────────────────────────────
function generateRoomCode() {
  const num = Math.floor(1000 + Math.random() * 9000);
  const code = `LAB-${num}`;
  // Ensure uniqueness
  return rooms.has(code) ? generateRoomCode() : code;
}

// ─── Room Cleanup: Delete after 30min inactivity ──────────────────────────────
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > INACTIVITY_TIMEOUT) {
      console.log(`[Room] Expired and removed: ${code}`);
      // Notify remaining sockets
      io.to(code).emit("room:expired", { message: "Room expired due to inactivity." });
      rooms.delete(code);
    }
  }
}, 60 * 1000); // Check every minute

// ─── REST API Routes ──────────────────────────────────────────────────────────

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    rooms: rooms.size,
    timestamp: new Date().toISOString(),
  });
});

// Get room info (validate code before joining via socket)
app.get("/api/room/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  res.json({
    code: room.code,
    userCount: room.users.size,
    createdAt: room.createdAt,
  });
});

// ─── Socket.IO Event Handlers ─────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  let currentRoom = null;
  let currentUser = null;

  // ── Create Room ──────────────────────────────────────────────────────────
  socket.on("room:create", ({ deviceName }) => {
    const code = generateRoomCode();
    const user = {
      id: socket.id,
      deviceName: sanitizeString(deviceName) || `Device-${socket.id.slice(0, 4)}`,
      joinedAt: new Date(),
    };

    rooms.set(code, {
      code,
      createdAt: new Date(),
      lastActivity: Date.now(),
      users: new Map([[socket.id, user]]),
      messages: [],
    });

    socket.join(code);
    currentRoom = code;
    currentUser = user;

    socket.emit("room:created", {
      code,
      user,
      users: [user],
    });

    console.log(`[Room] Created: ${code} by ${user.deviceName}`);
  });

  // ── Join Room ────────────────────────────────────────────────────────────
  socket.on("room:join", ({ code, deviceName }) => {
    const roomCode = code?.toUpperCase();
    const room = rooms.get(roomCode);

    if (!room) {
      return socket.emit("room:error", { message: "Room not found. Check the code and try again." });
    }

    if (room.users.size >= 20) {
      return socket.emit("room:error", { message: "Room is full (max 20 devices)." });
    }

    const user = {
      id: socket.id,
      deviceName: sanitizeString(deviceName) || `Device-${socket.id.slice(0, 4)}`,
      joinedAt: new Date(),
    };

    room.users.set(socket.id, user);
    room.lastActivity = Date.now();
    socket.join(roomCode);
    currentRoom = roomCode;
    currentUser = user;

    const userList = Array.from(room.users.values());

    // Tell the joiner about existing users
    socket.emit("room:joined", { code: roomCode, user, users: userList });

    // Notify others about new arrival
    socket.to(roomCode).emit("room:user-joined", { user, users: userList });

    console.log(`[Room] ${user.deviceName} joined ${roomCode}`);
  });

  // ── Leave Room ───────────────────────────────────────────────────────────
  socket.on("room:leave", () => {
    leaveRoom(socket);
  });

  // ── Chat Message ─────────────────────────────────────────────────────────
  socket.on("chat:message", ({ text }) => {
    if (!currentRoom || !currentUser) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const message = {
      id: uuidv4(),
      senderId: socket.id,
      senderName: currentUser.deviceName,
      text: sanitizeString(text).slice(0, 500), // max 500 chars
      timestamp: new Date(),
    };

    room.messages.push(message);
    room.lastActivity = Date.now();

    // Broadcast to everyone in room including sender
    io.to(currentRoom).emit("chat:message", message);
  });

  // ── Clipboard Share ──────────────────────────────────────────────────────
  socket.on("clipboard:share", ({ text }) => {
    if (!currentRoom || !currentUser) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    room.lastActivity = Date.now();
    socket.to(currentRoom).emit("clipboard:received", {
      text: sanitizeString(text).slice(0, 10000),
      from: currentUser.deviceName,
      timestamp: new Date(),
    });
  });

  // ── WebRTC Signaling ─────────────────────────────────────────────────────
  // These events relay WebRTC offer/answer/ICE between peers

  socket.on("webrtc:offer", ({ targetId, offer, fileName, fileSize, fileType }) => {
    if (!currentRoom) return;
    io.to(targetId).emit("webrtc:offer", {
      fromId: socket.id,
      fromName: currentUser?.deviceName,
      offer,
      fileName,
      fileSize,
      fileType,
    });
  });

  socket.on("webrtc:answer", ({ targetId, answer }) => {
    io.to(targetId).emit("webrtc:answer", {
      fromId: socket.id,
      answer,
    });
  });

  socket.on("webrtc:ice-candidate", ({ targetId, candidate }) => {
    io.to(targetId).emit("webrtc:ice-candidate", {
      fromId: socket.id,
      candidate,
    });
  });

  // File transfer notifications (metadata only, data goes P2P)
  socket.on("file:transfer-complete", ({ targetId, fileName }) => {
    io.to(targetId).emit("file:transfer-complete", {
      fromName: currentUser?.deviceName,
      fileName,
    });
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    leaveRoom(socket);
  });

  // ── Helper: Leave Room ───────────────────────────────────────────────────
  function leaveRoom(socket) {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    room.users.delete(socket.id);
    socket.leave(currentRoom);

    const userList = Array.from(room.users.values());

    // Notify others
    io.to(currentRoom).emit("room:user-left", {
      userId: socket.id,
      userName: currentUser?.deviceName,
      users: userList,
    });

    // Delete empty rooms
    if (room.users.size === 0) {
      console.log(`[Room] Empty, removing: ${currentRoom}`);
      rooms.delete(currentRoom);
    } else {
      room.lastActivity = Date.now();
    }

    currentRoom = null;
    currentUser = null;
  }
});

// ─── Security Helper ──────────────────────────────────────────────────────────
function sanitizeString(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>]/g, "").trim();
}

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  const interfaces = os.networkInterfaces();
  const localIP = Object.values(interfaces)
    .flat()
    .find((i) => i.family === "IPv4" && !i.internal)?.address || "localhost";

  console.log(`\n🚀 LabShare Server running`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${localIP}:${PORT}`);
  console.log(`   API:     http://localhost:${PORT}/api/health\n`);
});
