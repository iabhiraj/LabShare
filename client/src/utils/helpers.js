/** Format raw bytes into a human-readable string  e.g. 1536 → "1.5 KB" */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k     = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(decimals))} ${sizes[i]}`;
}

/** Format a bytes-per-second speed value */
export function formatSpeed(bps) {
  if (!bps || bps <= 0) return "";
  return `${formatBytes(bps)}/s`;
}

/** Return an emoji representing the file type */
export function fileIcon(name = "", mime = "") {
  const ext = name.split(".").pop().toLowerCase();
  const m   = mime.toLowerCase();
  if (m.startsWith("image/")  || /^(jpg|jpeg|png|gif|webp|svg|bmp|avif|heic)$/.test(ext)) return "🖼️";
  if (m.startsWith("video/")  || /^(mp4|mov|avi|mkv|webm|flv|m4v)$/.test(ext))            return "🎬";
  if (m.startsWith("audio/")  || /^(mp3|wav|ogg|flac|aac|m4a)$/.test(ext))                return "🎵";
  if (m === "application/pdf" || ext === "pdf")                                             return "📄";
  if (/^(zip|rar|7z|tar|gz|bz2|xz)$/.test(ext))                                           return "🗜️";
  if (/^(doc|docx)$/.test(ext))                                                            return "📝";
  if (/^(xls|xlsx|csv)$/.test(ext))                                                        return "📊";
  if (/^(ppt|pptx)$/.test(ext))                                                            return "📋";
  if (/^(js|ts|jsx|tsx|py|java|cpp|c|cs|go|rb|php|html|css|json|yaml|sh)$/.test(ext))    return "💻";
  return "📁";
}

/** Validate a file before attempting to transfer it */
export function validateFile(file) {
  const MAX_SIZE      = 2 * 1024 * 1024 * 1024; // 2 GB
  const BLOCKED_EXTS  = ["exe", "msi", "bat", "cmd", "com", "scr", "pif"];
  const ext           = file.name.split(".").pop().toLowerCase();

  if (file.size > MAX_SIZE)         return { ok: false, error: `File too large (max 2 GB): ${file.name}` };
  if (BLOCKED_EXTS.includes(ext))   return { ok: false, error: `File type not allowed: .${ext}` };
  return { ok: true };
}

/** Copy text to clipboard; returns true on success */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

/** Build the room join URL for the current origin */
export function roomUrl(code) {
  return `${window.location.origin}?room=${code}`;
}
