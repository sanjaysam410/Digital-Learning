import { io } from 'socket.io-client';
import { SOCKET_URL } from './config';

// Connect backend socket — guard against empty URL on mobile first launch
const socket = io(SOCKET_URL || 'http://localhost:5001', {
    autoConnect: !!SOCKET_URL, // Don't auto-connect if no server URL set
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
});

export default socket;
