import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { flushQueue, getQueueSize } from '../offline/syncQueue';
import { Capacitor } from '@capacitor/core';

const SyncContext = createContext();

// Robust network check: ping the actual backend to confirm connectivity
const pingServer = async () => {
    try {
        const serverUrl = localStorage.getItem('serverUrl');
        const base = serverUrl || (Capacitor.isNativePlatform() ? '' : 'http://localhost:5001');
        if (!base) return navigator.onLine; // No server configured — use browser hint
        const res = await fetch(`${base}/api/health`, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(5000) });
        return res.ok;
    } catch {
        return false;
    }
};

export function SyncProvider({ children }) {
    const [isOnline, setIsOnline] = useState(true); // default true — real check runs immediately
    const [queueSize, setQueueSize] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState(null);

    const checkQueue = async () => {
        try {
            const size = await getQueueSize();
            setQueueSize(size);
        } catch (error) {
            console.error('[SyncProvider] Error checking queue size', error);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const size = await flushQueue();
            if (size > 0 || queueSize > 0) {
                console.log(`[SyncProvider] Successfully synced ${size} items.`);
                setLastSynced(new Date().toISOString());
            }
        } catch (error) {
            console.error('[SyncProvider] Flush queue failed', error);
        } finally {
            checkQueue();
            setIsSyncing(false);
        }
    };

    // Robust network check combining Capacitor plugin + ping
    const checkNetwork = useCallback(async () => {
        let connected = navigator.onLine; // browser baseline

        // Use Capacitor Network plugin on native platforms for reliable detection
        if (Capacitor.isNativePlatform()) {
            try {
                const { Network } = await import('@capacitor/network');
                const status = await Network.getStatus();
                connected = status.connected;
            } catch (e) {
                console.warn('[SyncProvider] Capacitor Network unavailable, using fallback');
            }
        }

        // Double-check with a real server ping if browser says online
        if (connected) {
            connected = await pingServer();
        }

        setIsOnline(prev => {
            if (!prev && connected) {
                // Went from offline → online: trigger sync
                console.log('[SyncProvider] Network restored! Auto-syncing...');
                handleSync();
            }
            return connected;
        });

        return connected;
    }, []);

    useEffect(() => {
        // Initial check
        checkNetwork();
        checkQueue();

        // Browser events (still useful as triggers even on Capacitor)
        const handleOnline = () => {
            console.log('[SyncProvider] Browser online event');
            checkNetwork();
        };
        const handleOffline = () => {
            console.log('[SyncProvider] Browser offline event');
            setIsOnline(false);
            checkQueue();
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Capacitor Network plugin listener for reliable native detection
        let removeCapacitorListener = null;
        if (Capacitor.isNativePlatform()) {
            (async () => {
                try {
                    const { Network } = await import('@capacitor/network');
                    const handler = await Network.addListener('networkStatusChange', (status) => {
                        console.log('[SyncProvider] Capacitor network change:', status);
                        if (status.connected) {
                            checkNetwork(); // verify with ping
                        } else {
                            setIsOnline(false);
                            checkQueue();
                        }
                    });
                    removeCapacitorListener = () => handler.remove();
                } catch (e) {
                    console.warn('[SyncProvider] Could not set up Capacitor Network listener');
                }
            })();
        }

        // Periodic health-check ping every 15 seconds — catches cases where
        // browser events and Capacitor events both miss the state change
        const pingInterval = setInterval(checkNetwork, 15000);

        // Also check queue periodically
        const queueInterval = setInterval(checkQueue, 5000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(pingInterval);
            clearInterval(queueInterval);
            if (removeCapacitorListener) removeCapacitorListener();
        };
    }, [checkNetwork]);

    return (
        <SyncContext.Provider value={{
            isOnline,
            queueSize,
            isSyncing,
            lastSynced,
            syncNow: handleSync,
            refreshQueue: checkQueue,
            recheckNetwork: checkNetwork
        }}>
            {children}
        </SyncContext.Provider>
    );
}

export function useSync() {
    return useContext(SyncContext);
}
