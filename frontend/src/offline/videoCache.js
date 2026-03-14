import { openDB } from 'idb';

const DB_NAME = 'VidyaSetuOfflineDB';
const STORE_NAME = 'offlineVideos';
const DB_VERSION = 2;

async function getDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'lessonId' });
            }
        },
    });
}

// Save video blob to IndexedDB
export async function saveVideoOffline(lessonId, videoUrl) {
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error('Failed to fetch video');
    const blob = await response.blob();
    const db = await getDB();
    await db.put(STORE_NAME, {
        lessonId,
        blob,
        url: videoUrl,
        savedAt: new Date().toISOString(),
        size: blob.size,
    });
    return blob.size;
}

// Get video blob URL from IndexedDB (returns null if not cached)
export async function getOfflineVideoUrl(lessonId) {
    const db = await getDB();
    const record = await db.get(STORE_NAME, lessonId);
    if (record && record.blob) {
        return URL.createObjectURL(record.blob);
    }
    return null;
}

// Check if a lesson's video is saved offline
export async function isVideoSaved(lessonId) {
    const db = await getDB();
    const record = await db.get(STORE_NAME, lessonId);
    return !!record;
}

// Get all saved lesson IDs
export async function getSavedLessonIds() {
    const db = await getDB();
    const all = await db.getAll(STORE_NAME);
    return all.map(r => r.lessonId);
}

// Delete a saved video
export async function deleteOfflineVideo(lessonId) {
    const db = await getDB();
    await db.delete(STORE_NAME, lessonId);
}

// Get total offline storage used
export async function getOfflineStorageUsed() {
    const db = await getDB();
    const all = await db.getAll(STORE_NAME);
    return all.reduce((total, r) => total + (r.size || 0), 0);
}
