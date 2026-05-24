/**
 * LabShare — Signaling & Room Server
 * ─────────────────────────────────────────────────────────────────────────────
 * Stack : Node.js · Express · Socket.IO
 * Role  : Room management + WebRTC offer/answer/ICE relay + chat
 *
 * Files NEVER pass through this server. The server only exchanges small JSON
 * signals so browsers can establish a direct peer-to-peer WebRTC connection.
 * All file data travels exclusively through RTCDataChannels between browsers.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const cors       = require("cors");
const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");
const os         = require("os");

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT                  = process.env.PORT || 4000;
const CLIENT_ORIGINS        = (process.env.CLIENT_ORIGINS || "http://localhost:5173")
                                .split(",").map(s => s.trim());
const INACTIVITY_TIMEOUT_MS = Number(process.env.ROOM_INACTIVITY_TIMEOUT_MS) || 30 * 60 * 1000;
const ROOM_MAX_USERS        = Number(process.env.ROOM_MAX_USERS) || 20;

// ─── Express App ─────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.set("trust proxy", 1); // needed behind Render/Railway reverse proxy

// Security headers (relaxed for API server — no HTML served)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS — only allow known frontend origins
app.use(cors({ origin: CLIENT_ORIGINS, methods: ["GET", "POST"] }));
app.use(express.json({ limit: "16kb" })); // tiny payloads only; no file data

// Rate limiting on REST endpoints
app.use(
  "/api/",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down." },
  })
);

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGINS, methods: ["GET", "POST"] },
  // Each signaling message is tiny JSON; 1 MB is extremely generous
  maxHttpBufferSize: 1 * 1024 * 1024,
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

// ─── In-Memory Room Store ─────────────────────────────────────────────────────
/**
 * @type {Map<string, Room>}
 *
 * Room = {
 *   code         : string           — e.g. "LAB-2387"
 *   createdAt    : number           — epoch ms
 *   lastActivity : number           — epoch ms (updated on any event)
 *   users        : Map<socketId, User>
 *   messages     : ChatMessage[]
 * }
 *
 * User = { id, deviceName, joinedAt }
 * ChatMessage = { id, senderId, senderName, text, timestamp }
 */
const rooms = new Map();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateRoomCode() {
  const num  = String(Math.floor(1000 + Math.random() * 9000));
  const code = `LAB-${num}`;
  return rooms.has(code) ? generateRoomCode() : code; // guarantee uniqueness
}

/** Strip < > to prevent trivial XSS if text ever reaches HTML context */
function sanitize(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>]/g, "").trim();
}

function roomSnapshot(room) {
  return {
    code      : room.code,
    users     : Array.from(room.users.values()),
    userCount : room.users.size,
    createdAt : room.createdAt,
  };
}

// ─── Auto-cleanup: remove rooms idle > INACTIVITY_TIMEOUT_MS ─────────────────
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > INACTIVITY_TIMEOUT_MS) {
      io.to(code).emit("room:expired", {
        message: "This room expired due to inactivity (30 minutes).",
      });
      rooms.delete(code);
      console.log(`[Room] Expired → ${code}`);
    }
  }
}, 60_000); // check every minute

// ─── REST Endpoints ───────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.json({ service: "LabShare API", status: "ok" }));

app.get("/api/health", (_req, res) =>
  res.json({
    status    : "ok",
    uptime    : Math.floor(process.uptime()),
    rooms     : rooms.size,
    timestamp : new Date().toISOString(),
  })
);

/** Validate a room code before the socket tries to join */
app.get("/api/room/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({ code: room.code, userCount: room.users.size, createdAt: room.createdAt });
});

// ─── Socket.IO Event Handlers ─────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[Socket] + ${socket.id}`);

  /** Mutable refs for this socket's session */
  let currentRoom = null; // room code string
  let currentUser = null; // User object

  // ── room:create ────────────────────────────────────────────────────────────
  socket.on("room:create", ({ deviceName } = {}) => {
    const code = generateRoomCode();
    const user = {
      id         : socket.id,
      deviceName : sanitize(deviceName).slice(0, 40) || `Device-${socket.id.slice(0, 4)}`,
      joinedAt   : Date.now(),
    };

    rooms.set(code, {
      code,
      createdAt    : Date.now(),
      lastActivity : Date.now(),
      users        : new Map([[socket.id, user]]),
      messages     : [],
    });

    socket.join(code);
    currentRoom = code;
    currentUser = user;

    socket.emit("room:created", { ...roomSnapshot(rooms.get(code)), currentUser: user });
    console.log(`[Room] Created ${code} by "${user.deviceName}"`);
  });

  // ── room:join ──────────────────────────────────────────────────────────────
  socket.on("room:join", ({ code, deviceName } = {}) => {
    const roomCode = sanitize(code).toUpperCase();
    const room     = rooms.get(roomCode);

    if (!room)
      return socket.emit("room:error", { message: "Room not found. Check the code and try again." });

    if (room.users.size >= ROOM_MAX_USERS)
      return socket.emit("room:error", { message: `Room is full (max ${ROOM_MAX_USERS} devices).` });

    const user = {
      id         : socket.id,
      deviceName : sanitize(deviceName).slice(0, 40) || `Device-${socket.id.slice(0, 4)}`,
      joinedAt   : Date.now(),
    };

    room.users.set(socket.id, user);
    room.lastActivity = Date.now();
    socket.join(roomCode);
    currentRoom = roomCode;
    currentUser = user;

    // Tell the new joiner the full room state
    socket.emit("room:joined", { ...roomSnapshot(room), currentUser: user });

    // Tell everyone else a new user arrived
    socket.to(roomCode).emit("room:user-joined", { user, users: Array.from(room.users.values()) });

    console.log(`[Room] "${user.deviceName}" joined ${roomCode} (${room.users.size} users)`);
  });

  // ── room:leave (explicit) ──────────────────────────────────────────────────
  socket.on("room:leave", () => handleLeave());

  // ── chat:message ───────────────────────────────────────────────────────────
  socket.on("chat:message", ({ text } = {}) => {
    if (!currentRoom || !currentUser) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const message = {
      id         : uuidv4(),
      senderId   : socket.id,
      senderName : currentUser.deviceName,
      text       : sanitize(text).slice(0, 500),
      timestamp  : Date.now(),
    };

    room.messages.push(message);
    // Cap history at 200 messages
    if (room.messages.length > 200) room.messages.shift();
    room.lastActivity = Date.now();

    io.to(currentRoom).emit("chat:message", message);
  });

  // ── clipboard:share ────────────────────────────────────────────────────────
  socket.on("clipboard:share", ({ text } = {}) => {
    if (!currentRoom || !currentUser) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    room.lastActivity = Date.now();
    socket.to(currentRoom).emit("clipboard:received", {
      text      : sanitize(text).slice(0, 20_000),
      from      : currentUser.deviceName,
      timestamp : Date.now(),
    });
  });

  // ── WebRTC signaling relay ─────────────────────────────────────────────────
  // The server is a simple relay — it never inspects offer/answer/ICE content.

  socket.on("webrtc:offer", ({ targetId, offer, meta } = {}) => {
    if (!currentRoom || !currentUser) return;
    io.to(targetId).emit("webrtc:offer", {
      fromId   : socket.id,
      fromName : currentUser.deviceName,
      offer,
      meta, // { fileName, fileSize, fileType } — metadata only
    });
  });

  socket.on("webrtc:answer", ({ targetId, answer } = {}) => {
    io.to(targetId).emit("webrtc:answer", { fromId: socket.id, answer });
  });

  socket.on("webrtc:ice-candidate", ({ targetId, candidate } = {}) => {
    io.to(targetId).emit("webrtc:ice-candidate", { fromId: socket.id, candidate });
  });

  /** Sender notifies receiver the transfer finished (for UI notification) */
  socket.on("transfer:done", ({ targetId, fileName } = {}) => {
    io.to(targetId).emit("transfer:done", {
      fromName : currentUser?.deviceName,
      fileName,
    });
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    console.log(`[Socket] - ${socket.id} (${reason})`);
    handleLeave();
  });

  // ── internal helper ────────────────────────────────────────────────────────
  function handleLeave() {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const leaverName = currentUser?.deviceName ?? "Unknown";
    room.users.delete(socket.id);
    socket.leave(currentRoom);

    if (room.users.size === 0) {
      rooms.delete(currentRoom);
      console.log(`[Room] Deleted (empty) ${currentRoom}`);
    } else {
      room.lastActivity = Date.now();
      io.to(currentRoom).emit("room:user-left", {
        userId   : socket.id,
        userName : leaverName,
        users    : Array.from(room.users.values()),
      });
    }

    currentRoom = null;
    currentUser = null;
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  const localIP =
    Object.values(os.networkInterfaces())
      .flat()
      .find((i) => i?.family === "IPv4" && !i.internal)?.address ?? "localhost";

  console.log("\n🚀  LabShare server is running");
  console.log(`    Local   → http://localhost:${PORT}`);
  console.log(`    Network → http://${localIP}:${PORT}`);
  console.log(`    Health  → http://localhost:${PORT}/api/health\n`);
});
