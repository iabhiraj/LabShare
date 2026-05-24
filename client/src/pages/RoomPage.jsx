import { useState } from "react";
import toast from "react-hot-toast";
import { useSocket } from "../context/SocketContext.jsx";
import DropZone from "../components/DropZone.jsx";
import TransferCard from "../components/TransferCard.jsx";
import UserList from "../components/UserList.jsx";
import ChatDrawer from "../components/ChatDrawer.jsx";
import QRModal from "../components/QRModal.jsx";
import Button from "../components/Button.jsx";
import { copyText } from "../utils/helpers.js";

export default function RoomPage() {
  const {
    room, currentUser, transfers,
    leaveRoom, shareClipboard, sendFileToPeer,
    messages, toggleTheme, theme,
  } = useSocket();

  const [chatOpen,     setChatOpen]     = useState(false);
  const [qrOpen,       setQrOpen]       = useState(false);
  const [selectedPeer, setSelectedPeer] = useState(null);

  const peers   = (room?.users ?? []).filter(u => u.id !== currentUser?.id);
  const target  = selectedPeer ?? peers[0] ?? null;
  const unread  = chatOpen ? 0 : messages.length;

  const handleFiles = files => {
    if (!target) { toast.error("No peer to send to yet."); return; }
    files.forEach(f => sendFileToPeer(f, target.id));
    toast(`📤 Sending ${files.length} file${files.length > 1 ? "s" : ""} to ${target.deviceName}…`);
  };

  const handleCopy = async () => {
    const ok = await copyText(room?.code ?? "");
    if (ok) toast.success("Room code copied!");
  };

  return (
    <div className="h-screen flex flex-col bg-surface-950 text-slate-100 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="glass bg-surface-900/80 border-b border-surface-700 px-4 py-3 flex items-center justify-between flex-shrink-0 z-10">
        {/* Left: logo + room code */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)" }}>
            <span className="text-white text-xs font-bold">LS</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-lg tracking-widest text-white">
                {room?.code}
              </span>
              <button
                onClick={handleCopy}
                className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors font-semibold"
              >
                Copy
              </button>
              <button
                onClick={() => setQrOpen(true)}
                className="text-[11px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors font-semibold"
              >
                QR
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {room?.users?.length ?? 1} device{(room?.users?.length ?? 1) !== 1 ? "s" : ""} connected
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-surface-600 text-slate-400 hover:bg-surface-700 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            onClick={shareClipboard}
            className="p-2 rounded-lg border border-surface-600 text-slate-400 hover:bg-surface-700 transition-colors"
            title="Share clipboard text with room"
            aria-label="Share clipboard"
          >
            📋
          </button>
          <button
            onClick={() => setChatOpen(v => !v)}
            className="relative p-2 rounded-lg border border-surface-600 text-slate-400 hover:bg-surface-700 transition-colors"
            aria-label="Open chat"
          >
            💬
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          <Button variant="danger" size="sm" onClick={leaveRoom}>Leave</Button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main column */}
        <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Peer selector */}
          {peers.length > 0 && (
            <section>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                Send files to
              </p>
              <div className="flex flex-wrap gap-2">
                {peers.map((peer, i) => {
                  const gradients = ["from-blue-400 to-violet-500","from-pink-400 to-red-500","from-emerald-400 to-teal-500","from-amber-400 to-orange-500"];
                  const active    = (selectedPeer?.id ?? peers[0]?.id) === peer.id;
                  return (
                    <button
                      key={peer.id}
                      onClick={() => setSelectedPeer(peer)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
                        active
                          ? "border-blue-500 bg-blue-500/10 text-blue-300"
                          : "border-surface-600 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center text-white text-[10px] font-bold`}>
                        {peer.deviceName[0].toUpperCase()}
                      </div>
                      {peer.deviceName}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Drop zone */}
          <section>
            <DropZone onFiles={handleFiles} disabled={!target} />
          </section>

          {/* Transfers */}
          {transfers.length > 0 && (
            <section>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                Transfers
              </p>
              <div className="flex flex-col gap-2">
                {transfers.map(t => <TransferCard key={t.id} transfer={t} />)}
              </div>
            </section>
          )}
        </main>

        {/* User sidebar */}
        <aside className="w-56 flex-shrink-0 border-l border-surface-700 bg-surface-900/50 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-700 flex-shrink-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Devices ({room?.users?.length ?? 0})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <UserList users={room?.users ?? []} currentUserId={currentUser?.id} />
          </div>
        </aside>
      </div>

      {/* ── Overlays ────────────────────────────────────────────────────── */}
      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      {qrOpen && <QRModal roomCode={room?.code} onClose={() => setQrOpen(false)} />}
    </div>
  );
}
