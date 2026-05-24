/**
 * SocketContext
 * ─────────────────────────────────────────────────────────────────────────────
 * Central state for:
 *  • Socket.IO connection  (presence, room lifecycle, chat, clipboard)
 *  • WebRTC peer management (offer/answer/ICE exchange + DataChannel transfer)
 *  • Transfer progress tracking (send + receive)
 *
 * File data NEVER hits the server. The server only relays tiny JSON signals.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  createContext, useCallback, useContext,
  useEffect, useRef, useState,
} from "react";
import { io } from "socket.io-client";
import toast from "react-hot-toast";

// ─── Context ──────────────────────────────────────────────────────────────────
const SocketContext = createContext(null);

// ─── Config ───────────────────────────────────────────────────────────────────
const SERVER_URL  = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const CHUNK_SIZE  = 64 * 1024; // 64 KB per DataChannel send
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SocketProvider({ children }) {
  const socketRef = useRef(null);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [connected,   setConnected]   = useState(false);
  const [room,        setRoom]        = useState(null);   // { code, users }
  const [currentUser, setCurrentUser] = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [transfers,   setTransfers]   = useState([]);     // send + receive
  const [deviceName,  setDeviceName]  = useState(detectDeviceName);
  const [theme,       setTheme]       = useState("dark");

  // WebRTC refs — not React state (mutations shouldn't cause re-renders)
  const peerConns = useRef(new Map()); // peerId → RTCPeerConnection
  const channels  = useRef(new Map()); // transferId → RTCDataChannel

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SERVER_URL, {
      autoConnect         : true,
      reconnectionAttempts: 5,
      reconnectionDelay   : 1000,
    });
    socketRef.current = socket;

    socket.on("connect",    ()  => setConnected(true));
    socket.on("disconnect", ()  => { setConnected(false); handleServerDisconnect(); });

    // ── Room events ──────────────────────────────────────────────────────
    socket.on("room:created",    ({ code, users, currentUser: u }) => {
      setRoom({ code, users });
      setCurrentUser(u);
      toast.success(`Room ${code} created!`);
    });

    socket.on("room:joined",     ({ code, users, currentUser: u }) => {
      setRoom({ code, users });
      setCurrentUser(u);
      toast.success(`Joined room ${code}`);
    });

    socket.on("room:error",      ({ message }) => toast.error(message));

    socket.on("room:user-joined",({ user, users }) => {
      setRoom(r => r ? { ...r, users } : r);
      toast(`💻 ${user.deviceName} joined`, { duration: 2500 });
    });

    socket.on("room:user-left",  ({ userName, users }) => {
      setRoom(r => r ? { ...r, users } : r);
      toast(`👋 ${userName} left`, { duration: 2500 });
    });

    socket.on("room:expired",    ({ message }) => {
      setRoom(null);
      setCurrentUser(null);
      toast.error(message);
    });

    // ── Chat ─────────────────────────────────────────────────────────────
    socket.on("chat:message", msg =>
      setMessages(prev => [...prev, msg])
    );

    // ── Clipboard ─────────────────────────────────────────────────────────
    socket.on("clipboard:received", ({ text, from }) => {
      navigator.clipboard?.writeText(text).catch(() => {});
      toast(`📋 Clipboard from ${from}`, { duration: 3000 });
    });

    // ── WebRTC signaling ──────────────────────────────────────────────────
    socket.on("webrtc:offer",         handleIncomingOffer);
    socket.on("webrtc:answer",        handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);
    socket.on("transfer:done",        ({ fromName, fileName }) =>
      toast.success(`✅ ${fileName} received from ${fromName}`)
    );

    return () => {
      socket.disconnect();
      closePeers();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Room actions ──────────────────────────────────────────────────────────
  const createRoom = useCallback(() => {
    if (!deviceName.trim()) { toast.error("Enter a device name first."); return; }
    socketRef.current?.emit("room:create", { deviceName: deviceName.trim() });
  }, [deviceName]);

  const joinRoom = useCallback((code) => {
    if (!deviceName.trim()) { toast.error("Enter a device name first."); return; }
    socketRef.current?.emit("room:join", { code, deviceName: deviceName.trim() });
  }, [deviceName]);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("room:leave");
    setRoom(null);
    setCurrentUser(null);
    setMessages([]);
    setTransfers([]);
    closePeers();
  }, []);

  // ── Chat ──────────────────────────────────────────────────────────────────
  const sendMessage = useCallback((text) => {
    socketRef.current?.emit("chat:message", { text });
  }, []);

  // ── Clipboard ─────────────────────────────────────────────────────────────
  const shareClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      socketRef.current?.emit("clipboard:share", { text });
      toast.success("Clipboard shared with room!");
    } catch {
      toast.error("Cannot read clipboard — grant permission first.");
    }
  }, []);

  // ── WebRTC: send file to a specific peer ──────────────────────────────────
  const sendFileToPeer = useCallback(async (file, targetId) => {
    const socket = socketRef.current;
    if (!socket) return;

    const pc          = makePeerConnection(targetId);
    const transferId  = `out-${targetId}-${Date.now()}`;
    const channel     = pc.createDataChannel("labshare-file");
    channels.current.set(transferId, channel);

    // Register transfer immediately so UI shows it
    addTransfer({
      id       : transferId,
      fileName : file.name,
      fileSize : file.size,
      progress : 0,
      speed    : 0,
      status   : "connecting",
      direction: "out",
    });

    channel.bufferedAmountLowThreshold = 512 * 1024; // 512 KB

    channel.onopen = () => {
      updateTransfer(transferId, { status: "sending" });
      streamFile(file, channel, transferId, () => {
        socket.emit("transfer:done", { targetId, fileName: file.name });
        updateTransfer(transferId, { status: "done", progress: 100, speed: 0 });
      });
    };

    channel.onerror = () => updateTransfer(transferId, { status: "error" });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit("webrtc:ice-candidate", { targetId, candidate });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("webrtc:offer", {
      targetId,
      offer,
      meta: { fileName: file.name, fileSize: file.size, fileType: file.type },
    });
  }, []);

  // ── WebRTC signal handlers ────────────────────────────────────────────────
  async function handleIncomingOffer({ fromId, fromName, offer, meta }) {
    if (!offer) return;
    const socket     = socketRef.current;
    const pc         = makePeerConnection(fromId);
    const transferId = `in-${fromId}-${Date.now()}`;

    let chunks      = [];
    let received    = 0;
    let fileMeta    = meta ?? {};
    let startTime   = Date.now();

    pc.ondatachannel = ({ channel }) => {
      channel.binaryType = "arraybuffer";

      channel.onmessage = ({ data }) => {
        if (typeof data === "string") {
          const msg = JSON.parse(data);
          if (msg.type === "meta") {
            fileMeta  = msg;
            startTime = Date.now();
            addTransfer({
              id       : transferId,
              fileName : msg.name,
              fileSize : msg.size,
              progress : 0,
              speed    : 0,
              status   : "receiving",
              direction: "in",
            });
          } else if (msg.type === "done") {
            const blob = new Blob(chunks, { type: fileMeta.mimeType || "application/octet-stream" });
            triggerDownload(blob, fileMeta.name || "received-file");
            updateTransfer(transferId, { status: "done", progress: 100, speed: 0 });
            chunks = [];
          }
        } else {
          // Binary chunk
          chunks.push(data);
          received += data.byteLength;
          const size    = fileMeta.size ?? meta?.fileSize ?? 1;
          const elapsed = (Date.now() - startTime) / 1000 || 0.001;
          updateTransfer(transferId, {
            progress: Math.min(99, Math.round((received / size) * 100)),
            speed   : received / elapsed,
            status  : "receiving",
          });
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
    await peerConns.current.get(fromId)?.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async function handleIceCandidate({ fromId, candidate }) {
    try {
      await peerConns.current.get(fromId)?.addIceCandidate(new RTCIceCandidate(candidate));
    } catch { /* ignore stale candidates */ }
  }

  // ── Theme ─────────────────────────────────────────────────────────────────
  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  // ── Internal helpers ──────────────────────────────────────────────────────
  function makePeerConnection(peerId) {
    if (peerConns.current.has(peerId)) {
      peerConns.current.get(peerId).close();
    }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConns.current.set(peerId, pc);
    return pc;
  }

  function closePeers() {
    peerConns.current.forEach(pc => pc.close());
    peerConns.current.clear();
    channels.current.clear();
  }

  function handleServerDisconnect() {
    setRoom(null);
    setCurrentUser(null);
    closePeers();
  }

  function addTransfer(t) {
    setTransfers(prev => [t, ...prev].slice(0, 50)); // keep latest 50
  }

  function updateTransfer(id, patch) {
    setTransfers(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  /** Read file in chunks and push through an open RTCDataChannel */
  async function streamFile(file, channel, transferId, onDone) {
    // Send metadata header
    channel.send(JSON.stringify({ type: "meta", name: file.name, size: file.size, mimeType: file.type }));

    const reader    = file.stream().getReader();
    let   sent      = 0;
    const startTime = Date.now();
    const fileSize  = file.size;

    const pump = async () => {
      const { value, done } = await reader.read();
      if (done) {
        channel.send(JSON.stringify({ type: "done" }));
        onDone();
        return;
      }

      // Sub-chunk to respect channel buffer limits
      let i = 0;
      while (i < value.byteLength) {
        const end   = Math.min(i + CHUNK_SIZE, value.byteLength);
        const chunk = value.slice(i, end);

        // Backpressure: wait until buffer drains before flooding
        if (channel.bufferedAmount > 8 * 1024 * 1024) { // 8 MB high-water mark
          await new Promise(res => {
            channel.onbufferedamountlow = () => { channel.onbufferedamountlow = null; res(); };
          });
        }

        channel.send(chunk);
        sent += chunk.byteLength;
        i    += CHUNK_SIZE;
      }

      const elapsed = (Date.now() - startTime) / 1000 || 0.001;
      updateTransfer(transferId, {
        progress: Math.min(99, Math.round((sent / fileSize) * 100)),
        speed   : sent / elapsed,
        status  : "sending",
      });

      // Yield to event loop
      await new Promise(res => setTimeout(res, 0));
      pump();
    };

    pump();
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      room,
      currentUser,
      messages,
      transfers,
      deviceName, setDeviceName,
      theme, toggleTheme,
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
  if (!ctx) throw new Error("useSocket must be used inside <SocketProvider>");
  return ctx;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function detectDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua))   return "iPhone";
  if (/iPad/i.test(ua))     return "iPad";
  if (/Android/i.test(ua))  return "Android Device";
  if (/Mac/i.test(ua))      return "MacBook";
  if (/Windows/i.test(ua))  return "Windows PC";
  if (/Linux/i.test(ua))    return "Linux Machine";
  return "Unknown Device";
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
