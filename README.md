# 🚀 LabShare

> **Instant P2P file sharing for computer labs, classrooms, and local networks.**
> Zero install · No accounts · No permanent storage · Files go browser-to-browser via WebRTC

---

## 📁 Project Structure

```
labshare/
├── package.json            ← root scripts (run both together with concurrently)
├── render.yaml             ← Render.com deployment config (backend)
│
├── server/
│   ├── index.js            ← Express + Socket.IO signaling server
│   ├── package.json
│   └── .env.example
│
└── client/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── vercel.json         ← Vercel deployment config (frontend)
    ├── .env.example
    └── src/
        ├── main.jsx        ← React entry point
        ├── App.jsx         ← Root component + URL ?room= handling
        ├── index.css       ← Tailwind + global styles
        ├── context/
        │   └── SocketContext.jsx   ← All socket, room, WebRTC, transfer state
        ├── pages/
        │   ├── HomePage.jsx        ← Landing: create/join room
        │   └── RoomPage.jsx        ← Room: drop zone, users, chat, transfers
        ├── components/
        │   ├── Button.jsx
        │   ├── ChatDrawer.jsx
        │   ├── ConnectionBadge.jsx
        │   ├── DropZone.jsx
        │   ├── QRModal.jsx
        │   ├── TransferCard.jsx
        │   └── UserList.jsx
        ├── hooks/
        │   └── useQRCode.js
        └── utils/
            └── helpers.js
```

---

## ⚡ Quick Start (Local Development)

### Prerequisites
- **Node.js** v18 or later — https://nodejs.org
- **npm** v9 or later

### 1. Install all dependencies

```bash
# From the root labshare/ directory
npm run install:all
```

This runs `npm install` in root, `client/`, and `server/`.

### 2. Start both servers together

```bash
npm run dev
```

Or start them individually:

```bash
# Terminal 1 — backend (http://localhost:4000)
cd server && npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd client && npm run dev
```

### 3. Open and test

1. Open **http://localhost:5173** in two browser windows (or two machines on the same network)
2. On **Window A** → click **Create Room**
3. On **Window B** → click **Join Room**, enter the code
4. Drag a file onto the drop zone in Window A to send it to Window B

---

## 🌐 Deployment

### Backend → Render.com

1. Push the repo to GitHub
2. Go to https://render.com → **New Web Service**
3. Connect your repo, set **Root Directory** to `server`
4. Build command: `npm install`
5. Start command: `node index.js`
6. Add environment variables:
   ```
   NODE_ENV=production
   CLIENT_ORIGINS=https://your-app.vercel.app
   ```
7. Deploy — note your service URL, e.g. `https://labshare-server.onrender.com`

Alternatively, use the included `render.yaml` for Blueprint deployment.

### Frontend → Vercel

1. Go to https://vercel.com → **New Project** → import your repo
2. Set **Root Directory** to `client`
3. Add Environment Variable:
   ```
   VITE_SERVER_URL=https://labshare-server.onrender.com
   ```
4. Deploy — Vercel auto-detects Vite; the `vercel.json` handles SPA routing

### Railway (alternative backend host)

```bash
cd server
railway login
railway init
railway up
railway variables set CLIENT_ORIGINS=https://your-app.vercel.app
```

---

## 🔒 Security

| What | How |
|---|---|
| **Files never stored** | Server only relays tiny JSON signals. File bytes travel P2P via WebRTC DataChannels. |
| **Room expiry** | Rooms auto-delete after 30 min of inactivity |
| **Input sanitization** | All text stripped of `<>` before broadcast |
| **Rate limiting** | 120 API requests / 15 min per IP |
| **Helmet** | HTTP security headers on all responses |
| **Room capacity** | Max 20 devices per room |
| **File validation** | Client blocks `.exe`, `.bat`, etc. and files > 2 GB |

---

## 📡 Architecture

```
Browser A                    Server (Node.js)              Browser B
    │                              │                            │
    │─── room:create ─────────────►│                            │
    │◄── room:created ─────────────│                            │
    │                              │◄── room:join ──────────────│
    │◄── room:user-joined ─────────│──► room:joined ────────────►│
    │                              │                            │
    │─── webrtc:offer ────────────►│──► webrtc:offer ───────────►│
    │◄── webrtc:answer ────────────│◄── webrtc:answer ───────────│
    │─── webrtc:ice-candidate ────►│──► webrtc:ice-candidate ───►│
    │                              │                            │
    │◄══════════ Direct P2P RTCDataChannel (file bytes) ════════►│
```

The server is a **pure signaling relay** — it exchanges offer/answer/ICE candidates so browsers can locate each other and open a direct connection. Once that connection is established, file data travels entirely peer-to-peer with no server involvement.

---

## 🧩 Features

| Feature | Details |
|---|---|
| Room codes | Format `LAB-XXXX`, randomly generated, collision-free |
| Multiple users | Up to 20 devices per room |
| File transfer | Drag-and-drop or click-to-browse; progress + speed display |
| Chat | Real-time in-room text chat via Socket.IO |
| Clipboard share | Broadcast clipboard text to all room members |
| QR code | Scan to join from mobile (generated client-side) |
| Theme | Dark/light toggle |
| Notifications | Toast alerts for joins, leaves, completions |
| Auto-cleanup | Empty or idle rooms deleted automatically |

---

## 📄 License

MIT — free to use, modify, and self-host.
