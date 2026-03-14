import { openDB } from 'idb';
import axios from 'axios';

const DB_NAME = 'VidyaSetuOfflineDB';
const STORE_NAME = 'syncQueue';
const DB_VERSION = 2;

export async function getDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('offlineVideos')) {
                db.createObjectStore('offlineVideos', { keyPath: 'lessonId' });
            }
        },
    });
}

export async function enqueue(action) {
    const db = await getDB();
    const id = await db.add(STORE_NAME, {
        method: action.method || 'POST',
        url: action.url,
        body: action.body,
        createdAt: new Date().toISOString(),
        attempts: 0
    });
    console.log(`[Offline Engine] Action queued offline (ID: ${id}) for ${action.url}`);

    // Trigger background sync registration if available
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-progress');
        } catch (err) {
            console.error('[Offline Engine] Background sync registration failed', err);
        }
    }
}

export async function getQueueSize() {
    const db = await getDB();
    return await db.count(STORE_NAME);
}

export async function flushQueue() {
    console.log('[Offline Engine] Attempting to flush queue to cloud...');
    const db = await getDB();
    const allItems = await db.getAll(STORE_NAME);

    if (allItems.length === 0) {
        console.log('[Offline Engine] Queue is empty. Everything synced.');
        return 0; // successfully flushed 0 items
    }

    let successCount = 0;

    for (const item of allItems) {
        try {
            console.log(`[Offline API] Syncing ${item.method} ${item.url}...`);
            await axios({ method: item.method, url: item.url, data: item.body });

            // Delete on success or 409 conflict
            await db.delete(STORE_NAME, item.id);
            successCount++;
        } catch (err) {
            const conflict = err.response && err.response.status === 409;
            if (conflict || item.attempts >= 3) {
                // Remove if conflict (duplicate) or exceeded attempts
                console.log(`[Offline Engine] Dropping item ${item.id} (Conflict/Max Retries)`);
                await db.delete(STORE_NAME, item.id);
            } else {
                // Re-queue with incremented attempt counter
                item.attempts += 1;
                await db.put(STORE_NAME, item);
                console.warn(`[Offline Engine] Sync failed for ${item.id}, queuing for retry. (${item.attempts}/3)`);
            }
        }
    }

    return successCount;
}
