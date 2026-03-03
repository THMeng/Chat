import React, { useState, useEffect, useRef } from "react";

function formatLastSeen(date) {
    if (!date) return "";
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 10)    return "last seen just now";
    if (diff < 60)    return "last seen " + diff + " sec ago";
    if (diff < 3600)  return "last seen " + Math.floor(diff / 60) + " min ago";
    if (diff < 86400) return "last seen " + Math.floor(diff / 3600) + " hr ago";
    return "last seen " + Math.floor(diff / 86400) + " day ago";
}

export default function ConversationHeader({ conversation, currentUser, isOnline, onlineUsers }) {
    const isGroup = conversation?.type === "group";
    const other   = conversation?.other_participants?.[0];
    const name    = isGroup ? conversation.name : other?.name ?? "Unknown";
    const avatar  = isGroup ? conversation.avatar : other?.avatar;

    const [lastSeenDate, setLastSeenDate] = useState(null);
    const [lastSeenText, setLastSeenText] = useState("");
    const timerRef     = useRef(null);
    const lastSeenRef  = useRef(null);
    const prevOnlineRef = useRef(null);

    const memberCount = conversation?.participants?.length ??
        (conversation?.other_participants?.length ?? 0) + 1;

    // Derive online status directly from onlineUsers prop
    const isOtherOnline = !isGroup && other?.id
        ? (onlineUsers ?? []).some((u) => u.userId === other.id)
        : false;

    // Detect transitions: online → offline and offline → online
    useEffect(() => {
        if (isGroup || !other?.id) return;

        const wasOnline = prevOnlineRef.current;
        const nowOnline = isOtherOnline;

        // First render — initialize
        if (prevOnlineRef.current === null) {
            prevOnlineRef.current = nowOnline;
            return;
        }

        // Transition: online → offline
        if (wasOnline === true && nowOnline === false) {
            const now = new Date();
            lastSeenRef.current = now;
            setLastSeenDate(now);
            setLastSeenText(formatLastSeen(now));
            console.log("User went offline:", other?.name, "at", now);
        }

        // Transition: offline → online
        if (wasOnline === false && nowOnline === true) {
            lastSeenRef.current = null;
            setLastSeenDate(null);
            setLastSeenText("");
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            console.log("User came online:", other?.name);
        }

        prevOnlineRef.current = nowOnline;
    }, [isOtherOnline, other?.id, isGroup]);

    // Live ticker when offline
    useEffect(() => {
        if (!lastSeenDate) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        // Update immediately
        setLastSeenText(formatLastSeen(lastSeenDate));

        // Update every 10 seconds
        timerRef.current = setInterval(() => {
            if (!lastSeenRef.current) return;
            const diff = Math.floor((new Date() - lastSeenRef.current) / 1000);
            setLastSeenText(formatLastSeen(lastSeenRef.current));

            // Slow down to every 60 sec after 1 minute
            if (diff > 60) {
                clearInterval(timerRef.current);
                timerRef.current = setInterval(() => {
                    if (lastSeenRef.current) {
                        setLastSeenText(formatLastSeen(lastSeenRef.current));
                    }
                }, 60000);
            }
        }, 10000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [lastSeenDate]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    if (!conversation) return null;

    return (
        <div className="chat-header">
            <div className="chat-header-info">

                {/* Avatar */}
                <div className="header-avatar-wrap">
                    {isGroup ? (
                        <div className="group-avatar header-avatar">
                            {name?.[0]?.toUpperCase()}
                        </div>
                    ) : avatar ? (
                        <img src={avatar} alt={name} className="header-avatar" />
                    ) : (
                        <div className="avatar-fallback header-avatar">
                            {name?.[0]?.toUpperCase()}
                        </div>
                    )}
                    {!isGroup && (
                        <span className={
                            "header-status-dot " + (isOtherOnline ? "online" : "offline")
                        } />
                    )}
                </div>

                {/* Name + status */}
                <div className="header-text">
                    <h2 className="header-name">{name}</h2>
                    {isGroup ? (
                        <p className="header-status neutral">{memberCount} members</p>
                    ) : isOtherOnline ? (
                        <p className="header-status online">● Active now</p>
                    ) : lastSeenText ? (
                        <p className="header-status offline">{lastSeenText}</p>
                    ) : (
                        <p className="header-status offline">● Offline</p>
                    )}
                </div>

            </div>
        </div>
    );
}