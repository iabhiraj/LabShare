import { useQRCode } from "../hooks/useQRCode.js";
import { roomUrl } from "../utils/helpers.js";
import Button from "./Button.jsx";

export default function QRModal({ roomCode, onClose }) {
  const dataUrl = useQRCode(roomCode);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface-900 border border-surface-700 rounded-2xl p-6 text-center shadow-2xl w-64 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-bold text-lg text-slate-100 mb-1">Scan to Join</h3>
        <p className="text-sm text-slate-400 mb-4 font-mono">{roomCode}</p>

        {dataUrl
          ? <img src={dataUrl} alt={`QR code for room ${roomCode}`} className="w-48 h-48 rounded-xl mx-auto" />
          : <div className="w-48 h-48 rounded-xl mx-auto bg-surface-700 animate-pulse" />
        }

        <p className="text-[11px] text-slate-600 mt-3 break-all px-2">
          {roomUrl(roomCode)}
        </p>

        <Button variant="ghost" size="sm" full onClick={onClose} className="mt-4">
          Close
        </Button>
      </div>
    </div>
  );
}
