import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useSocket, getSocket } from "../../hooks/useSocket";
import MessageBubble from "../../Components/MessageBubble";
import MessageInput from "../../Components/MessageInput";
import ConversationHeader from "../../Components/ConversationHeader";
import api from "../../lib/api";

export default function ChatWindow({ conversations, onlineUsers, onOpenConversation }) {
    const { id }                        = useParams();
    const convId                        = parseInt(id);
    const { user }                      = useAuthStore();
    const { emit, on }                  = useSocket();

    const [messages, setMessages]       = useState([]);
    const [loading, setLoading]         = useState(true);
    const [hasMore, setHasMore]         = useState(false);
    const [page, setPage]               = useState(1);
    const [typingUsers, setTypingUsers] = useState([]);

    const bottomRef  = useRef(null);
    const userRef    = useRef(user);
    const convIdRef  = useRef(convId);

    useEffect(() => { userRef.current  = user;    }, [user]);
    useEffect(() => { convIdRef.current = convId; }, [convId]);

    const conversation = conversations?.find((c) => c.id === convId);
    const isOnline     = (userId) => onlineUsers?.some((u) => u.userId === userId) ?? false;

    // ── Load messages ─────────────────────────────────────────────────────────
    const loadMessages = useCallback(async (p = 1, prepend = false) => {
        try {
            const res = await api.get("/conversations/" + convId + "/messages", {
                params: { page: p, per_page: 30 },
            });
            const fetched = res.data.messages.reverse();
            setMessages((prev) => (prepend ? [...fetched, ...prev] : fetched));
            setHasMore(res.data.has_more);
            setPage(p);
        } catch (err) {
            console.error("Failed to load messages:", err);
        } finally {
            setLoading(false);
        }
    }, [convId]);

    // ── Reset on conversation change ──────────────────────────────────────────
    useEffect(() => {
        if (!convId) return;

        setMessages([]);
        setLoading(true);
        setTypingUsers([]);
        setPage(1);
        loadMessages(1);
        onOpenConversation?.(convId);

        let attempts = 0;
        const tryJoin = () => {
            const sock = getSocket();
            if (sock?.connected) {
                console.log("Joining conversation room:", convId);
                sock.emit("join-conversation", convId);
            } else if (attempts < 10) {
                attempts++;
                console.log("Socket not ready, retrying... attempt", attempts);
                setTimeout(tryJoin, 500);
            }
        };

        setTimeout(tryJoin, 200);
    }, [convId]);

    // ── Scroll to bottom ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!loading) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    // ── Mark unread as seen on load ───────────────────────────────────────────
    useEffect(() => {
        if (!messages.length || loading || !user?.id) return;

        const unread = messages.filter(
            (m) => m.user_id !== user.id && !m.is_read && m.id
        );

        unread.forEach(async (m) => {
            try {
                await api.post("/messages/" + m.id + "/read");
                emit("mark-seen", {
                    conversationId: convId,
                    messageId:      m.id,
                    seenBy:         user.id,
                });
            } catch (err) {
                console.error("Mark read failed:", err);
            }
        });

        if (unread.length > 0) {
            setMessages((prev) =>
                prev.map((m) =>
                    m.user_id !== user.id ? { ...m, is_read: true } : m
                )
            );
        }
    }, [messages.length, loading]);

    // ── Socket listeners ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.id) return;

        const handleNewMessage = async (msg) => {
            if (msg.conversation_id !== convIdRef.current) return;

            setMessages((prev) => {
                if (prev.find((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
            });

            // Auto mark as seen if from other user
            if (msg.user_id !== userRef.current?.id && msg.id) {
                try {
                    await api.post("/messages/" + msg.id + "/read");
                    emit("mark-seen", {
                        conversationId: convIdRef.current,
                        messageId:      msg.id,
                        seenBy:         userRef.current?.id,
                    });
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === msg.id ? { ...m, is_read: true } : m
                        )
                    );
                } catch (err) {
                    console.error("Auto mark read failed:", err);
                }
            }
        };

        const handleTypingStart = (data) => {
            if (data.conversationId !== convIdRef.current || data.userId === userRef.current?.id) return;
            setTypingUsers((prev) =>
                prev.find((u) => u.userId === data.userId) ? prev : [...prev, data]
            );
        };

        const handleTypingStop = (data) => {
            if (data.conversationId !== convIdRef.current) return;
            setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
        };

        const handleMessageSeen = (data) => {
            if (data.conversationId !== convIdRef.current) return;
            console.log("SEEN EVENT:", data);
            setMessages((prev) =>
                prev.map((m) => {
                    if (m.id && m.id <= data.messageId && m.user_id === userRef.current?.id) {
                        return { ...m, is_read: true };
                    }
                    return m;
                })
            );
        };

        const unsubMsg         = on("new-message",       handleNewMessage);
        const unsubTypingStart = on("user-typing",       handleTypingStart);
        const unsubTypingStop  = on("user-stop-typing",  handleTypingStop);
        const unsubSeen        = on("message-seen",      handleMessageSeen);

        return () => {
            unsubMsg?.();
            unsubTypingStart?.();
            unsubTypingStop?.();
            unsubSeen?.();
        };
    }, [convId, user?.id]);

    // ── Send message ──────────────────────────────────────────────────────────
    const sendMessage = useCallback(async (content) => {
        if (!content.trim() || !user?.id) return;

        const tempId     = "temp-" + Date.now();
        const optimistic = {
            tempId,
            id:              null,
            conversation_id: convId,
            user_id:         user.id,
            content,
            type:            "text",
            is_read:         false,
            created_at:      new Date().toISOString(),
            sender: {
                id:     user.id,
                name:   user.name ?? "Me",
                avatar: user.avatar ?? null,
            },
            pending: true,
            failed:  false,
        };

        setMessages((prev) => [...prev, optimistic]);
        emit("typing-stop", { conversationId: convId });

        try {
            const res   = await api.post("/messages", {
                conversation_id: convId,
                content,
                type: "text",
            });
            const saved = res.data.message;

            setMessages((prev) =>
                prev.map((m) => (m.tempId === tempId ? { ...saved } : m))
            );

            emit("broadcast-message", {
                conversationId: convId,
                message:        saved,
            });

        } catch (err) {
            console.error("Send failed:", err);
            setMessages((prev) =>
                prev.map((m) =>
                    m.tempId === tempId ? { ...m, failed: true, pending: false } : m
                )
            );
        }
    }, [convId, user, emit]);

    // ── Typing ────────────────────────────────────────────────────────────────
    const handleTyping = useCallback((isTyping) => {
        emit(isTyping ? "typing-start" : "typing-stop", { conversationId: convId });
    }, [convId, emit]);

    // ── Guards ────────────────────────────────────────────────────────────────
    if (!user) return (
        <div className="messages-loading">
            <div className="spinner" /><span>Loading...</span>
        </div>
    );

    if (!conversation) return (
        <div className="chat-empty">
            <p>Select a conversation to start chatting</p>
        </div>
    );

    return (
        <div className="chat-window">
            <ConversationHeader
                conversation={conversation}
                currentUser={user}
                isOnline={isOnline}
                onlineUsers={onlineUsers}
            />

            <div className="messages-container">
                {hasMore && (
                    <button className="load-more-btn" onClick={() => loadMessages(page + 1, true)}>
                        Load earlier messages
                    </button>
                )}

                {loading ? (
                    <div className="messages-loading">
                        <div className="spinner" /><span>Loading messages...</span>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="messages-empty">
                        <p>No messages yet. Say hello!</p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const msgUserId  = msg?.user_id ?? msg?.sender?.id ?? null;
                        const prevUserId = messages[i - 1]?.user_id ?? messages[i - 1]?.sender?.id ?? null;
                        const nextUserId = messages[i + 1]?.user_id ?? messages[i + 1]?.sender?.id ?? null;
                        const isOwn      = msgUserId === user.id;
                        const isLastOwn  = isOwn && nextUserId !== user.id;

                        return (
                            <MessageBubble
                                key={msg.id ?? msg.tempId}
                                message={msg}
                                isOwn={isOwn}
                                isLastOwn={isLastOwn}
                                showAvatar={i === 0 || prevUserId !== msgUserId}
                                showName={conversation.type === "group"}
                            />
                        );
                    })
                )}

                {typingUsers.length > 0 && (
                    <div className="typing-indicator">
                        <div className="typing-dots">
                            <span /><span /><span />
                        </div>
                        <span className="typing-label">
                            {typingUsers.map((u) => u.name).join(", ")}
                            {typingUsers.length === 1 ? " is" : " are"} typing...
                        </span>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            <MessageInput onSend={sendMessage} onTyping={handleTyping} />
        </div>
    );
}