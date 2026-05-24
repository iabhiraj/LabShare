import { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";
import clsx from "clsx";
import Button from "./Button.jsx";

export default function ChatDrawer({ open, onClose }) {
  const { messages, sendMessage, currentUser } = useSocket();
  const [text,     setText]     = useState("");
  const bottomRef               = useRef();

  // Scroll to newest message when drawer opens or new message arrives
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    sendMessage(t);
    setText("");
  };

  return (
    /* Overlay + drawer */
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={clsx(
          "fixed right-0 top-0 bottom-0 z-40 w-72 flex flex-col",
          "bg-surface-900 border-l border-surface-700 shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
          <h3 className="font-semibold text-slate-100">Room Chat</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="text-xs text-slate-600 text-center mt-10">
              No messages yet — say hello 👋
            </p>
          )}
          {messages.map(msg => {
            const isMe = msg.senderId === currentUser?.id;
            return (
              <div key={msg.id} className={clsx("flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
                <span className="text-[11px] text-slate-500 px-1">{isMe ? "You" : msg.senderName}</span>
                <div className={clsx(
                  "max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-snug",
                  isMe
                    ? "bg-blue-500 text-white rounded-br-sm"
                    : "bg-surface-700 text-slate-200 rounded-bl-sm",
                )}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-surface-700 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && submit()}
            placeholder="Type a message…"
            maxLength={500}
            className="flex-1 bg-surface-700 border border-surface-600 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
          />
          <Button size="sm" onClick={submit} aria-label="Send message">↑</Button>
        </div>
      </aside>
    </>
  );
}
