import { Capacitor } from '@capacitor/core';

const isCapacitor = Capacitor.isNativePlatform();

// Read saved server URL from localStorage (set from Login screen)
const savedUrl = localStorage.getItem('serverUrl');

// Default: localhost for web, empty for mobile (forces user to configure)
const DEFAULT_HOST = isCapacitor ? '' : 'localhost';
const DEFAULT_PORT = '5001';

// If user saved a full URL like "http://192.168.1.4:5001", use it directly
// Otherwise fall back to default
let SERVER_BASE = '';
if (savedUrl) {
    // Remove trailing slash if any
    SERVER_BASE = savedUrl.replace(/\/+$/, '');
} else if (DEFAULT_HOST) {
    SERVER_BASE = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
}

export const API_BASE = `${SERVER_BASE}/api`;
export const SOCKET_URL = SERVER_BASE;
