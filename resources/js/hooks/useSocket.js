import { useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore";

let socketInstance = null;
const listeners    = {};
const pendingEmits = [];

function getOrCreateSocket(token) {
    if (socketInstance) return socketInstance;

    socketInstance = io("http://localhost:3001", {
        auth:                 { token },
        transports:           ["websocket"],
        reconnection:         true,
        reconnectionAttempts: 10,
        reconnectionDelay:    1000,
    });

    socketInstance.on("connect", () => {
        console.log("Socket connected:", socketInstance.id);

        // Flush queued emits
        while (pendingEmits.length > 0) {
            const { event, data } = pendingEmits.shift();
            console.log("Flushing queued emit:", event, data);
            socketInstance.emit(event, data);
        }
    });

    socketInstance.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
    });

    socketInstance.on("connect_error", (err) => {
        console.error("Socket connection error:", err.message);
    });

    const events = [
        "new-message",
        "message-seen",
        "user-typing",
        "user-stop-typing",
        "online-users",
        "joined-conversation",
        "joined-conversations",
        "error",
    ];

    events.forEach((event) => {
        socketInstance.on(event, (data) => {
            if (!listeners[event]) return;
            listeners[event].forEach((fn) => {
                try {
                    fn(data);
                } catch (e) {
                    console.error("Listener error on event", event, ":", e);
                }
            });
        });
    });

    return socketInstance;
}

export function getSocket() {
    return socketInstance;
}

export function disconnectSocket() {
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        Object.keys(listeners).forEach((k) => delete listeners[k]);
        pendingEmits.length = 0;
    }
}

export function useSocket() {
    const { token } = useAuthStore();

    useEffect(() => {
        if (!token) return;
        getOrCreateSocket(token);
    }, [token]);

    const emit = useCallback((event, data) => {
        if (!socketInstance) {
            console.warn("Socket not created yet, queuing:", event);
            pendingEmits.push({ event, data });
            return;
        }
        if (!socketInstance.connected) {
            console.warn("Socket not connected yet, queuing:", event, data);
            pendingEmits.push({ event, data });
            return;
        }
        socketInstance.emit(event, data);
    }, []);

    const on = useCallback((event, handler) => {
        if (!listeners[event]) listeners[event] = new Set();
        listeners[event].add(handler);
        return () => {
            listeners[event]?.delete(handler);
        };
    }, []);

    const off = useCallback((event, handler) => {
        listeners[event]?.delete(handler);
    }, []);

    return {
        socket:    socketInstance,
        emit,
        on,
        off,
        connected: socketInstance?.connected ?? false,
    };
}