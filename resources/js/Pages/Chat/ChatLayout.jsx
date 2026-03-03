import React, { useEffect, useState, useCallback, useRef } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useSocket, disconnectSocket, getSocket } from "../../hooks/useSocket";
import Sidebar from "../../Components/Sidebar";
import ChatWindow from "./ChatWindow";
import WelcomeScreen from "../../Components/WelcomeScreen";
import api from "../../lib/api";

export default function ChatLayout() {
    const { user, logout }                  = useAuthStore();
    const { emit, on }                      = useSocket();
    const [conversations, setConversations] = useState([]);
    const [onlineUsers, setOnlineUsers]     = useState([]);
    const [loading, setLoading]             = useState(true);

    const activeConvIdRef = useRef(null);
    const unreadCountsRef = useRef({});
    const initializedRef  = useRef(false);
    const userRef         = useRef(user);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // ── Fetch conversations ──────────────────────────────────────────────────
    const fetchConversations = useCallback(async (isInitial = false) => {
        try {
            const res  = await api.get("/conversations");
            const convs = res.data.conversations;

            const mapped = convs.map((c) => {
                if (isInitial) {
                    unreadCountsRef.current[c.id] = c.unread_count ?? 0;
                }
                return {
                    ...c,
                    unread_count: isInitial
                        ? (c.unread_count ?? 0)
                        : (unreadCountsRef.current[c.id] ?? 0),
                };
            });

            setConversations(mapped);
        } catch (err) {
            console.error("Failed to load conversations:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Initial load ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.id || initializedRef.current) return;
        initializedRef.current = true;
        fetchConversations(true);
    }, [user?.id]);

    // ── Join all rooms after conversations load ───────────────────────────────
    useEffect(() => {
        if (!conversations.length) return;

        const ids = conversations.map((c) => c.id);
        let attempts = 0;

        const tryJoin = () => {
            const sock = getSocket();
            if (sock?.connected) {
                console.log("Joining all conversation rooms:", ids);
                sock.emit("join-conversations", ids);
            } else if (attempts < 10) {
                attempts++;
                console.log("Socket not ready, retrying join-conversations... attempt", attempts);
                setTimeout(tryJoin, 500);
            }
        };

        setTimeout(tryJoin, 200);
    }, [conversations.length]);

    // ── Request online users after socket connects ────────────────────────────
    useEffect(() => {
        if (!user?.id) return;
        const timeout = setTimeout(() => {
            emit("get-online-users");
        }, 1000);
        return () => clearTimeout(timeout);
    }, [user?.id]);

    // ── NEW MESSAGE ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.id) return;

        const handleNewMessage = (message) => {
            console.log("NEW MESSAGE:", message);

            const convId   = message.conversation_id;
            const isActive = activeConvIdRef.current === convId;
            const isOwnMsg =
                message.user_id === userRef.current?.id ||
                message.sender?.id === userRef.current?.id;

            if (!isActive && !isOwnMsg) {
                unreadCountsRef.current[convId] =
                    (unreadCountsRef.current[convId] ?? 0) + 1;
                console.log("Unread count for conv", convId, ":", unreadCountsRef.current[convId]);
            }

            setConversations((prev) => {
                const exists = prev.find((c) => c.id === convId);

                if (!exists) {
                    fetchConversations(false);
                    return prev;
                }

                const updated = prev.map((c) => {
                    if (c.id !== convId) return c;
                    return {
                        ...c,
                        last_message: message,
                        lastMessage:  message,
                        updated_at:   message.created_at,
                        unread_count: unreadCountsRef.current[convId] ?? 0,
                    };
                });

                return [...updated].sort(
                    (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
                );
            });
        };

        const unsub = on("new-message", handleNewMessage);
        return () => unsub?.();
    }, [user?.id]);

    // ── MESSAGE SEEN ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.id) return;

        const handleMessageSeen = (data) => {
            console.log("MESSAGE SEEN:", data);

            unreadCountsRef.current[data.conversationId] = 0;

            setConversations((prev) =>
                prev.map((c) => {
                    if (c.id !== data.conversationId) return c;
                    const lastMsg        = c.last_message ?? c.lastMessage;
                    const updatedLastMsg = lastMsg ? { ...lastMsg, is_read: true } : lastMsg;
                    return {
                        ...c,
                        unread_count: 0,
                        last_message: updatedLastMsg,
                        lastMessage:  updatedLastMsg,
                    };
                })
            );
        };

        const unsub = on("message-seen", handleMessageSeen);
        return () => unsub?.();
    }, [user?.id]);

    // ── ONLINE USERS ─────────────────────────────────────────────────────────
    useEffect(() => {
        const handleOnlineUsers = (users) => {
            console.log("ONLINE USERS:", users.map((u) => u.name));
            setOnlineUsers(users);
        };

        const unsub = on("online-users", handleOnlineUsers);
        return () => unsub?.();
    }, []);

    // ── Open conversation — clear unread ──────────────────────────────────────
    const handleOpenConversation = useCallback((convId) => {
        activeConvIdRef.current         = convId;
        unreadCountsRef.current[convId] = 0;

        setConversations((prev) =>
            prev.map((c) =>
                c.id === convId ? { ...c, unread_count: 0 } : c
            )
        );
    }, []);

    // ── Add new conversation ──────────────────────────────────────────────────
    const addConversation = useCallback((conv) => {
        setConversations((prev) => {
            if (prev.find((c) => c.id === conv.id)) return prev;
            unreadCountsRef.current[conv.id] = 0;
            emit("join-conversation", conv.id);
            return [{ ...conv, unread_count: 0 }, ...prev];
        });
    }, [emit]);

    // ── Logout ────────────────────────────────────────────────────────────────
    const handleLogout = async () => {
        disconnectSocket();
        await logout();
    };

    return (
        <div className="chat-layout">
            <Sidebar
                user={user}
                conversations={conversations}
                onlineUsers={onlineUsers}
                onNewConversation={addConversation}
                onLogout={handleLogout}
                onOpenConversation={handleOpenConversation}
                loading={loading}
            />
            <main className="chat-main">
                <Routes>
                    <Route index element={<WelcomeScreen user={user} />} />
                    <Route
                        path="conversation/:id"
                        element={
                            <ChatWindow
                                conversations={conversations}
                                onlineUsers={onlineUsers}
                                onOpenConversation={handleOpenConversation}
                            />
                        }
                    />
                </Routes>
            </main>
        </div>
    );
}