import React from 'react';

export default function WelcomeScreen({ user }) {
    return (
        <div className="welcome-screen">
            <div className="welcome-icon">💬</div>
            <h2>Welcome, {user?.name}!</h2>
            <p>Select a conversation from the sidebar or start a new one by clicking the ✏️ button.</p>
            <div className="welcome-features">
                <div className="feature-item">
                    <span>💌</span>
                    <span>Private 1-on-1 messages</span>
                </div>
                <div className="feature-item">
                    <span>👥</span>
                    <span>Group chats</span>
                </div>
                <div className="feature-item">
                    <span>🟢</span>
                    <span>Real-time online status</span>
                </div>
                <div className="feature-item">
                    <span>⌨️</span>
                    <span>Typing indicators</span>
                </div>
            </div>
        </div>
    );
}