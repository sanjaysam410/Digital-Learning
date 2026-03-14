# Vidya Setu — Project Documentation

**Digital Learning Platform for Rural School Students (Nabha, Punjab)**  
*SIH2025 · Problem Statement ID: SIH25019 · Matrusri Engineering College, Team 3*

This document covers workflow and pipeline, architecture, tech stack, and a comparison with similar existing applications.

---

## 1. Workflow & Pipeline Information

### 1.1 High-Level User Workflows

| Workflow | Steps | Components Involved |
|----------|--------|----------------------|
| **Student learning** | Login → Home → Lessons → Watch/Read → Progress saved (online/offline) → Sync when online | Auth, REST API, IndexedDB, Sync Queue, Service Worker |
| **Teacher class** | Login → Overview → Start class → Live presence/chat → Launch quiz → View analytics | Socket.IO (presence, chat, quiz), REST (lessons, users) |
| **Content creation** | Teacher uploads file → Video: queue compression → FFmpeg → Cloudinary → Lesson saved | Upload API, better-queue, videoCompressor, Cloudinary |
| **Offline sync** | User goes offline → Actions queued in IndexedDB → User back online → `flushQueue()` → REST replay → Conflict resolution | IndexedDB, syncQueue, REST, 409 handling |

### 1.2 Video Upload & Compression Pipeline

```
Teacher (Frontend)                Backend                           Cloud
      |                              |                                |
      |  POST /api/upload (file)     |                                |
      |------------------------------>|                                |
      |                              |  Multer → save to /raw          |
      |                              |  If video: addCompressionJob()  |
      |                              |  better-queue → FFmpeg          |
      |                              |  (scale 480p, CRF 28, AAC 64k)  |
      |                              |--------------------------------->|  Cloudinary upload
      |                              |  Delete local raw/compressed    |
      |  Socket: video:compressed    |<---------------------------------|
      |<-----------------------------|  (optional: video:compression_error)
      |  (compressedUrl)             |                                |
```

- **Queue**: `better-queue` for serialized compression jobs.
- **Compression**: `fluent-ffmpeg` (libx264, scale -2:480, AAC 64k, faststart).
- **Storage**: Compressed file uploaded to **Cloudinary** (`vidya-setu/lessons`), then local files deleted.
- **Status**: `GET /api/upload/status/:filename` or real-time Socket event `video:compressed` / `video:compression_error`.

### 1.3 Offline Sync Pipeline (Edge-to-Cloud)

```
Device (Student)                    Service Worker / App              Cloud (MongoDB)
      |                                    |                                |
  [Action: e.g. progress update]           |                                |
      |                                    |  Offline? → enqueue(idb)        |
      |----------------------------------->|  Online?  → POST /api/...       |
      |                                    |-------------------------------->|
  [Reconnect]                              |  online event → flushQueue()    |
      |                                    |  For each queue item:           |
      |                                    |    REST replay → delete from IDB |
      |                                    |  409 Conflict → skip (no retry) |
      |                                    |-------------------------------->|
```

- **Queued actions**: Progress update, quiz submit, badge earned, chat message, lesson complete.
- **Conflict resolution**: Progress = take higher %; Quiz = skip if 409; Messages = client timestamp; Badges = idempotent.

### 1.4 Real-Time Event Pipeline (Socket.IO)

- **Presence**: `presence:join` / `presence:leave` → `presence:user_joined` / `presence:user_left` → `presence:online_count`.
- **Chat**: `chat:send` → server persists to MongoDB (if connected) → `chat:message` broadcast to room; typing indicators; teacher: delete, mute, pin.
- **Live quiz**: `quiz:start` → `quiz:started`; `quiz:answer` / `quiz:submit` → `quiz:answer_received` / `quiz:submission_received`; `quiz:end` → `quiz:ended`; `quiz:request_results` → `quiz:results`.
- **Class control**: `class:start` / `class:end` / `class:announce` → broadcast to room.
- **Progress**: `progress:update` / `student_progress` → `update_teacher_dashboard` in same room.

---

## 2. Architecture Names & Details

### 2.1 Edge-to-Cloud Synchronized Learning Ecosystem

- **What it is**: Local-first design where the “edge” is the student/teacher device (and optionally school LAN). Data is created and stored locally when offline, then synchronized to the cloud when connectivity is available.
- **Details**:  
  - **Edge**: IndexedDB (lessons, progress, sync queue, messages, user), Service Worker (cache + intercept), and app UI.  
  - **Cloud**: Node/Express REST API + Socket.IO server, MongoDB Atlas, Cloudinary (media).  
  - **Sync**: Async queue (replay on `online`), optional nightly batch, conflict rules (e.g. higher progress wins, 409 = skip).

### 2.2 Three-Tier Offline Sync Architecture (from spec)

- **Tier 1 — Device (IndexedDB)**: Stores lesson JSON, progress records, sync queue, recent chat, user profile. Single source of truth when offline.
- **Tier 2 — Background Sync**: Service Worker + `flushQueue()` on reconnect; retries with attempt limit (e.g. 3); failed items can be logged.
- **Tier 3 — Cloud (MongoDB Atlas)**: Authoritative store when online; receives replayed updates and serves lessons/media.

*Optional future: P2P mesh between devices on the same LAN for classroom sync without internet.*

### 2.3 P2P Mesh Networking (Planned / Phase 5)

- **What it is**: Local-first, peer-to-peer layer so that within school premises (same Wi‑Fi/hotspot), students and teachers can sync progress, run live quizzes, and chat without the main internet.
- **Details**:  
  - Teacher device acts as a **local coordinator** (not a full server).  
  - WebRTC DataChannels for peer-to-peer data.  
  - Discovery/signaling: QR code (local IP + SDP) or mDNS (e.g. `vidyasetu-teacher.local`).  
  - Data synced: lessons, progress, quiz Q&A, chat. When internet returns, teacher device can push aggregated data to MongoDB Atlas.

### 2.4 Client–Server Real-Time Architecture

- **What it is**: Single Node.js process runs both HTTP (Express) and WebSocket (Socket.IO) server; clients attach with JWT (e.g. in `auth.token`); rooms are used for class/chat (e.g. by `roomId`).
- **Details**:  
  - **Server**: `http.createServer(app)` + `new Server(server, cors)`; Socket.IO handles presence, chat, quiz, class control, progress relay, and sync handshake (`sync:request` / `sync:data` / `sync:acknowledge`).  
  - **Client**: Socket.IO client (WebSocket with polling fallback for weak networks); React context/hooks for socket instance and event binding.

### 2.5 Caching & PWA Architecture

- **App shell**: Cache-first (precache via Workbox) for index.html, JS, CSS, icons.
- **Lesson API**: Network-first with cache fallback (e.g. 5s timeout) for `/api/lessons`.
- **Lesson media**: Cache-first for video/PDF URLs (e.g. S3/Cloudinary).
- **Offline**: Service Worker intercepts requests; when offline, API calls are queued and replayed on reconnect (see Offline Sync Pipeline above).

---

## 3. Tech Stack Summary

### 3.1 Frontend

| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | React 18.x | UI components, PWA-friendly SPA |
| **Build** | Vite 7.x | Fast dev server and production build |
| **Styling** | Tailwind CSS 3.x | Utility-first, mobile-first, small bundle |
| **PWA** | vite-plugin-pwa, Workbox (workbox-window 7.x) | Service Worker, precache, runtime caching |
| **Offline DB** | IndexedDB via idb 8.x | Lessons, progress, sync queue, messages, user |
| **Real-time** | Socket.IO Client 4.x | Live chat, presence, quiz, class control |
| **HTTP** | Axios 1.x | REST with JWT interceptor, retry |
| **Routing** | React Router DOM 6.x | SPA routes |
| **Charts** | Recharts 3.x | Teacher analytics |
| **Media** | React Player 3.x | Video lessons (lazy-loaded) |
| **Mobile** | Capacitor 8.x (Android) | Native Android APK wrapper |
| **Icons** | Lucide React | Lightweight icon set |

*Spec also mentions: i18next for EN/Punjabi/Hindi; Firebase Auth for phone OTP (client). Current frontend package.json uses JWT + backend auth.*

### 3.2 Backend

| Category | Technology | Purpose |
|----------|------------|---------|
| **Runtime** | Node.js (20 LTS) | Server runtime |
| **Framework** | Express 4.x | REST API, middleware, static files |
| **Real-time** | Socket.IO 4.x | WebSockets, rooms, events |
| **Database** | MongoDB Atlas | Primary data store |
| **ODM** | Mongoose 8.x | Schemas, validation, queries |
| **Auth** | JWT (jsonwebtoken), bcryptjs | Login, roles, password hashing |
| **File handling** | Multer 2.x | Upload to local disk (raw) |
| **Video** | fluent-ffmpeg | Encode (libx264, AAC, 480p) |
| **Job queue** | better-queue | Serialized compression jobs |
| **Cloud storage** | Cloudinary 2.x | Video/PDF/image upload after compression |
| **Env** | dotenv | Environment variables |
| **CORS** | cors | Cross-origin requests |

*Spec also mentions: Redis (Upstash) for cache/sessions; Firebase Admin for phone verification; helmet, compression, rate limiting.*

---

## 4. Similar Existing Apps & Differentiations

### 4.1 Kolibri (Learning Equality)

- **What it is**: Open-source offline-first platform for low-resource and offline contexts (e.g. rural schools, refugee camps). Content is distributed via Kolibri Studio; runs on a local server (e.g. Raspberry Pi) and devices connect to it.
- **Differentiation**:  
  - **Vidya Setu** runs as a **PWA + optional Android app** on each student/teacher device with **per-device IndexedDB** and direct **cloud sync** when online; no in-school server required.  
  - **Vidya Setu** emphasizes **real-time classroom** (live presence, chat, live quizzes, teacher dashboard) and **teacher-as-coordinator** with Socket.IO.  
  - **Vidya Setu** targets **Nabha (Punjab)** with **multilingual (EN/Punjabi/Hindi)** and **4GB RAM Android** optimization; planned **P2P mesh** is device-to-device on LAN, not a central Kolibri server.

### 4.2 MOLEAP (Modular Offline Learning Education Assessment Platform)

- **What it is**: Offline-focused platform for areas with poor connectivity and power issues; runs from USB/Linux; includes Moodle, office tools, and two-way sync when online.
- **Differentiation**:  
  - **Vidya Setu** is **web/PWA + native Android** (no USB boot or full Linux stack).  
  - **Vidya Setu** is **cloud-centric when online** (MongoDB Atlas, Cloudinary) with **edge sync from devices**, not a Moodle-centric LMS.  
  - **Vidya Setu** adds **real-time collaboration** (Socket.IO) and **video compression pipeline** (FFmpeg → Cloudinary) for teacher-created content.

### 4.3 Zaya ClassCloud (Zaya Learning Labs)

- **What it is**: Plug-and-play hardware that streams lessons to many students without internet; 4-hour battery, solar option; Grades 1–5, English/Math/EVS; gamification and progress tracking.
- **Differentiation**:  
  - **Vidya Setu** is **software-only** (no custom hardware); works on existing phones/laptops.  
  - **Vidya Setu** supports **teacher-generated content** (lesson builder, quiz builder, upload + compress video) and **live class features** (presence, chat, live quiz).  
  - **Vidya Setu** syncs **per-student progress to the cloud** and supports **offline-on-device** learning with zero-loss sync, rather than only local streaming from one device.

### 4.4 LearniX (e.g. KrishGuru, PaisaPal)

- **What it is**: Offline AI mentor (KrishGuru), multilingual, edge AI; financial literacy and assessments; sync when online.
- **Differentiation**:  
  - **Vidya Setu** focuses on **structured curriculum, lessons, and quizzes** with **teacher and admin roles**, not primarily an AI mentor or financial literacy product.  
  - **Vidya Setu** emphasizes **classroom collaboration** (real-time presence, chat, live quiz) and **teacher dashboards/analytics**.  
  - **Vidya Setu** does not currently include **on-device AI**; it is a synchronous/asynchronous learning and assessment platform with offline-first data sync.

### 4.5 Summary Table

| Aspect | Vidya Setu | Kolibri | MOLEAP | Zaya ClassCloud | LearniX-style |
|--------|------------|---------|--------|------------------|----------------|
| **Deployment** | PWA + Android, no server in school | Local server (e.g. RPi) | USB/Linux | Dedicated hardware | App/device |
| **Real-time class** | Yes (Socket.IO) | Limited | Moodle-based | Streaming only | Varies |
| **Teacher content** | Yes (upload, compress, assign) | Via Studio | Moodle | Preloaded | Varies |
| **Offline sync** | Per-device IDB → cloud | Server ↔ devices | Two-way sync | Local only | Edge sync |
| **Target** | Rural Nabha, 4GB RAM, EN/PA/HI | Global low-resource | Offline regions | India K–5 | India, AI/assessment |
| **P2P / mesh** | Planned (LAN, teacher as coordinator) | No | No | N/A | No |

---

## 5. References Inside the Project

- **Spec index**: `nabha/00_INDEX.md`  
- **Architecture diagram (Mermaid)**: `nabha/diagrams/architecture_diagram.md`  
- **Tech stack detail**: `nabha/03_TECH_STACK.md`  
- **Offline sync**: `nabha/31_OFFLINE_SYNC_ENGINE.md`, `nabha/10_STUDENT_OFFLINE.md`  
- **P2P mesh**: `nabha/33_P2P_MESH.md`  
- **Socket events**: `nabha/30_SOCKETIO_EVENTS.md`  
- **Service Worker**: `nabha/32_SERVICE_WORKER.md`  
- **Backend entry**: `backend/server.js`  
- **Video pipeline**: `backend/services/videoCompressor.js`, `backend/routes/uploadRoutes.js`  
- **Frontend offline**: `frontend/src/offline/syncQueue.js`, `frontend/src/offline/videoCache.js` (or equivalent)

---

*Document generated for the Vidya Setu / Vidya Sahayak digital learning platform. For implementation details, see the `nabha/` specification files.*
