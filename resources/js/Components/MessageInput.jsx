import React, { useRef, useState, useCallback } from 'react';

export default function MessageInput({ onSend, onTyping }) {
    const [text, setText]         = useState('');
    const typingTimeoutRef        = useRef(null);
    const isTypingRef             = useRef(false);

    const handleChange = useCallback((e) => {
        const value = e.target.value;
        setText(value);

        // Emit typing-start if not already typing
        if (!isTypingRef.current && value.trim()) {
            isTypingRef.current = true;
            onTyping(true);
        }

        // Reset auto-stop timer
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (isTypingRef.current) {
                isTypingRef.current = false;
                onTyping(false);
            }
        }, 2000);
    }, [onTyping]);

    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed) return;

        onSend(trimmed);
        setText('');

        clearTimeout(typingTimeoutRef.current);
        isTypingRef.current = false;
        onTyping(false);
    }, [text, onSend, onTyping]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    return (
        <div className="message-input-bar">
            <textarea
                className="message-textarea"
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                rows={1}
            />
            <button
                className={`send-btn ${text.trim() ? 'active' : ''}`}
                onClick={handleSend}
                disabled={!text.trim()}
                title="Send message"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
            </button>
        </div>
    );
}