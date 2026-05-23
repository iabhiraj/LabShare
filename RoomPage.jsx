/**
 * RoomPage
 * Main room interface: file drop zone, user list, chat panel, transfers.
 */
import React, { useState, useCallback, useRef } from "react";
import { useSocket } from "../context/SocketContext";
import { useQRCode } from "../hooks/useQRCode";
import { formatBytes, formatSpeed, getFileIcon, validateFile, copyToClipboard } from "../utils/helpers";
import clsx from "clsx";
import toast from "react-hot-toast";

export default function RoomPage() {
  const {
    room, currentUser, messages, transfers,
    leaveRoom, sendMessage, shareClipboard, sendFileToPeer,
    theme, toggleTheme,
  } = useSocket();

  const qrDataUrl = useQRCode(room?.code);
  const [chatInput, setChatInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState(null); // target user for transfer
  const fileInputRef = useRef();
  const chatEndRef = useRef();
  const dark = theme === "dark";

  const otherUsers = room?.users?.filter((u) => u.id !== currentUser?.id) || [];

  // ── Drag and drop ──────────────────────────────────────────────────────────
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    handleFiles(files);
  }, [selectedPeer]);

  const handleFiles = (files) => {
    if (!files.length) return;
    if (otherUsers.length === 0) {
      toast.error("No other users in the room yet.");
      return;
    }

    const target = selectedPeer || otherUsers[0];
    files.forEach((file) => {
      const { valid, error } = validateFile(file);
      if (!valid) {
        toast.error(error);
        return;
      }
      sendFileToPeer(file, target.id);
      toast(`📤 Sending ${file.name} to ${target.deviceName}...`);
    });
  };

  // ── Chat ───────────────────────────────────────────────────────────────────
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput("");
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(room?.code);
    if (ok) toast.success("Room code copied!");
  };

  return (
    <div className={clsx(
      "min-h-screen flex flex-col transition-colors duration-300",
      dark ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"
    )}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className={clsx(
        "flex items-center justify-between px-6 py-4 border-b sticky top-0 z-20 backdrop-blur-md",
        dark ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-200"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
            <span className="text-white text-xs font-bold">LS</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={clsx("font-mono font-bold text-lg", dark ? "text-white" : "text-slate-900")}>
                {room?.code}
              </span>
              <button onClick={handleCopyCode} className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
                Copy
              </button>
              <button onClick={() => setShowQR(v => !v)} className="text-xs px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors">
                QR
              </button>
            </div>
            <div className={clsx("text-xs", dark ? "text-slate-500" : "text-slate-400")}>
              {room?.users?.length || 1} device{room?.users?.length !== 1 ? "s" : ""} connected
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className={clsx(
            "p-2 rounded-lg border transition-colors",
            dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-100"
          )}>
            {dark ? "☀️" : "🌙"}
          </button>
          <button onClick={() => setShowChat(v => !v)} className={clsx(
            "p-2 rounded-lg border transition-colors relative",
            dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-100"
          )}>
            💬
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[10px] text-white flex items-center justify-center">
                {messages.length > 9 ? "9+" : messages.length}
              </span>
            )}
          </button>
          <button onClick={shareClipboard} className={clsx(
            "p-2 rounded-lg border transition-colors",
            dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-100"
          )} title="Share clipboard">
            📋
          </button>
          <button onClick={leaveRoom} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-colors">
            Leave
          </button>
        </div>
      </header>

      {/* ── QR Popup ──────────────────────────────────────────────────────── */}
      {showQR && qrDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowQR(false)}>
          <div className={clsx("rounded-2xl p-6 text-center shadow-2xl", dark ? "bg-slate-900" : "bg-white")} onClick={e => e.stopPropagation()}>
            <h3 className={clsx("font-bold text-lg mb-1", dark ? "text-white" : "text-slate-900")}>Scan to Join</h3>
            <p className={clsx("text-sm mb-4", dark ? "text-slate-400" : "text-slate-500")}>Room {room?.code}</p>
            <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 rounded-xl mx-auto" />
            <button onClick={() => setShowQR(false)} className="mt-4 text-sm text-slate-400 hover:text-slate-200">
              Close
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Main Content ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-auto p-6 gap-6">
          {/* Peer selector */}
          {otherUsers.length > 0 && (
            <div>
              <p className={clsx("text-xs font-medium uppercase tracking-wider mb-3", dark ? "text-slate-500" : "text-slate-400")}>
                Send files to
              </p>
              <div className="flex gap-2 flex-wrap">
                {otherUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedPeer(user)}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all",
                      selectedPeer?.id === user.id || (!selectedPeer && otherUsers[0]?.id === user.id)
                        ? "border-blue-500 bg-blue-500/10 text-blue-400"
                        : dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                      {user.deviceName[0]}
                    </div>
                    {user.deviceName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Drop Zone ─────────────────────────────────────────────────── */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              "relative flex flex-col items-center justify-center min-h-64 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200",
              isDragging
                ? "border-blue-400 bg-blue-500/10 scale-[1.01]"
                : dark
                  ? "border-slate-700 hover:border-slate-500 bg-slate-900/50"
                  : "border-slate-200 hover:border-slate-300 bg-white"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(Array.from(e.target.files))}
            />
            <div className={clsx(
              "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 transition-transform",
              isDragging ? "scale-110" : "",
              dark ? "bg-slate-800" : "bg-slate-100"
            )}>
              {isDragging ? "📂" : "📤"}
            </div>
            <p className={clsx("text-lg font-semibold", dark ? "text-slate-200" : "text-slate-700")}>
              {isDragging ? "Drop to send!" : "Drop files here"}
            </p>
            <p className={clsx("text-sm mt-1", dark ? "text-slate-500" : "text-slate-400")}>
              or click to browse · Images, PDFs, Videos, ZIPs, and more
            </p>
            {otherUsers.length === 0 && (
              <div className="absolute bottom-4 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-amber-400 text-xs text-center">⏳ Waiting for others to join the room</p>
              </div>
            )}
          </div>

          {/* ── Active Transfers ───────────────────────────────────────────── */}
          {transfers.length > 0 && (
            <div>
              <p className={clsx("text-xs font-medium uppercase tracking-wider mb-3", dark ? "text-slate-500" : "text-slate-400")}>
                Transfers
              </p>
              <div className="space-y-2">
                {transfers.map((t) => (
                  <TransferCard key={t.id} transfer={t} dark={dark} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar: Users ────────────────────────────────────────────────── */}
        <aside className={clsx(
          "w-64 border-l flex flex-col overflow-hidden",
          dark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="p-4 border-b" style={{ borderColor: dark ? "#1e293b" : "#e2e8f0" }}>
            <p className={clsx("text-xs font-medium uppercase tracking-wider", dark ? "text-slate-500" : "text-slate-400")}>
              Connected Devices ({room?.users?.length || 0})
            </p>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-1">
            {room?.users?.map((user) => (
              <div key={user.id} className={clsx(
                "flex items-center gap-3 p-3 rounded-xl",
                user.id === currentUser?.id
                  ? dark ? "bg-blue-500/10" : "bg-blue-50"
                  : dark ? "hover:bg-slate-800" : "hover:bg-slate-50"
              )}>
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                    {user.deviceName[0].toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2"
                    style={{ borderColor: dark ? "#0f172a" : "#ffffff" }} />
                </div>
                <div className="min-w-0">
                  <p className={clsx("text-sm font-medium truncate", dark ? "text-slate-200" : "text-slate-700")}>
                    {user.deviceName}
                  </p>
                  {user.id === currentUser?.id && (
                    <p className="text-xs text-blue-400">You</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ── Chat Drawer ───────────────────────────────────────────────────── */}
      {showChat && (
        <div className={clsx(
          "fixed right-0 top-0 h-full w-80 z-40 flex flex-col border-l shadow-2xl transition-all",
          dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className={clsx("flex items-center justify-between px-4 py-3 border-b", dark ? "border-slate-800" : "border-slate-200")}>
            <h3 className={clsx("font-semibold", dark ? "text-white" : "text-slate-900")}>Chat</h3>
            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-slate-200">✕</button>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {messages.length === 0 && (
              <p className={clsx("text-xs text-center mt-8", dark ? "text-slate-600" : "text-slate-400")}>
                No messages yet. Say hello! 👋
              </p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={clsx(
                "flex flex-col gap-0.5",
                msg.senderId === currentUser?.id ? "items-end" : "items-start"
              )}>
                <span className={clsx("text-xs", dark ? "text-slate-500" : "text-slate-400")}>
                  {msg.senderName}
                </span>
                <div className={clsx(
                  "max-w-[80%] px-3 py-2 rounded-xl text-sm",
                  msg.senderId === currentUser?.id
                    ? "bg-blue-500 text-white"
                    : dark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"
                )}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className={clsx("p-3 border-t", dark ? "border-slate-800" : "border-slate-200")}>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type a message..."
                className={clsx(
                  "flex-1 px-3 py-2 rounded-xl border text-sm outline-none",
                  dark ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500" : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                )}
              />
              <button
                onClick={handleSendMessage}
                className="px-3 py-2 rounded-xl bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Transfer Card component ────────────────────────────────────────────────────
function TransferCard({ transfer, dark }) {
  const icon = getFileIcon(transfer.fileName);
  const isDone = transfer.status === "done";

  return (
    <div className={clsx(
      "flex items-center gap-3 p-3 rounded-xl border",
      dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
    )}>
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className={clsx("text-sm font-medium truncate", dark ? "text-slate-200" : "text-slate-700")}>
            {transfer.fileName}
          </p>
          <span className={clsx("text-xs flex-shrink-0 px-2 py-0.5 rounded-full",
            isDone
              ? "bg-emerald-500/10 text-emerald-400"
              : transfer.direction === "out"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-violet-500/10 text-violet-400"
          )}>
            {isDone ? "Done" : transfer.direction === "out" ? "Sending" : "Receiving"}
          </span>
        </div>
        <div className={clsx("h-1.5 rounded-full overflow-hidden", dark ? "bg-slate-800" : "bg-slate-100")}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${transfer.progress}%`,
              background: isDone ? "#10b981" : "linear-gradient(90deg, #3b82f6, #8b5cf6)",
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className={clsx("text-xs", dark ? "text-slate-500" : "text-slate-400")}>
            {formatBytes(transfer.fileSize)}
          </span>
          <span className={clsx("text-xs", dark ? "text-slate-500" : "text-slate-400")}>
            {isDone ? "✓ Complete" : `${transfer.progress}% · ${formatSpeed(transfer.speed)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
