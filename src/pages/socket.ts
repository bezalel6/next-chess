import { io } from 'socket.io-client';
import type { CustomSocket } from '../types/socket';

const isBrowser = typeof window !== "undefined"
const SOCKET_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const socket: CustomSocket = isBrowser ? io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
}) : {} as CustomSocket;