"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOnlineUserIds = getOnlineUserIds;
exports.isUserOnline = isUserOnline;
exports.emitToUser = emitToUser;
exports.broadcastAdminEvent = broadcastAdminEvent;
exports.initSocket = initSocket;
exports.getIO = getIO;
const socket_io_1 = require("socket.io");
const jwt_1 = require("../utils/jwt");
const prisma_1 = require("../config/prisma");
const cors_1 = require("../config/cors");
/** userId -> Set of socket ids */
const onlineUsers = new Map();
/** socket id -> userId */
const socketToUser = new Map();
let io = null;
function getOnlineUserIds() {
    return Array.from(onlineUsers.keys());
}
function isUserOnline(userId) {
    return onlineUsers.has(userId);
}
/** Push a realtime event to every open session (web + mobile) of one user. */
function emitToUser(userId, event, payload = {}) {
    if (!io)
        return;
    io.to(`user:${userId}`).emit(event, payload);
}
function broadcastAdminEvent(event, payload) {
    if (!io)
        return;
    io.to('admins').emit(event, payload);
}
function initSocket(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: cors_1.corsOrigin,
            credentials: true
        },
        path: '/socket.io'
    });
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
            if (!token)
                return next(new Error('Unauthorized'));
            const { sub } = (0, jwt_1.verifyAccessToken)(token);
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: sub },
                select: { id: true, role: true, isActive: true }
            });
            if (!user || !user.isActive)
                return next(new Error('Unauthorized'));
            socket.userId = user.id;
            socket.role = user.role;
            next();
        }
        catch {
            next(new Error('Unauthorized'));
        }
    });
    io.on('connection', (socket) => {
        const s = socket;
        const userId = s.userId;
        if (!userId) {
            socket.disconnect(true);
            return;
        }
        // Track presence
        let set = onlineUsers.get(userId);
        if (!set) {
            set = new Set();
            onlineUsers.set(userId, set);
        }
        const wasOffline = set.size === 0;
        set.add(socket.id);
        socketToUser.set(socket.id, userId);
        if (wasOffline) {
            io?.emit('user:online', { userId });
            broadcastAdminEvent('presence:update', {
                userId,
                online: true,
                onlineCount: onlineUsers.size
            });
        }
        // Personal room: lets the API push notifications / messages to this user instantly
        socket.join(`user:${userId}`);
        // Join admin room if admin
        const role = (s.role || '').toLowerCase();
        if (role === 'admin' || role === 'administrator') {
            socket.join('admins');
        }
        // Clients may request current online list (admins)
        socket.on('presence:list', (cb) => {
            if (typeof cb === 'function')
                cb(getOnlineUserIds());
        });
        // Explicitly reject any client attempts to change account status via socket
        socket.on('admin:setStatus', () => {
            socket.emit('error', { message: 'Use the authenticated REST API for status changes.' });
        });
        socket.on('admin:deleteUser', () => {
            socket.emit('error', { message: 'Use the authenticated REST API for deletions.' });
        });
        socket.on('disconnect', () => {
            const uid = socketToUser.get(socket.id);
            socketToUser.delete(socket.id);
            if (!uid)
                return;
            const sockets = onlineUsers.get(uid);
            if (!sockets)
                return;
            sockets.delete(socket.id);
            if (sockets.size === 0) {
                onlineUsers.delete(uid);
                io?.emit('user:offline', { userId: uid });
                broadcastAdminEvent('presence:update', {
                    userId: uid,
                    online: false,
                    onlineCount: onlineUsers.size
                });
            }
        });
    });
    console.log('✅ Socket.IO ready');
    return io;
}
function getIO() {
    return io;
}
//# sourceMappingURL=socket.js.map