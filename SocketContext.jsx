/**
 * SocketContext
 * Central state management for socket connection, room, users, messages, and transfers.
 * Wraps the entire app so any component can access socket functionality.
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import toast from "react-hot-toast";

const SocketContext = createContext(null);

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:4000";

export function SocketProvider({ children }) {
  const socketRef = useRef(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);           // { code, users }
  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [incomingTransfers, setIncomingTransfers] = useState([]); // WebRTC offers pending
  const [deviceName, setDeviceName] = useState(() => detectDeviceName());
  const [theme, setTheme] = useState("dark");

  // WebRTC peer connections: Map<peerId, RTCPeerConnection>
  const peerConnections = useRef(new Map());
  // Active data channels: Map<peerId, RTCDataChannel>
  const dataChannels = useRef(new Map());
  // Transfer progress state
  const [transfers, setTransfers] = useState([]);

  // ── Socket Initialization ──────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SERVER_URL, {
      autoConnect: true,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      console.log("[Socket] Connected:", socket.id);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setRoom(null);
      setCurrentUser(null);
    });

    // ── Room events ────────────────────────────────────────────────────────
    socket.on("room:created", ({ code, user, users }) => {
      setRoom({ code, users });
      setCurrentUser(user);
      toast.success(`Room ${code} created!`);
    });

    socket.on("room:joined", ({ code, user, users }) => {
      setRoom({ code, users });
      setCurrentUser(user);
      toast.success(`Joined room ${code}`);
    });

    socket.on("room:error", ({ message }) => {
      toast.error(message);
    });

    socket.on("room:user-joined", ({ user, users }) => {
      setRoom((prev) => prev ? { ...prev, users } : null);
      toast(`${user.deviceName} joined the room`, { icon: "💻" });
    });

    socket.on("room:user-left", ({ userName, users }) => {
      setRoom((prev) => prev ? { ...prev, users } : null);
      toast(`${userName} left the room`, { icon: "👋" });
    });

    socket.on("room:expired", ({ message }) => {
      setRoom(null);
      setCurrentUser(null);
      toast.error(message);
    });

    // ── Chat ──────────────────────────────────────────────────────────────
    socket.on("chat:message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // ── Clipboard ─────────────────────────────────────────────────────────
    socket.on("clipboard:received", ({ text, from }) => {
      navigator.clipboard?.writeText(text).catch(() => {});
      toast(`📋 Clipboard received from ${from}`);
    });

    // ── WebRTC Signaling ──────────────────────────────────────────────────
    socket.on("webrtc:offer", handleIncomingOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);

    socket.on("file:transfer-complete", ({ fromName, fileName }) => {
      toast.success(`✅ ${fileName} received from ${fromName}`);
    });

    return () => {
      socket.disconnect();
      // Clean up all peer connections
      peerConnections.current.forEach((pc) => pc.close());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Room Actions ───────────────────────────────────────────────────────────
  const createRoom = useCallback(() => {
    socketRef.current?.emit("room:create", { deviceName });
  }, [deviceName]);

  const joinRoom = useCallback((code) => {
    socketRef.current?.emit("room:join", { code, deviceName });
  }, [deviceName]);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("room:leave");
    setRoom(null);
    setCurrentUser(null);
    setMessages([]);
    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    dataChannels.current.clear();
  }, []);

  // ── Chat ───────────────────────────────────────────────────────────────────
  const sendMessage = useCallback((text) => {
    socketRef.current?.emit("chat:message", { text });
  }, []);

  // ── Clipboard ─────────────────────────────────────────────────────────────
  const shareClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      socketRef.current?.emit("clipboard:share", { text });
      toast.success("Clipboard shared!");
    } catch {
      toast.error("Cannot read clipboard. Grant permission first.");
    }
  }, []);

  // ── WebRTC File Transfer ───────────────────────────────────────────────────
  const CHUNK_SIZE = 64 * 1024; // 64KB chunks

  const sendFileToPeer = useCallback(async (file, targetId) => {
    const socket = socketRef.current;
    if (!socket) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    peerConnections.current.set(targetId, pc);

    const transferId = `${targetId}-${Date.now()}`;

    // Create data channel
    const channel = pc.createDataChannel("fileTransfer");
    dataChannels.current.set(transferId, channel);

    let offset = 0;
    let startTime = 0;

    channel.onopen = async () => {
      startTime = Date.now();
      // Send metadata first
      channel.send(JSON.stringify({
        type: "metadata",
        name: file.name,
        size: file.size,
        mimeType: file.type,
      }));

      // Chunk the file and send
      const reader = file.stream().getReader();

      const sendChunk = async () => {
        const { value, done } = await reader.read();
        if (done) {
          channel.send(JSON.stringify({ type: "done" }));
          socket.emit("file:transfer-complete", { targetId, fileName: file.name });
          updateTransfer(transferId, { status: "done", progress: 100 });
          return;
        }
        // Send in 64KB sub-chunks
        let i = 0;
        while (i < value.byteLength) {
          const chunk = value.slice(i, i + CHUNK_SIZE);
          channel.send(chunk);
          offset += chunk.byteLength;
          i += CHUNK_SIZE;
        }

        const progress = Math.round((offset / file.size) * 100);
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = offset / elapsed; // bytes/sec

        updateTransfer(transferId, { progress, speed });

        // Yield to prevent blocking
        await new Promise((r) => setTimeout(r, 0));
        sendChunk();
      };

      sendChunk();
    };

    // Track transfer
    setTransfers((prev) => [
      ...prev,
      { id: transferId, fileName: file.name, fileSize: file.size, progress: 0, speed: 0, status: "sending", direction: "out" },
    ]);

    // ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("webrtc:ice-candidate", { targetId, candidate });
      }
    };

    // Create and send offer
    socket.emit("webrtc:offer", {
      targetId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("webrtc:offer", { targetId, offer, fileName: file.name, fileSize: file.size, fileType: file.type });
  }, []);

  // ── WebRTC Signal Handlers ─────────────────────────────────────────────────
  async function handleIncomingOffer({ fromId, fromName, offer, fileName, fileSize, fileType }) {
    if (!offer) return; // Metadata-only emit, ignore

    const socket = socketRef.current;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    peerConnections.current.set(fromId, pc);

    const transferId = `${fromId}-${Date.now()}`;
    let receivedSize = 0;
    let fileChunks = [];
    let fileMetadata = null;
    let startTime = Date.now();

    pc.ondatachannel = ({ channel }) => {
      channel.onmessage = ({ data }) => {
        if (typeof data === "string") {
          const msg = JSON.parse(data);
          if (msg.type === "metadata") {
            fileMetadata = msg;
            startTime = Date.now();
            setTransfers((prev) => [
              ...prev,
              { id: transferId, fileName: msg.name, fileSize: msg.size, progress: 0, speed: 0, status: "receiving", direction: "in" },
            ]);
          } else if (msg.type === "done") {
            // Assemble and trigger download
            const blob = new Blob(fileChunks, { type: fileMetadata?.mimeType || "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileMetadata?.name || "received-file";
            a.click();
            URL.revokeObjectURL(url);
            updateTransfer(transferId, { status: "done", progress: 100 });
            toast.success(`✅ ${fileMetadata?.name} received!`);
          }
        } else {
          fileChunks.push(data);
          receivedSize += data.byteLength;
          const size = fileMetadata?.size || fileSize;
          const progress = Math.round((receivedSize / size) * 100);
          const elapsed = (Date.now() - startTime) / 1000 || 0.001;
          updateTransfer(transferId, { progress, speed: receivedSize / elapsed });
        }
      };
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit("webrtc:ice-candidate", { targetId: fromId, candidate });
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("webrtc:answer", { targetId: fromId, answer });
  }

  async function handleAnswer({ fromId, answer }) {
    const pc = peerConnections.current.get(fromId);
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async function handleIceCandidate({ fromId, candidate }) {
    const pc = peerConnections.current.get(fromId);
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  function updateTransfer(id, updates) {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }

  // ── Theme ──────────────────────────────────────────────────────────────────
  const toggleTheme = useCallback(() => {
    setTheme((t) => t === "dark" ? "light" : "dark");
  }, []);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      room,
      currentUser,
      messages,
      transfers,
      deviceName,
      setDeviceName,
      theme,
      toggleTheme,
      createRoom,
      joinRoom,
      leaveRoom,
      sendMessage,
      shareClipboard,
      sendFileToPeer,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function detectDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android Device";
  if (/Mac/i.test(ua)) return "MacBook";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux Machine";
  return "Unknown Device";
}
