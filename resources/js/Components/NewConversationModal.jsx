import React, { useEffect, useState } from 'react';
import api from '../lib/api';

export default function NewConversationModal({ currentUser, onClose, onCreated }) {
    const [tab, setTab]         = useState('direct'); // 'direct' | 'group'
    const [users, setUsers]     = useState([]);
    const [search, setSearch]   = useState('');
    const [selected, setSelected] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        api.get('/users').then((r) => {
            setUsers(r.data.users);
            setFetching(false);
        });
    }, []);

    const filtered = users.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    const toggleSelect = (user) => {
        if (tab === 'direct') {
            setSelected([user]);
        } else {
            setSelected((prev) =>
                prev.find((u) => u.id === user.id)
                    ? prev.filter((u) => u.id !== user.id)
                    : [...prev, user]
            );
        }
    };

    const create = async () => {
        if (selected.length === 0) return;
        setLoading(true);
        try {
            let res;
            if (tab === 'direct') {
                res = await api.post('/conversations/direct', { user_id: selected[0].id });
            } else {
                if (!groupName.trim()) return;
                res = await api.post('/conversations/group', {
                    name: groupName,
                    member_ids: selected.map((u) => u.id),
                });
            }
            onCreated(res.data.conversation);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>New Conversation</h2>
                    <button className="icon-btn" onClick={onClose}>✕</button>
                </div>

                {/* Tabs */}
                <div className="modal-tabs">
                    <button className={tab === 'direct' ? 'active' : ''} onClick={() => { setTab('direct'); setSelected([]); }}>
                        Direct Message
                    </button>
                    <button className={tab === 'group' ? 'active' : ''} onClick={() => { setTab('group'); setSelected([]); }}>
                        Group Chat
                    </button>
                </div>

                {tab === 'group' && (
                    <div className="modal-group-name">
                        <input
                            type="text"
                            placeholder="Group name…"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                        />
                    </div>
                )}

                <input
                    className="modal-search"
                    type="text"
                    placeholder="Search people…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                {selected.length > 0 && (
                    <div className="selected-chips">
                        {selected.map((u) => (
                            <span key={u.id} className="chip" onClick={() => toggleSelect(u)}>
                                {u.name} ✕
                            </span>
                        ))}
                    </div>
                )}

                <div className="modal-user-list">
                    {fetching ? (
                        <div className="modal-loading">Loading users…</div>
                    ) : filtered.length === 0 ? (
                        <div className="modal-empty">No users found</div>
                    ) : (
                        filtered.map((u) => (
                            <div
                                key={u.id}
                                className={`modal-user-item ${selected.find((s) => s.id === u.id) ? 'selected' : ''}`}
                                onClick={() => toggleSelect(u)}
                            >
                                {u.avatar ? (
                                    <img src={u.avatar} alt={u.name} className="modal-avatar" />
                                ) : (
                                    <div className="modal-avatar avatar-fallback">{u.name[0]}</div>
                                )}
                                <div>
                                    <div className="modal-user-name">{u.name}</div>
                                    <div className="modal-user-email">{u.email}</div>
                                </div>
                                {selected.find((s) => s.id === u.id) && <span className="check">✓</span>}
                            </div>
                        ))
                    )}
                </div>

                <button
                    className="btn-primary modal-create-btn"
                    disabled={loading || selected.length === 0 || (tab === 'group' && !groupName.trim())}
                    onClick={create}
                >
                    {loading ? 'Creating…' : tab === 'direct' ? 'Start Chat' : 'Create Group'}
                </button>
            </div>
        </div>
    );
}