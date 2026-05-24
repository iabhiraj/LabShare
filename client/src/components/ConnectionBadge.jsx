import { useSocket } from "../context/SocketContext.jsx";

export default function ConnectionBadge() {
  const { connected } = useSocket();
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          connected
            ? "bg-emerald-400 animate-pulse-slow"
            : "bg-red-400"
        }`}
      />
      <span className="text-xs text-slate-500">
        {connected ? "Connected" : "Connecting…"}
      </span>
    </div>
  );
}
