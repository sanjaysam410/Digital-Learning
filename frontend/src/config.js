import { Capacitor } from '@capacitor/core';

// Detect if running natively on a mobile device (Android/iOS)
const isCapacitor = Capacitor.isNativePlatform();

// On Android emulator, 10.0.2.2 maps to the host machine's localhost
// On a real device or web, use localhost or the specific hostname
const HOST = isCapacitor ? '10.0.2.2' : 'localhost';

export const API_BASE = `http://${HOST}:5001/api`;
export const SOCKET_URL = `http://${HOST}:5001`;
