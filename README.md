# Vidya Setu - Digital Learning Platform

<div align="center">

![Vidya Setu](https://img.shields.io/badge/Vidya_Sahayak-Digital_Learning-blue)
![React](https://img.shields.io/badge/React-18.3.1-61dafb)
![Node.js](https://img.shields.io/badge/Node.js-23.2.0-339933)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248)
![License](https://img.shields.io/badge/License-MIT-green)

**Empowering Rural Students in Punjab with Accessible, Offline-First Education**

</div>

---

## 📖 About

**Vidya Setu** (विद्या सहायक / ਵਿਦਿਆ ਸਹਾਇਕ) is a comprehensive digital learning platform specifically designed for rural students in Punjab (e.g., Nabha). Developed as a solution for **SIH2025 (Problem Statement ID: SIH25019)**, it is built with a **mobile-first, offline-first** approach. The platform ensures that high-quality educational content, **digital literacy modules**, real-time collaboration, and assessments are accessible even on low-end devices with intermittent or limited internet connectivity.

---

## ✨ Key Features

- **Offline-First Workflow**: Uses IndexedDB to store lessons, quizzes, and progress locally. User actions are queued while offline and automatically synchronized when connectivity returns.
- **Real-Time Collaboration**: Socket.IO powered live presence, real-time chat, live quizzes, and synchronized teacher-student dashboards equipped with **data-driven instructional analytics**.
- **Automated Video Pipeline**: Teachers can upload heavy raw videos which are automatically queued, compressed using FFmpeg (shrinking media by **up to 80%** to 480p, optimized for 2G/3G mobile networks), and uploaded to Cloudinary.
- **Dual Authentication System**: Secure login using standard email/password (JWT) paired with an OTP verification system using Nodemailer and optional Firebase Auth.
- **Cross-Platform Delivery**: Functions as a Progressive Web App (PWA) in browsers and can be compiled into a native Android APK using Capacitor.
- **Interactive Assessments**: Real-time live quizzes and offline assignments with automated grading and progress tracking.

---

## 🛠 Technology Stack & Tools

### Frontend
- **Framework**: React 18.3.1 bootstrapped with Vite 7.x
- **Styling**: Tailwind CSS 3.x (Mobile-first responsive design)
- **Offline Storage**: IndexedDB (via `idb` 8.x) for offline caching of media, progress, and sync queues
- **PWA Capabilities**: `vite-plugin-pwa` with Workbox for advanced Service Worker strategies (Network First, Cache First, Stale While Revalidate)
- **Real-Time Communication**: `socket.io-client` 4.x
- **Media Playback**: `react-player` for lazy-loaded video lessons
- **Data Visualization**: `recharts` for teacher analytics and student progress charts
- **Mobile Wrapper**: Capacitor 8.x (`@capacitor/android`, `@capacitor/network`) for native Android APK generation

### Backend
- **Runtime Environment**: Node.js (v20+ / v23.x tested)
- **Web Framework**: Express 4.x
- **Real-Time Server**: Socket.IO 4.x
- **Database**: MongoDB Atlas with Mongoose 8.x ODM
- **Authentication**: JWT (`jsonwebtoken`), `bcryptjs`, and Firebase Admin SDK (`firebase-admin`)
- **Email/OTP Delivery**: Nodemailer 8.x
- **File Uploads**: Multer 2.x (for initial raw file handling)
- **Video Processing**: `fluent-ffmpeg` paired with `better-queue` for asynchronous, non-blocking media compression
- **Cloud Storage**: Cloudinary 2.x API for hosting compressed videos and PDFs

---

## 🏗 Architecture & Core Concepts

### 1. Edge-to-Cloud Synchronized Ecosystem
Vidya Setu operates on a rigorously modeled 3-tier offline sync architecture:
- **Tier 1 (Edge/Device)**: IndexedDB acts as the local source of truth. It stores downloaded lessons, user profiles, and queues actions (like quiz submissions or progress updates) when offline.
- **Tier 2 (Background Sync)**: A Service Worker intercepts requests. When connectivity drops, requests are saved to a Sync Queue. A robust network check (pinging the backend + Capacitor Network plugin) detects reconnection to trigger a `flushQueue()` operation.
- **Tier 3 (Cloud)**: MongoDB Atlas serves as the authoritative remote store. The backend is rigidly structured into distinct modular entities (`School`, `User`, `Lesson`, `Progress`, `Quiz`, `Message`) to maintain data integrity and resolve conflicts gracefully (e.g., keeping the highest progress percentage).

### 2. Video Upload & Compression Pipeline
To accommodate low-bandwidth areas, teacher-uploaded videos undergo an automated pipeline:
1. File uploaded via `POST /api/upload` (Multer saves raw file locally).
2. `better-queue` adds the job to a processing queue.
3. `fluent-ffmpeg` scales the video to 480p (libx264, CRF 28, AAC 64k) and applies `faststart` for web streaming.
4. The compressed file is pushed to Cloudinary.
5. Local temp files are deleted, and a real-time Socket event (`video:compressed`) notifies the teacher's dashboard.

### 3. Client-Server Real-Time Architecture
A single Node.js Express server is augmented with a Socket.IO instance to handle rooms (classes). Features include:
- **Presence**: `join_class` events track active users and update online counts.
- **Chat**: Real-time chat with typing indicators and teacher controls (mute all, delete, pin).
- **Live Quizzes**: Teachers push `quiz:start` events, and students respond with `quiz:answer`.

### 4. PWA Caching Strategies
The Service Worker utilizes multiple Workbox strategies:
- **Network First**: For API routes (`/api/lessons`, `/api/users`) to ensure fresh data, with cache fallback.
- **Cache First**: For heavy media (MP4, PDF) using `RangeRequestsPlugin`.
- **Stale While Revalidate**: For static assets, fonts, and icons.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20 or higher
- **npm**: v9 or higher
- **MongoDB**: Access to a MongoDB instance (e.g., Atlas)
- **FFmpeg**: Must be installed on the host machine for video processing.
  - *macOS*: `brew install ffmpeg`
  - *Linux*: `sudo apt-get install ffmpeg`
  - *Windows*: Download from the official FFmpeg site.

### 1. Clone the Repository
```bash
git clone <repository-url>
cd digital-learning-platform
```

### 2. Backend Setup
```bash
cd backend
npm install

# Create environment variables file
cp .env.example .env # Or manually create .env

# Start the development server (runs on port 5001)
npm run dev
```

### 3. Frontend Setup
```bash
# Open a new terminal
cd frontend
npm install

# Start the Vite development server (runs on port 5173)
npm run dev
```

---

## ⚙️ Environment Variables

### Backend (`/backend/.env`)
```env
NODE_ENV=development
PORT=5001
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/VidyaSetu
JWT_SECRET=your_super_secret_jwt_key

# Cloudinary (Media Storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (Nodemailer - Gmail App Password recommended)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Firebase Admin SDK (Optional - for enhanced auth)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### Frontend (`/frontend/.env`)
*No mandatory environment variables are required out of the box as it uses a dynamic configuration `config.js` that points to `http://localhost:5001` during local dev, but you can override:*
```env
VITE_API_URL=http://localhost:5001/api
VITE_SOCKET_URL=http://localhost:5001
```

---

## 📱 Building for Android

Vidya Setu utilizes **Capacitor** to wrap the PWA into a native Android application.

### Prerequisites
- Android Studio (Arctic Fox or higher)
- Android SDK (API level 21+)

### Build Steps
```bash
cd frontend

# Build the production React bundle
npm run build

# Sync web assets with Capacitor Android project
npx cap sync android

# Open project in Android Studio to build APK
npx cap open android
```
*In Android Studio: Wait for Gradle sync, then go to `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`.*

---

## 📂 Project Structure

```text
digital-learning-platform/
├── backend/
│   ├── config/             # DB & Firebase configuration
│   ├── controllers/        # Request handlers (User, Lesson, Quiz, Chat)
│   ├── middleware/         # JWT Auth & Role-based access control
│   ├── models/             # Mongoose schemas (User, Lesson, Progress, OTP, etc.)
│   ├── routes/             # Express API routes
│   ├── services/           # better-queue & ffmpeg video compressor service
│   ├── server.js           # Express & Socket.IO entry point
│   └── public/uploads/     # Temp storage for raw/compressed files
│
├── frontend/
│   ├── android/            # Capacitor Android native project
│   ├── src/
│   │   ├── components/     # UI Components (AdminPanel, StudentPortal, TeacherDashboard)
│   │   ├── context/        # React Context (SyncContext for network state)
│   │   ├── offline/        # IndexedDB logic (syncQueue.js, videoCache.js)
│   │   ├── App.jsx         # Root Router & Auth check
│   │   ├── config.js       # Dynamic API URL resolution
│   │   ├── socket.js       # Socket.IO client singleton
│   │   └── sw.js           # Custom Workbox Service Worker logic
│   ├── capacitor.config.json # Capacitor configuration
│   └── vite.config.js      # Vite & PWA configuration
│
└── PROJECT_DOCUMENTATION.md # Detailed system design docs
```

---

## 🎓 User Roles & Workflows

### 👨‍🎓 Students
- **Dashboard**: Access assigned lessons based on their standard/grade.
- **Offline Learning**: Download video lessons and PDFs for offline viewing.
- **Assessments**: Take quizzes; results are queued offline and synced when online.
- **Gamification**: Earn badges and points for completing lessons and quizzes.

### 👨‍🏫 Teachers
- **Content Creation**: Upload videos/PDFs to create rich lessons.
- **Live Classes**: Start live sessions, manage real-time chat, and broadcast announcements.
- **Live Quizzes**: Push quizzes to connected students in real-time.
- **Analytics**: View student progress and quiz performance charts.

### 👤 Admins
- Manage school registrations, users (teachers/students), and platform-wide configurations.

---

## 🐛 Troubleshooting

1. **MongoDB Connection Fails**: Ensure your current IP is whitelisted in MongoDB Atlas Network Access settings. The server employs auto-retry logic every 10 seconds if it fails initially.
2. **Video Upload Stalls**: Ensure `ffmpeg` is globally installed and accessible in your system's PATH. Check the backend console for `[videoCompressor]` logs.
3. **Emails/OTPs Not Sending**: If using Gmail for Nodemailer, ensure you have generated an **App Password** (standard account passwords will not work).
4. **Android Build Network Issues**: The `capacitor.config.json` allows cleartext traffic for local testing. If pointing to a production server, ensure you are using `https://`.

---

<div align="center">

**Built with ❤️ for rural education in India**  
🌐 **Vidya Setu** - Bridging the digital divide in education

</div>
