import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import NewConversationModal from "./NewConversationModal";

function Avatar({ src, name, size = 38, online = false }) {
    return (
        <div className="avatar-wrap" style={{ width: size, height: size }}>
            {src ? (
                <img src={src} alt={name} className="avatar" style={{ width: size, height: size }} />
            ) : (
                <div className="avatar avatar-fallback" style={{ width: size, height: size }}>
                    {name?.[0]?.toUpperCase()}
                </div>
            )}
            {online && <span className="online-dot" />}
        </div>
    );
}

function formatTime(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now  = new Date();
    const diff = now - date;
    if (diff < 60000)    return "now";
    if (diff < 3600000)  return Math.floor(diff / 60000) + "m";
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Sidebar({
    user,
    conversations,
    onlineUsers,
    onNewConversation,
    onLogout,
    onOpenConversation,
    loading,
}) {
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch]       = useState("");

    const isOnline = (participants) =>
        participants?.some(
            (p) => p.id !== user?.id && onlineUsers.some((u) => u.userId === p.id)
        );

    const filtered = conversations.filter((c) => {
        const name = c.type === "group"
            ? c.name
            : c.other_participants?.[0]?.name ?? "";
        return name.toLowerCase().includes(search.toLowerCase());
    });

    return (
        <>
            <aside className="sidebar">
                {/* Header */}
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <span className="brand-icon">💬</span>
                        <span className="brand-name">Chat</span>
                    </div>
                    <button
                        className="icon-btn new-chat-btn"
                        onClick={() => setShowModal(true)}
                        title="New conversation"
                    >
                        ✏️
                    </button>
                </div>

                {/* Search */}
                <div className="sidebar-search">
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Conversation list */}
                <div className="conversations-list">
                    {loading ? (
                        <div className="sidebar-loading">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="conv-skeleton">
                                    <div className="sk-avatar" />
                                    <div className="sk-text">
                                        <div className="sk-line sk-name" />
                                        <div className="sk-line sk-preview" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="no-convs">
                            {search
                                ? "No results"
                                : "No conversations yet.\nClick ✏️ to start one!"}
                        </div>
                    ) : (
                        filtered.map((conv) => {
                            const isGroup  = conv.type === "group";
                            const other    = conv.other_participants?.[0];
                            const name     = isGroup ? conv.name : other?.name ?? "Unknown";
                            const avatar   = isGroup ? conv.avatar : other?.avatar;
                            const online = !isGroup && (conv.other_participants ?? []).some(
                                (p) => p.id !== user?.id && onlineUsers.some((u) => u.userId === p.id)
                            );
                            const lastMsg  = conv.last_message ?? conv.lastMessage;
                            const unread   = conv.unread_count ?? 0;

                            // Is the last message sent by current user
                            const isOwnLastMsg = lastMsg?.user_id === user?.id;

                            // Show "Seen" only if last message is ours and is_read is true
                            const showSeen = isOwnLastMsg && lastMsg?.is_read === true && unread === 0;

                            // Show unread badge only for messages from others
                            const showUnread = !isOwnLastMsg && unread > 0;

                            return (
                                <NavLink
                                    key={conv.id}
                                    to={"/conversation/" + conv.id}
                                    className={({ isActive }) =>
                                        "conv-item" + (isActive ? " active" : "") + (showUnread ? " conv-item-unread" : "")
                                    }
                                    onClick={() => onOpenConversation?.(conv.id)}
                                >
                                    {/* Avatar */}
                                    <div className="conv-avatar">
                                        {isGroup ? (
                                            <div className="group-avatar">
                                                {name?.[0]?.toUpperCase()}
                                            </div>
                                        ) : (
                                            <Avatar src={avatar} name={name} online={online} />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="conv-info">
                                        {/* Top row: name + time */}
                                        <div className="conv-top">
                                            <span className="conv-name">{name}</span>
                                            <span className="conv-time">
                                                {lastMsg ? formatTime(lastMsg.created_at) : ""}
                                            </span>
                                        </div>

                                        {/* Bottom row: preview + badge or seen */}
                                        <div className="conv-bottom">
                                            <span className={
                                                "conv-preview" +
                                                (showUnread ? " conv-preview-unread" : "")
                                            }>
                                                {lastMsg ? (
                                                    lastMsg.type === "deleted"
                                                        ? "Message deleted"
                                                        : (isOwnLastMsg ? "You: " : "") + lastMsg.content
                                                ) : (
                                                    "Start a conversation"
                                                )}
                                            </span>

                                            {/* Unread count badge */}
                                            {showUnread && (
                                                <span className="unread-badge">
                                                    {unread > 99 ? "99+" : unread}
                                                </span>
                                            )}

                                            {/* Seen indicator */}
                                            {showSeen && (
                                                <span className="sidebar-seen">
                                                    ✓✓ Seen
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </NavLink>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="sidebar-footer">
                    <Avatar src={user?.avatar} name={user?.name} size={34} online />
                    <div className="footer-user-info">
                        <span className="footer-name">{user?.name}</span>
                        <span className="footer-status online">● Online</span>
                    </div>
                    <button className="icon-btn logout-btn" onClick={onLogout} title="Logout">
                        ↩
                    </button>
                </div>
            </aside>

            {showModal && (
                <NewConversationModal
                    currentUser={user}
                    onClose={() => setShowModal(false)}
                    onCreated={(conv) => {
                        onNewConversation(conv);
                        setShowModal(false);
                    }}
                />
            )}
        </>
    );
}