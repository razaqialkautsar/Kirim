import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";

let io: SocketIOServer | null = null;

export function initSocket(server: HttpServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*", // Untuk demo hackathon, bebaskan CORS
      methods: ["GET", "POST"]
    }
  });
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

/**
 * Emit event spesifik ke satu user berdasarkan userId.
 * Memastikan notifikasi hanya terkirim ke klien yang sudah login.
 */
export function emitToUser(userId: string, eventName: string, data: any) {
  if (!io) {
    console.warn(`[socket] emitToUser failed: Socket.io not initialized`);
    return;
  }
  io.to(`user:${userId}`).emit(eventName, data);
}
