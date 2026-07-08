import { Socket } from "socket.io";
import { supabase } from "../config/supabase.js";

/**
 * Middleware autentikasi untuk koneksi Socket.io.
 * Memastikan bahwa klien menyertakan token JWT Supabase yang valid.
 */
export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    // Klien bisa mengirim token via auth object, misalnya:
    // io("http://localhost:3001", { auth: { token: "..." } })
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: Token not found"));
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return next(new Error("Authentication error: Invalid or expired token"));
    }

    const userId = data.user.id;

    // Masukkan socket ke dalam room yang dinisbatkan khusus untuk userId ini
    socket.join(`user:${userId}`);
    console.log(`[socket] User ${userId} connected and joined room: user:${userId}`);

    socket.on("disconnect", () => {
      console.log(`[socket] User ${userId} disconnected`);
    });

    next();
  } catch (err) {
    next(new Error("Authentication error: Server error"));
  }
}
