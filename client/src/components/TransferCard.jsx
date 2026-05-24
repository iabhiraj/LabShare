import clsx from "clsx";
import { fileIcon, formatBytes, formatSpeed } from "../utils/helpers.js";

const STATUS_LABEL = {
  connecting: { text: "Connecting…", cls: "text-slate-400 bg-surface-700" },
  sending   : { text: "Sending",     cls: "text-blue-400  bg-blue-500/10" },
  receiving : { text: "Receiving",   cls: "text-violet-400 bg-violet-500/10" },
  done      : { text: "Done ✓",      cls: "text-emerald-400 bg-emerald-500/10" },
  error     : { text: "Error",       cls: "text-red-400   bg-red-500/10" },
};

export default function TransferCard({ transfer }) {
  const { fileName, fileSize, progress, speed, status, direction } = transfer;
  const isDone  = status === "done";
  const isError = status === "error";
  const badge   = STATUS_LABEL[status] ?? STATUS_LABEL.connecting;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-600 bg-surface-800/60 animate-fade-in">
      {/* Icon */}
      <span className="text-2xl flex-shrink-0 leading-none" aria-hidden>
        {fileIcon(fileName)}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-sm font-medium text-slate-200 truncate" title={fileName}>
            {fileName}
          </p>
          <span className={clsx("text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", badge.cls)}>
            {badge.text}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden bg-surface-600">
          <div
            className={clsx(
              "h-full rounded-full transition-all duration-300",
              isDone   ? "bg-emerald-500" :
              isError  ? "bg-red-500" :
              "progress-shimmer"
            )}
            style={{ width: `${isDone ? 100 : progress}%` }}
          />
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] text-slate-500">
            {formatBytes(fileSize)} · {direction === "out" ? "↑ sending" : "↓ receiving"}
          </span>
          <span className="text-[11px] text-slate-500">
            {isDone
              ? "Complete"
              : isError
                ? "Transfer failed"
                : `${progress}%${speed > 0 ? ` · ${formatSpeed(speed)}` : ""}`}
          </span>
        </div>
      </div>
    </div>
  );
}
