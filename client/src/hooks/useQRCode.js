import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { roomUrl } from "../utils/helpers.js";

/**
 * Generates a QR code data-URL for the given room code.
 * Returns null until the code is ready.
 */
export function useQRCode(roomCode) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!roomCode) { setDataUrl(null); return; }

    QRCode.toDataURL(roomUrl(roomCode), {
      width  : 220,
      margin : 2,
      color  : { dark: "#0a1020", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setDataUrl)
      .catch(console.error);
  }, [roomCode]);

  return dataUrl;
}
