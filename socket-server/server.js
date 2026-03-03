require("dotenv").config();
const { createServer } = require("http");
const { Server }       = require("socket.io");
const axios            = require("axios");

const httpServer = createServer();

const io = new Server(httpServer, {
    cors: {
        origin:      "*",
        methods:     ["GET", "POST"],
        credentials: false,
    },
});

// ── In-memory state ───────────────────────────────────────────────────────────
const onlineUsers = new Map(); // userId  → { socketId, userId, name, avatar }
const typingUsers = new Map(); // key     → timeout handle
const userRooms   = new Map(); // socketId → Set of conversationIds

// ── Helpers ───────────────────────────────────────────────────────────────────
function broadcastOnlineUsers() {
    const list = Array.from(onlineUsers.values());
    io.emit("online-users", list);
    console.log("Online users:", list.map((u) => u.name));
}

function joinRoom(socket, conversationId) {
    const room = "conversation:" + conversationId;
    socket.join(room);
    if (!userRooms.has(socket.id)) userRooms.set(socket.id, new Set());
    userRooms.get(socket.id).add(conversationId);
    console.log("Joined room:", room);
}

function clearTyping(key, conversationId, userId) {
    if (typingUsers.has(key)) {
        clearTimeout(typingUsers.get(key));
        typingUsers.delete(key);
    }
    io.to("conversation:" + conversationId).emit("user-stop-typing", {
        userId,
        conversationId,
    });
}

// ── Token verification ────────────────────────────────────────────────────────
async function verifyToken(token) {
    try {
        const res = await axios.get("http://127.0.0.1:8000/api/auth/me", {
            headers: {
                Authorization: "Bearer " + token,
                Accept:        "application/json",
            },
            timeout: 5000,
        });
        return res.data.user;
    } catch (err) {
        console.error("Token verify failed:", err.message);
        return null;
    }
}

// ── Connection ────────────────────────────────────────────────────────────────
io.on("connection", async (socket) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
        socket.disconnect();
        return;
    }

    const user = await verifyToken(token);
    if (!user) {
        socket.disconnect();
        return;
    }

    console.log("Connected:", user.name, "| socket:", socket.id);

    // Register as online
    onlineUsers.set(user.id, {
        socketId: socket.id,
        userId:   user.id,
        name:     user.name,
        avatar:   user.avatar,
    });

    // Broadcast updated online list to ALL clients
    broadcastOnlineUsers();

    // ── Join rooms ────────────────────────────────────────────────────────────
    socket.on("join-conversations", (conversationIds) => {
        if (!Array.isArray(conversationIds)) return;
        conversationIds.forEach((id) => joinRoom(socket, id));
    });

    socket.on("join-conversation", (conversationId) => {
        joinRoom(socket, conversationId);
    });

    // ── Get online users (called on mount by client) ───────────────────────────
    socket.on("get-online-users", () => {
        const list = Array.from(onlineUsers.values());
        // Send only to requesting socket
        socket.emit("online-users", list);
        console.log("Sent online users to:", user.name);
    });

    // ── Broadcast message to room ─────────────────────────────────────────────
    socket.on("broadcast-message", ({ conversationId, message }) => {
        if (!conversationId || !message) return;
        const room = "conversation:" + conversationId;
        console.log("Broadcasting message to:", room);
        // io.to sends to ALL in room including sender
        io.to(room).emit("new-message", message);
    });

    // ── Seen receipt ──────────────────────────────────────────────────────────
    socket.on("mark-seen", ({ conversationId, messageId, seenBy }) => {
        if (!conversationId || !messageId) return;
        const room = "conversation:" + conversationId;
        console.log("Seen: message", messageId, "by user", seenBy);
        // Send to everyone in room EXCEPT the one who saw it
        socket.to(room).emit("message-seen", {
            conversationId,
            messageId,
            seenBy,
        });
    });

    // ── Typing start ──────────────────────────────────────────────────────────
    socket.on("typing-start", ({ conversationId }) => {
        const key = conversationId + ":" + user.id;
        if (typingUsers.has(key)) clearTimeout(typingUsers.get(key));

        socket.to("conversation:" + conversationId).emit("user-typing", {
            userId:         user.id,
            name:           user.name,
            conversationId,
        });

        const timeout = setTimeout(
            () => clearTyping(key, conversationId, user.id),
            5000
        );
        typingUsers.set(key, timeout);
    });

    // ── Typing stop ───────────────────────────────────────────────────────────
    socket.on("typing-stop", ({ conversationId }) => {
        const key = conversationId + ":" + user.id;
        clearTyping(key, conversationId, user.id);
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
        console.log("Disconnected:", user.name);

        // Remove from online list
        onlineUsers.delete(user.id);

        // Broadcast updated online list to ALL remaining clients
        broadcastOnlineUsers();

        // Clean up typing state
        if (userRooms.has(socket.id)) {
            userRooms.get(socket.id).forEach((conversationId) => {
                const key = conversationId + ":" + user.id;
                if (typingUsers.has(key)) {
                    clearTimeout(typingUsers.get(key));
                    typingUsers.delete(key);
                    io.to("conversation:" + conversationId).emit("user-stop-typing", {
                        userId: user.id,
                        conversationId,
                    });
                }
            });
            userRooms.delete(socket.id);
        }
    });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log("Socket.io server running on http://localhost:" + PORT);
});