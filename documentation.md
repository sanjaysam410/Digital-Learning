# Vidya Setu - Project Review Briefing

This document serves as a high-level summary and technical deep-dive of the Vidya Setu project, designed to help you explain the core concepts, architecture, and specific implementation details during your external project review.

---

## 1. The Problem Statement
Students in rural areas (such as Nabha, Punjab) face a significant digital divide. They often lack reliable, high-speed internet connectivity and use low-end mobile devices. This restricts their access to quality digital education, interactive assessments, and real-time classroom collaboration.

## 2. Our Solution: Vidya Setu
**Vidya Setu** is a localized, **offline-first digital learning platform**. It bridges the digital divide by allowing students to download lessons, learn, and take quizzes entirely offline. It not only covers standard academic curriculum but also includes **digital literacy modules** to ensure holistic rural-urban equality. For teachers, it acts as a powerful real-time classroom management tool equipped with **data-driven instructional analytics** and automated content optimization. 

---

## 3. Core Innovations & Technical Implementations

To present your project effectively, highlight these major technical achievements and exactly *how* they are built under the hood:

### A. Edge-to-Cloud Offline Sync Engine
- **Data Interception:** We use **Vite PWA** with **Workbox** to implement specific caching strategies (e.g., Network First for APIs, Cache First for media, StaleWhileRevalidate for UI assets).
- **Offline Queuing:** If a student is offline, POST/PUT requests (like quiz submissions or progress updates) are caught and stored as JSON objects `{ method, url, body }` inside **IndexedDB** (using the lightweight `idb` library) under a `syncQueue` object store.
- **Replay Mechanism:** The app continuously monitors connectivity using a combination of the browser's `navigator.onLine`, the **Capacitor Network plugin**, and a manual backend health-check ping. Once online, a custom `flushQueue()` algorithm uses **Axios** to replay all queued requests back to the Node.js server.
- **Conflict Resolution:** If a sync creates a conflict (e.g., the server returns an HTTP 409 duplicate status), the queued item is gracefully dropped. If a network error occurs during sync, it retries up to 3 times before discarding.

### B. Video Storage, Display & Downloading
- **Downloading & Offline Storage:** When a user chooses to download a video for offline viewing, the frontend uses the JavaScript `fetch()` API to download the entire video as a raw **Blob**. This Blob is saved directly into an **IndexedDB** store named `offlineVideos` alongside its file size and lesson reference ID.
- **Offline Playback:** When playing a downloaded video without internet, the app retrieves the Blob from IndexedDB and converts it into a local, temporary URL stream using `URL.createObjectURL(blob)`.
- **Displaying:** Videos are rendered efficiently in the UI using the `react-player` component, which is configured to seamlessly support both standard Cloudinary cloud URLs and our locally generated IndexedDB Blob URLs.

### C. Automated Asynchronous Video Upload Pipeline
- **Initial Upload:** Teachers upload raw video files via the frontend. The Express backend receives these using the **Multer** middleware, saving them temporarily to a local disk folder (`/public/uploads/raw`).
- **Background Processing:** To prevent heavy video encoding from blocking the main Node.js event loop (which would freeze the whole server), the processing task is passed to **`better-queue`**. 
- **Compression (Up to 80% Size Reduction):** Inside the queue worker, **`fluent-ffmpeg`** is used to drastically reduce file sizes—**shrinking raw media by up to 80%**. Videos are scaled to a mobile-friendly 480p resolution, re-encoded using `libx264` (CRF 28) and `AAC` audio, and the `faststart` flag is applied to enable instant 2G/3G web streaming without waiting for the whole file to download.
- **Cloud Offloading:** The compressed video is then automatically uploaded to **Cloudinary** via its Node SDK. The local raw and compressed temp files are immediately deleted from the server, and a real-time Socket event (`video:compressed`) notifies the frontend that processing is complete.

### D. Real-Time Classroom Ecosystem
- **WebSockets:** Powered entirely by **Socket.IO**. The Node.js server acts as a WebSocket hub attached to the Express HTTP server.
- **Rooms Mechanism:** When a class starts, students and teachers join a specific Socket Room based on their `roomId`. 
- **Features:** This architecture enables real-time presence tracking (`presence:join`), instant live chat (`chat:send`), and live broadcast quizzes. 
- **Dual-Write Architecture:** When a chat message is sent, the Node server instantly broadcasts it to the room via Socket.IO for zero-latency UI updates, while simultaneously executing an asynchronous Mongoose query to persist the message into MongoDB for future retrieval.

### E. Authentication & Security
- **Stateless Sessions:** Users are authenticated via standard **JWT (JSON Web Tokens)** generated by `jsonwebtoken` and attached as Bearer tokens to Axios request headers.
- **OTP Verification:** For secure registration, we use a MongoDB-backed OTP system. A random 6-digit code is generated and saved in an `OTP` collection with a MongoDB **TTL (Time-To-Live) index** that auto-deletes the document exactly 5 minutes after creation. The code is delivered via email using **Nodemailer** (connected to an SMTP server like Gmail).

---

## 4. High-Level Architecture Flow

1. **Tier 1: Edge (The Student's Device)**
   - Utilizes `IndexedDB` (`syncQueue` and `offlineVideos` stores) as the absolute source of truth when disconnected from the internet.
   - `localStorage` is used for lightweight session and user profile caching to prevent rendering blank screens on load.
2. **Tier 2: Synchronization (The Bridge)**
   - Managed entirely by the Service Worker (`sw.js`) and a custom React Context (`SyncContext`) that listens for network changes.
3. **Tier 3: Cloud (The Server)**
   - **Express.js** handles standard REST requests and middleware pipelines (like JWT verification and role checking).
   - **MongoDB Atlas** serves as the primary database, strictly typed and validated using **Mongoose ODMs**. The architecture is rigorously modeled into modular entities (`School`, `User`, `Lesson`, `Progress`, `Quiz`, and `Message`) to guarantee system scalability and maintainability.
   - **Socket.IO** manages all real-time bidirectional states.

---

## 5. Technology Stack Highlight

- **Frontend Core:** React.js 18, Vite, Tailwind CSS.
- **Frontend PWA & Offline:** Vite PWA Plugin, Workbox, IndexedDB (`idb` library).
- **Backend Core:** Node.js (v20+), Express.js.
- **Database:** MongoDB Atlas with Mongoose ODM.
- **Real-Time:** Socket.IO.
- **Media Processing:** Multer (upload), FFmpeg (compression), `better-queue` (job management), Cloudinary (storage).
- **Mobile Wrapper:** Capacitor for generating the Android APK.
- **Authentication:** JWT, bcryptjs, Nodemailer (Email OTP).

---

## 6. Additional Technical Highlights

- **Resilient Database Reconnection:** To handle unstable server environments, the database configuration (`db.js`) features a custom auto-polling mechanism. If the MongoDB connection drops, the server doesn't crash; instead, it catches the error and retries the connection every 10 seconds until restored.
- **Gamification Engine:** The system is designed with student engagement in mind. The data models seamlessly track `totalPoints` and award `badges` upon successful quiz completions, even calculating them during offline syncs.
- **Multilingual Data Structure:** Keeping the rural Punjab demographic in mind, the data models and schemas are explicitly structured to support content delivery in English, Punjabi, and Hindi.
- **Mobile-First UI Optimization:** Built using **Tailwind CSS**, the interface is completely fluid. It is specifically optimized to render perfectly on low-end Android smartphones while intelligently expanding into complex analytical dashboards on teacher desktops.

---

## 7. Feature-to-Implementation Mapping

If the examiner asks *how* a specific feature was built, use this quick-reference mapping:

| **Implemented Feature** | **Implementation Method / Technology Used** |
|-------------------------|---------------------------------------------|
| **Stateless User Authentication** | **JSON Web Tokens (JWT)** attached to HTTP headers, verified via custom Express middleware. |
| **Registration & Secure OTP** | **Nodemailer** for email delivery paired with **MongoDB TTL Indexes** for auto-expiring OTP codes after 5 minutes. |
| **Role-Based Access Control (RBAC)** | Custom Express middleware (`role.middleware.js`) evaluating `req.user.role` (Student, Teacher, Admin). |
| **Offline Data Persistence** | **IndexedDB** managed through the `idb` wrapper library (to securely bypass the 5MB `localStorage` size limit). |
| **Network State Detection** | **Capacitor Network Plugin** (for native Android) combined with browser `navigator.onLine` and manual API health-check pings. |
| **Live Chat & Presence Tracking** | **Socket.IO** rooms (`roomId`), achieving bidirectional, sub-500ms latency without HTTP polling overhead. |
| **Video Compression Pipeline** | **fluent-ffmpeg** executing server-side shell commands managed by **better-queue** to avoid blocking the single-threaded Node.js event loop. |
| **Teacher Dashboard Analytics** | The **Recharts** React library rendering SVG-based data visualizations from aggregated MongoDB query data. |
| **PWA App Shell & Caching** | **Vite PWA Plugin** mapping directly to **Workbox** routing strategies (e.g., Network First, Cache First). |
| **Multi-Language Content Logic** | Mongoose Schema ENUM validation (`English`, `Punjabi`, `Hindi`) enforcing standardized UI and database mappings. |
| **System Announcements** | Real-time **Socket.IO** broadcast events coupled with a persistent Mongoose `Notification` schema. |

---

## 8. Recommended Demo Flow for External Review

If you are asked to demonstrate the project, follow this impressive sequence:

1. **The Offline Sync Demo:**
   - Log in as a student.
   - Disconnect the internet (turn off Wi-Fi/Data).
   - Watch an offline video (rendered from an IndexedDB Blob URL) and submit a quiz. Show that the UI updates perfectly.
   - Turn the internet back on. Show the network tab or console where the `flushQueue()` script successfully replays the queued Axios requests to the database in the background.
2. **The Video Pipeline Demo:**
   - Log in as a teacher and upload a raw video file. 
   - Explain how Multer hands the file to `better-queue`, which uses FFmpeg to shrink it to 480p in the background without freezing the server. Show the final optimized Cloudinary URL.
3. **The Real-Time Classroom Demo:**
   - Open two browser windows side-by-side (Teacher on left, Student on right).
   - Send chat messages to demonstrate the Socket.IO dual-write broadcast (updates UI instantly, saves to DB in background).
   - Push a "Live Quiz" from the teacher side and watch it immediately pop up on the student's screen via WebSockets.
