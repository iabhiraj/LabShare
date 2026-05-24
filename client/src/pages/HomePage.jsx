import { useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";
import Button from "../components/Button.jsx";
import ConnectionBadge from "../components/ConnectionBadge.jsx";
import clsx from "clsx";

const FEATURES = [
  { icon: "⚡", title: "Instant P2P",    desc: "Files go browser→browser via WebRTC"  },
  { icon: "🔒", title: "Zero Storage",   desc: "Nothing ever touches the server"       },
  { icon: "📱", title: "Any Device",     desc: "No install, no login, just a URL"      },
];

export default function HomePage() {
  const { createRoom, joinRoom, deviceName, setDeviceName, connected } = useSocket();

  const [mode,      setMode]      = useState("home"); // "home" | "join"
  const [joinCode,  setJoinCode]  = useState("LAB-");
  const [nameError, setNameError] = useState("");

  const guardName = () => {
    if (!deviceName.trim()) { setNameError("Please enter a device name."); return false; }
    setNameError("");
    return true;
  };

  const handleCreate = () => { if (guardName()) createRoom(); };

  const handleJoin = () => {
    if (!guardName()) return;
    const code = joinCode.trim().toUpperCase();
    if (!/^LAB-\d{4}$/.test(code)) {
      setNameError("Code format: LAB-XXXX  (e.g. LAB-2387)");
      return;
    }
    joinRoom(code);
  };

  const handleCodeChange = e => {
    let v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!v.startsWith("LAB-")) v = "LAB-" + v.replace(/^LAB-?/, "");
    if (v.length > 8) v = v.slice(0, 8);
    setJoinCode(v);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface-950 relative overflow-hidden">
      {/* Ambient background */}
      <div className="bg-grid absolute inset-0 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)" }} />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)" }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a9.001 9.001 0 01-12.748 0M4.316 10.658A9 9 0 0119.684 10.658" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Lab<span className="text-blue-400">Share</span>
          </h1>
          <p className="mt-2 text-slate-400">Share files instantly across computers</p>
          <div className="flex justify-center mt-3">
            <ConnectionBadge />
          </div>
        </div>

        {/* Card */}
        <div className="glass bg-surface-900/80 border border-surface-700 rounded-2xl p-6 shadow-2xl">
          {/* Device name */}
          <div className="mb-5">
            <label htmlFor="device-name" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Your Device Name
            </label>
            <input
              id="device-name"
              type="text"
              value={deviceName}
              onChange={e => { setDeviceName(e.target.value); setNameError(""); }}
              placeholder="e.g. MacBook Pro"
              maxLength={40}
              className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
            />
            {nameError && (
              <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">⚠️ {nameError}</p>
            )}
          </div>

          {mode === "home" ? (
            <div className="flex flex-col gap-2.5">
              <Button full size="lg" disabled={!connected} onClick={handleCreate}>
                ✦ Create Room
              </Button>
              <Button full size="lg" variant="ghost" disabled={!connected} onClick={() => setMode("join")}>
                → Join Existing Room
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                autoFocus
                type="text"
                value={joinCode}
                onChange={handleCodeChange}
                placeholder="LAB-XXXX"
                className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-center text-2xl font-bold font-mono tracking-[0.2em] text-slate-100 outline-none focus:border-violet-500 transition-colors"
              />
              <div className="flex gap-2">
                <Button full variant="ghost" onClick={() => setMode("home")}>Cancel</Button>
                <Button
                  full
                  disabled={!connected || joinCode.length < 8}
                  onClick={handleJoin}
                  className="bg-gradient-to-br from-violet-500 to-pink-500"
                >
                  Join Room →
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-surface-900/70 border border-surface-700 rounded-xl p-3 text-center">
              <div className="text-xl mb-1">{f.icon}</div>
              <div className="text-xs font-semibold text-slate-300">{f.title}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
