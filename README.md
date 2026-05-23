# 🚀 LabShare

> **Instant file sharing for computer labs, classrooms, and local networks.**
> Zero install · No accounts · No permanent storage · P2P via WebRTC

---

## ✨ Features

| Feature | Details |
|---|---|
| 🏠 **Room System** | Generate unique room codes (e.g. `LAB-2387`) |
| 📤 **File Transfer** | Drag-and-drop, P2P via WebRTC DataChannels |
| ⚡ **Real-time** | Socket.IO for signaling and presence |
| 💬 **Chat** | In-room text chat panel |
| 📋 **Clipboard** | Share clipboard text across devices |
| 📱 **QR Code** | Scan to join a room from mobile |
| 🌙 **Dark/Light** | Theme toggle |
| 🔒 **Private** | Rooms auto-expire after 30min inactivity |
| 🚫 **No storage** | Files never touch the server; transferred P2P |

---

## 🗂 Project Structure

```
labshare/
├── server/              # Node.js + Express + Socket.IO backend
│   ├── index.js         # Main server (rooms, signaling, chat)
│   └── package.json
│
├── client/              # React + Tailwind CSS frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.jsx                    # Root component
│   │   ├── index.jsx                  # Entry point
│   │   ├── index.css                  # Global styles
│   │   ├── context/
│   │   │   └── SocketContext.jsx      # Socket + WebRTC state
│   │   ├── components/
│   │   │   ├── HomePage.jsx           # Landing / create-join UI
│   │   │   └── RoomPage.jsx           # Room UI (drop zone, users, chat)
│   │   ├── hooks/
│   │   │   └── useQRCode.js           # QR code generator hook
│   │   └── utils/
│   │       └── helpers.js             # formatBytes, validateFile, etc.
│   ├── package.json
│   └── tailwind.config.js
│
└── README.md
```

---

## 🛠 Installation & Running

### Prerequisites
- **Node.js** v18+ (https://nodejs.org)
- **npm** v9+

### Step 1 — Install dependencies

```bash
# Backend
cd labshare/server
npm install

# Frontend
cd ../client
npm install
```

### Step 2 — Start the backend

```bash
cd labshare/server
npm run dev       # Development (nodemon auto-reload)
# or
npm start         # Production
```

Server runs on **http://localhost:4000**

### Step 3 — Start the frontend

```bash
cd labshare/client
npm start
```

Frontend runs on **http://localhost:3000** and proxies API calls to port 4000.

### Step 4 — Open on multiple devices

For local network use (lab computers sharing a network):

1. Find your machine's local IP:
   - macOS/Linux: `ifconfig | grep "inet "`
   - Windows: `ipconfig`

2. Set the `REACT_APP_SERVER_URL` env var to your IP:
   ```bash
   REACT_APP_SERVER_URL=http://192.168.1.100:4000 npm start
   ```

3. On other devices, open `http://192.168.1.100:3000`

---

## 🌐 Environment Variables

### Server (`server/.env`)
```
PORT=4000
CLIENT_URL=http://localhost:3000
```

### Client (`client/.env`)
```
REACT_APP_SERVER_URL=http://localhost:4000
```

---

## 🔒 Security Notes

- Files are **never stored on the server**. The server only handles Socket.IO signaling (room management, WebRTC offer/answer/ICE exchange). All file data travels directly between browsers via WebRTC DataChannels.
- Rooms auto-delete after **30 minutes of inactivity**.
- Room capacity is limited to **20 devices**.
- Text input is sanitized to prevent XSS.
- Rate limiting (100 req / 15 min) on API endpoints.
- File size limit: **2GB per file**.

---

## 📡 Architecture

```
Browser A                  Server (Node.js)              Browser B
   |                            |                            |
   |──── socket: room:create ──►|                            |
   |◄─── room:created ──────────|                            |
   |                            |◄── socket: room:join ──────|
   |◄─── room:user-joined ──────|───► room:joined ───────────►|
   |                            |                            |
   |──── webrtc:offer ─────────►|──── webrtc:offer ─────────►|
   |◄─── webrtc:answer ─────────|◄─── webrtc:answer ─────────|
   |──── webrtc:ice ────────────►────── webrtc:ice ──────────►|
   |                            |                            |
   |◄═══════════ Direct P2P WebRTC DataChannel ══════════════►|
   |                   (file data flows here)                 |
```

---

## 🚀 Deployment

### Docker (Recommended)

```dockerfile
# server/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 4000
CMD ["node", "index.js"]
```

```bash
docker build -t labshare-server ./server
docker run -p 4000:4000 labshare-server
```

### Deploy frontend to Vercel/Netlify

```bash
cd client
npm run build
# Upload the /build folder to your static host
```

---

## 📄 License

MIT — free to use, modify, and deploy in your lab or classroom.
