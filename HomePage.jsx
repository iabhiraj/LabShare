/**
 * HomePage
 * Landing screen with create/join room UI, device name input.
 */
import React, { useState } from "react";
import { useSocket } from "../context/SocketContext";
import clsx from "clsx";

export default function HomePage() {
  const { createRoom, joinRoom, deviceName, setDeviceName, connected, theme } = useSocket();
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState(null); // null | "join"
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!deviceName.trim()) return setError("Enter a device name first");
    setError("");
    createRoom();
  };

  const handleJoin = () => {
    if (!deviceName.trim()) return setError("Enter a device name first");
    const code = joinCode.trim().toUpperCase();
    if (!code.match(/^LAB-\d{4}$/)) return setError('Code format: LAB-XXXX (e.g. LAB-2387)');
    setError("");
    joinRoom(code);
  };

  const handleCodeInput = (e) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    // Auto-format: add "LAB-" prefix
    if (!val.startsWith("LAB-")) {
      val = "LAB-" + val.replace(/^LAB-?/, "");
    }
    if (val.length > 8) val = val.slice(0, 8);
    setJoinCode(val);
  };

  const dark = theme === "dark";

  return (
    <div className={clsx("min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-300",
      dark ? "bg-slate-950" : "bg-slate-50"
    )}>
      {/* Background grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={clsx("absolute inset-0 opacity-[0.03]",
          dark ? "bg-grid-white" : "bg-grid-slate"
        )} style={{
          backgroundImage: `linear-gradient(${dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} 1px, transparent 1px), linear-gradient(90deg, ${dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo + Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a9.001 9.001 0 01-12.748 0M4.316 10.658A9 9 0 0119.684 10.658" />
            </svg>
          </div>
          <h1 className={clsx("text-4xl font-bold tracking-tight",
            dark ? "text-white" : "text-slate-900"
          )}>
            Lab<span className="text-blue-500">Share</span>
          </h1>
          <p className={clsx("mt-2 text-lg", dark ? "text-slate-400" : "text-slate-500")}>
            Share files instantly across computers
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <div className={clsx("w-1.5 h-1.5 rounded-full", connected ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
            <span className={clsx("text-xs", dark ? "text-slate-500" : "text-slate-400")}>
              {connected ? "Server connected" : "Connecting..."}
            </span>
          </div>
        </div>

        {/* Card */}
        <div className={clsx(
          "rounded-2xl border backdrop-blur-sm p-6 shadow-2xl",
          dark ? "bg-slate-900/80 border-slate-700/50" : "bg-white/80 border-slate-200"
        )}>
          {/* Device name input */}
          <div className="mb-5">
            <label className={clsx("block text-xs font-medium mb-1.5 uppercase tracking-wider",
              dark ? "text-slate-400" : "text-slate-500"
            )}>
              Your Device Name
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. MacBook Pro"
              maxLength={30}
              className={clsx(
                "w-full px-4 py-3 rounded-xl border text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-blue-500",
                dark
                  ? "bg-slate-800 border-slate-600 text-white placeholder-slate-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              )}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm mb-4 flex items-center gap-1.5">
              <span>⚠️</span> {error}
            </p>
          )}

          {/* Create Room */}
          {mode !== "join" && (
            <button
              onClick={handleCreate}
              disabled={!connected}
              className="w-full py-3.5 rounded-xl font-semibold text-white text-sm mb-3 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
            >
              ✦ Create Room
            </button>
          )}

          {/* Join Room */}
          {mode === "join" ? (
            <div className="space-y-3">
              <input
                type="text"
                value={joinCode}
                onChange={handleCodeInput}
                placeholder="LAB-XXXX"
                autoFocus
                className={clsx(
                  "w-full px-4 py-3 rounded-xl border text-center text-xl font-mono font-bold tracking-widest outline-none focus:ring-2 focus:ring-violet-500 transition-all",
                  dark
                    ? "bg-slate-800 border-slate-600 text-white placeholder-slate-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                )}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setMode(null)}
                  className={clsx("flex-1 py-3 rounded-xl text-sm font-medium border transition-all",
                    dark ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoin}
                  disabled={!connected || joinCode.length < 8}
                  className="flex-1 py-3 rounded-xl font-semibold text-white text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
                >
                  Join Room →
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setMode("join")}
              disabled={!connected}
              className={clsx(
                "w-full py-3.5 rounded-xl font-semibold text-sm border transition-all active:scale-[0.98] disabled:opacity-50",
                dark ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              → Join Existing Room
            </button>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {[
            { icon: "⚡", label: "Instant Transfer", desc: "P2P via WebRTC" },
            { icon: "🔒", label: "Private Rooms", desc: "Auto-expire" },
            { icon: "📱", label: "Any Device", desc: "No install needed" },
          ].map((f) => (
            <div key={f.label} className={clsx(
              "rounded-xl p-3 text-center border",
              dark ? "bg-slate-900/50 border-slate-800 text-slate-400" : "bg-white border-slate-100 text-slate-500"
            )}>
              <div className="text-xl mb-1">{f.icon}</div>
              <div className={clsx("text-xs font-semibold", dark ? "text-slate-300" : "text-slate-700")}>{f.label}</div>
              <div className="text-xs mt-0.5">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
