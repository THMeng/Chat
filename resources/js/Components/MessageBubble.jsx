import React from "react";

function formatTime(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function MessageBubble({ message, isOwn, showAvatar, showName, isLastOwn }) {
    const isDeleted = message.type === "deleted";
    const sender    = message.sender;

    return (
        <div className={"message-row " + (isOwn ? "own" : "other")}>
            {!isOwn && (
                <div className="message-avatar-col">
                    {showAvatar ? (
                        sender?.avatar ? (
                            <img src={sender.avatar} alt={sender.name} className="msg-avatar" />
                        ) : (
                            <div className="msg-avatar avatar-fallback">
                                {sender?.name?.[0]?.toUpperCase()}
                            </div>
                        )
                    ) : (
                        <div className="msg-avatar-spacer" />
                    )}
                </div>
            )}

            <div className="message-content-col">
                {showName && !isOwn && sender && (
                    <span className="message-sender-name">{sender.name}</span>
                )}

                <div className={
                    "message-bubble " +
                    (isOwn ? "bubble-own" : "bubble-other") +
                    (isDeleted ? " bubble-deleted" : "") +
                    (message.pending ? " bubble-pending" : "")
                }>
                    <p className="message-text">{message.content}</p>
                </div>

                <div className="message-meta">
                    <span className="message-time">{formatTime(message.created_at)}</span>

                    {isOwn && message.pending && (
                        <span className="message-status pending">
                            <span className="status-icon">🕐</span> sending
                        </span>
                    )}

                    {isOwn && message.failed && (
                        <span className="message-status failed">
                            <span className="status-icon">❌</span> failed
                        </span>
                    )}

                    {isOwn && !message.pending && !message.failed && (
                        <span className={"message-status " + (message.is_read ? "seen" : "sent")}>
                            {message.is_read ? (
                                <>
                                    <span className="check-double">✓✓</span>
                                    <span className="seen-label">Seen</span>
                                </>
                            ) : (
                                <>
                                    <span className="check-single">✓</span>
                                    <span className="sent-label">Sent</span>
                                </>
                            )}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}