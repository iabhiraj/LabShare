import { useEffect } from "react";
import { SocketProvider, useSocket } from "./context/SocketContext.jsx";
import HomePage from "./pages/HomePage.jsx";
import RoomPage from "./pages/RoomPage.jsx";

function AppInner() {
  const { room, joinRoom } = useSocket();

  // Auto-join if URL contains ?room=LAB-XXXX (e.g. from QR scan)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get("room");
    if (code && !room) {
      // Brief delay lets the socket finish connecting
      const t = setTimeout(() => joinRoom(code.toUpperCase()), 700);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return room ? <RoomPage /> : <HomePage />;
}

export default function App() {
  return (
    <SocketProvider>
      <AppInner />
    </SocketProvider>
  );
}
