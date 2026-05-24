import { useCallback, useRef, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { validateFile } from "../utils/helpers.js";

/**
 * Props:
 *   onFiles  (File[]) => void   — called with validated files
 *   disabled boolean            — disables interaction
 */
export default function DropZone({ onFiles, disabled = false }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handle = useCallback((files) => {
    if (!files.length) return;
    const valid = [];
    for (const f of files) {
      const { ok, error } = validateFile(f);
      if (ok) valid.push(f);
      else    toast.error(error);
    }
    if (valid.length) onFiles(valid);
  }, [onFiles]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    handle(Array.from(e.dataTransfer.files));
  }, [disabled, handle]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }, [disabled]);

  return (
    <div
      id="drop-target"
      role="button"
      tabIndex={0}
      aria-label="File drop zone — click or drop files here"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={e => e.key === "Enter" && !disabled && inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      className={clsx(
        "relative flex flex-col items-center justify-center min-h-[220px]",
        "rounded-2xl border-2 border-dashed transition-all duration-200",
        "cursor-pointer select-none",
        dragging && !disabled
          ? "border-blue-400 bg-blue-500/8 scale-[1.01]"
          : disabled
            ? "border-surface-600 opacity-60 cursor-not-allowed"
            : "border-surface-600 hover:border-slate-500 hover:bg-surface-800/40",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={e => handle(Array.from(e.target.files))}
        disabled={disabled}
      />

      {/* Icon */}
      <div className={clsx(
        "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4",
        "bg-surface-700 transition-transform duration-200",
        dragging && "scale-110",
      )}>
        {dragging ? "📂" : "📤"}
      </div>

      <p className="text-base font-semibold text-slate-200">
        {dragging ? "Release to send!" : "Drop files here"}
      </p>
      <p className="text-sm text-slate-500 mt-1.5 text-center px-4">
        or <span className="text-blue-400">click to browse</span>
        &nbsp;· Images, PDFs, Videos, ZIPs, Documents &amp; more
      </p>
      <p className="text-xs text-slate-600 mt-2">Max 2 GB per file</p>

      {disabled && (
        <div className="absolute inset-x-4 bottom-4 flex justify-center">
          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
            ⏳ Waiting for another device to join…
          </span>
        </div>
      )}
    </div>
  );
}
