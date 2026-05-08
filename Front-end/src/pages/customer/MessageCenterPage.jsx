import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuth } from '../../context/AuthContext';
import { appToast } from '../../lib/appToast';
import {
    getConversationsByRequest,
    getMessages,
    getMyConversations,
    markMessagesRead,
} from '../../services/chatService';
import { selectCustomRequestArtisan } from '../../services/customRequestService';
import './MessageCenterPage.css';

const QUOTE_TEMPLATE = `📋 Báo giá của tôi:\n• Tổng giá: ___ đ\n• Thời gian: ___ ngày\n• Giai đoạn 1: [tên] - ___ đ - ___ ngày\n• Giai đoạn 2: [tên] - ___ đ - ___ ngày\n• Giai đoạn 3: [tên] - ___ đ - ___ ngày\nVui lòng xác nhận để tôi bắt đầu.`;

const fmt = (value) => {
    if (!value) return '';
    const d = new Date(value);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const truncate = (txt, n = 30) => {
    const t = String(txt || '').trim();
    if (!t) return 'Chưa có tin nhắn';
    return t.length > n ? `${t.slice(0, n)}...` : t;
};

const buildConversationName = (conversation) => {
    const name = String(conversation?.counterpartName || 'Người dùng').trim();
    const title = String(conversation?.requestTitle || conversation?.requestDescription || '').trim();
    return title ? `${name} - ${title}` : name;
};

const initials = (name) => String(name || '?').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');

const resolveRole = (user) => String(user?.role || '').toUpperCase();

const MessageCenterPage = () => {
    const { user } = useAuth();
    const role = resolveRole(user);
    const navigate = useNavigate();
    const location = useLocation();

    const [loadingConversations, setLoadingConversations] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [search, setSearch] = useState('');
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [composer, setComposer] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [typingByConversation, setTypingByConversation] = useState({});
    const [interestedArtisans, setInterestedArtisans] = useState([]);

    const stompRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const bottomRef = useRef(null);

    const activeConversation = useMemo(
        () => conversations.find((c) => String(c.id) === String(activeConversationId)) || null,
        [conversations, activeConversationId],
    );

    const filteredConversations = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return conversations;
        return conversations.filter((c) => String(c.counterpartName || '').toLowerCase().includes(q));
    }, [conversations, search]);

    const syncFromResponse = (list) => {
        const normalized = (Array.isArray(list) ? list : []).map((c) => {
            const customerName = c?.customerName || c?.customer?.name;
            const artisanName = c?.artisanName || c?.artisan?.name;
            const counterpartName = role === 'ARTISAN' ? customerName : artisanName;
            return {
                ...c,
                id: c?.id ?? c?.conversationId,
                requestId: c?.requestId ?? c?.customRequestId,
                artisanId: c?.artisanId ?? c?.artisan?.id,
                counterpartName: counterpartName || 'Người dùng',
                requestTitle: c?.requestTitle || c?.customRequestTitle || 'Yêu cầu đặt riêng',
                unreadCount: Number(c?.unreadCount || 0),
                lastMessage: c?.lastMessage || '',
                lastMessageTime: c?.lastMessageTime || c?.updatedAt || c?.lastUpdatedAt,
                requestDescription: c?.requestDescription || c?.description || '',
                minBudget: c?.minBudget,
                maxBudget: c?.maxBudget,
                requestStatus: c?.requestStatus || c?.status,
                selectedArtisanId: c?.selectedArtisanId,
            };
        });
        setConversations(normalized);
    };

    useEffect(() => {
        let ignore = false;
        const load = async () => {
            setLoadingConversations(true);
            const res = await getMyConversations();
            if (ignore) return;
            setLoadingConversations(false);
            if (!res.success) {
                appToast.error('Không tải được tin nhắn', res.error || 'Vui lòng thử lại');
                return;
            }
            syncFromResponse(res.data);
        };
        load();
        return () => {
            ignore = true;
        };
    }, []);

    useEffect(() => {
        if (!conversations.length) return;
        const params = new URLSearchParams(location.search);
        const qConv = params.get('conversationId');
        const fallback = conversations[0]?.id;
        const next = qConv && conversations.some((c) => String(c.id) === String(qConv)) ? qConv : fallback;
        setActiveConversationId((prev) => prev || next || null);
    }, [conversations, location.search]);

    useEffect(() => {
        if (!activeConversation?.requestId) return;
        let ignore = false;

        const loadMessages = async () => {
            setLoadingMessages(true);
            const res = await getMessages({ requestId: activeConversation.requestId, artisanId: activeConversation.artisanId });
            if (!ignore) {
                setLoadingMessages(false);
                if (!res.success) {
                    appToast.error('Không tải được lịch sử chat', res.error || 'Vui lòng thử lại');
                    return;
                }
                const sorted = [...res.data].sort((a, b) => new Date(a?.sentAt || a?.createdAt || 0) - new Date(b?.sentAt || b?.createdAt || 0));
                setMessages(sorted);
            }

            const markRes = await markMessagesRead(activeConversation.requestId);
            if (!ignore && !markRes.success) {
                appToast.warning('Không thể đánh dấu đã đọc', markRes.error || 'Vui lòng thử lại');
            }
            if (!ignore) {
                setConversations((prev) => prev.map((c) => String(c.id) === String(activeConversation.id) ? { ...c, unreadCount: 0 } : c));
            }
        };

        loadMessages();

        return () => {
            ignore = true;
        };
    }, [activeConversation?.id, activeConversation?.requestId, activeConversation?.artisanId]);

    useEffect(() => {
        if (!activeConversationId) return;

        const storedUser = localStorage.getItem('sanctus_user') || sessionStorage.getItem('sanctus_user');
        let token = '';
        try {
            token = JSON.parse(storedUser || '{}')?.token || '';
        } catch {
            token = '';
        }

        const client = new Client({
            webSocketFactory: () => new SockJS('/ws'),
            connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
            reconnectDelay: 5000,
            onConnect: () => {
                setIsConnected(true);
                client.subscribe(`/topic/chat/${activeConversationId}`, (frame) => {
                    const payload = JSON.parse(frame.body || '{}');
                    if (String(payload?.messageType || '').toUpperCase() === 'TYPING') {
                        setTypingByConversation((prev) => ({ ...prev, [activeConversationId]: true }));
                        window.clearTimeout(typingTimeoutRef.current);
                        typingTimeoutRef.current = window.setTimeout(() => {
                            setTypingByConversation((prev) => ({ ...prev, [activeConversationId]: false }));
                        }, 1200);
                        return;
                    }

                    setMessages((prev) => [...prev, payload]);
                    setConversations((prev) => prev.map((c) => {
                        if (String(c.id) !== String(activeConversationId)) return c;
                        return {
                            ...c,
                            lastMessage: payload?.content || c.lastMessage,
                            lastMessageTime: payload?.sentAt || new Date().toISOString(),
                        };
                    }));
                });
            },
            onDisconnect: () => {
                setIsConnected(false);
                appToast.warning('Mất kết nối', 'Đang thử kết nối lại...');
            },
            onStompError: () => {
                setIsConnected(false);
            },
        });

        stompRef.current = client;
        client.activate();

        return () => {
            window.clearTimeout(typingTimeoutRef.current);
            setIsConnected(false);
            client.deactivate();
        };
    }, [activeConversationId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typingByConversation, activeConversationId]);

    useEffect(() => {
        if (role !== 'CUSTOMER' || !activeConversation?.requestId) {
            setInterestedArtisans([]);
            return;
        }

        let ignore = false;
        const loadInterested = async () => {
            const res = await getConversationsByRequest(activeConversation.requestId);
            if (ignore) return;
            if (!res.success) return;
            setInterestedArtisans(res.data);
        };
        loadInterested();

        return () => {
            ignore = true;
        };
    }, [role, activeConversation?.requestId]);

    const sendTypingEvent = () => {
        const client = stompRef.current;
        if (!client?.connected || !activeConversationId) return;
        client.publish({
            destination: `/app/chat/${activeConversationId}`,
            body: JSON.stringify({
                conversationId: activeConversationId,
                content: 'typing',
                messageType: 'TYPING',
            }),
        });
    };

    const handleChangeComposer = (e) => {
        setComposer(e.target.value);
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = window.setTimeout(() => {
            sendTypingEvent();
        }, 1000);
    };

    const handleSend = () => {
        const content = String(composer || '').trim();
        if (!content || !activeConversationId) return;

        const optimistic = {
            id: `local-${Date.now()}`,
            conversationId: activeConversationId,
            content,
            messageType: 'TEXT',
            senderId: user?.id,
            isRead: false,
            sentAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, optimistic]);
        setConversations((prev) => prev.map((c) => String(c.id) === String(activeConversationId)
            ? { ...c, lastMessage: content, lastMessageTime: new Date().toISOString() }
            : c));

        const client = stompRef.current;
        if (client?.connected) {
            client.publish({
                destination: `/app/chat/${activeConversationId}`,
                body: JSON.stringify({
                    conversationId: activeConversationId,
                    content,
                    messageType: 'TEXT',
                }),
            });
        } else {
            appToast.warning('Chưa kết nối realtime', 'Tin nhắn sẽ được gửi khi kết nối lại');
        }

        setComposer('');
    };

    const isMine = (msg) => String(msg?.senderId) === String(user?.id) || String(msg?.senderRole || '').toUpperCase() === role;

    const handleSelectArtisan = async (artisan) => {
        if (!activeConversation?.requestId) return;
        const ok = window.confirm(`Chọn ${artisan?.artisanName || 'nghệ nhân'}? Các cuộc trò chuyện khác sẽ bị đóng`);
        if (!ok) return;

        const artisanId = artisan?.artisanId || artisan?.artisan?.id;
        const res = await selectCustomRequestArtisan(activeConversation.requestId, artisanId);
        if (!res.success) {
            appToast.error('Chọn nghệ nhân thất bại', res.error || 'Vui lòng thử lại');
            return;
        }

        appToast.success('Đã chọn nghệ nhân');
        navigate(`/custom-requests/${activeConversation.requestId}`);
    };

    return (
        <div className="message-page">
            <div className="message-layout">
                <aside className="col-left">
                    <div className="left-header">
                        <h2>Tin nhắn</h2>
                        <input
                            className="search-input"
                            placeholder="Tìm theo tên..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="conversation-list">
                        {loadingConversations ? <div className="empty">Đang tải cuộc trò chuyện...</div> : null}
                        {!loadingConversations && filteredConversations.length === 0 ? <div className="empty">Chưa có tin nhắn nào</div> : null}

                        {filteredConversations.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                className={`conversation-item ${String(activeConversationId) === String(c.id) ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveConversationId(c.id);
                                    navigate(`/messages?conversationId=${c.id}`);
                                }}
                            >
                                <span className="avatar">{initials(c.counterpartName)}</span>
                                <div className="meta">
                                    <div className="row-top">
                                        <strong>{buildConversationName(c)}</strong>
                                        <span>{fmt(c.lastMessageTime)}</span>
                                    </div>
                                    <p>{truncate(c.lastMessage, 30)}</p>
                                    <small>{c.requestTitle}</small>
                                </div>
                                {c.unreadCount > 0 ? <span className="badge">{c.unreadCount}</span> : null}
                            </button>
                        ))}
                    </div>
                </aside>

                <section className="col-center">
                    {!activeConversation ? (
                        <div className="empty-chat">Chọn một cuộc trò chuyện để bắt đầu</div>
                    ) : (
                        <>
                            <header className="chat-header">
                                <div>
                                    <h3>{buildConversationName(activeConversation)}</h3>
                                    <span className={isConnected ? 'online' : 'offline'}>{isConnected ? '● Đang online' : '○ Offline'}</span>
                                </div>
                                <span className="pill">{activeConversation.requestTitle}</span>
                            </header>

                            <div className="chat-body">
                                {loadingMessages ? (
                                    <div className="skeleton-wrap">
                                        <div className="skeleton" />
                                        <div className="skeleton" />
                                        <div className="skeleton short" />
                                    </div>
                                ) : messages.map((m) => {
                                    const mine = isMine(m);
                                    const type = String(m?.messageType || '').toUpperCase();
                                    if (type === 'SYSTEM') {
                                        return <div key={m.id || `${m.sentAt}-system`} className="system-message">{m.content} · {fmt(m.sentAt || m.createdAt)}</div>;
                                    }
                                    return (
                                        <div key={m.id || `${m.sentAt}-${m.content}`} className={`bubble-row ${mine ? 'mine' : 'theirs'}`}>
                                            <div className="bubble">{m.content}</div>
                                            <div className="time">{fmt(m.sentAt || m.createdAt)} {mine && m.isRead ? <span>✓✓</span> : null}</div>
                                        </div>
                                    );
                                })}

                                {typingByConversation[activeConversationId] ? (
                                    <div className="typing">
                                        <span />
                                        <span />
                                        <span />
                                    </div>
                                ) : null}
                                <div ref={bottomRef} />
                            </div>

                            {role === 'ARTISAN' ? (
                                <div className="template-row">
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setComposer(QUOTE_TEMPLATE)}>
                                        Dùng template báo giá
                                    </button>
                                </div>
                            ) : null}

                            <div className="composer-wrap">
                                <textarea
                                    value={composer}
                                    onChange={handleChangeComposer}
                                    placeholder="Nhập tin nhắn..."
                                    rows={3}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                />
                                <button type="button" className="btn btn-primary" onClick={handleSend} disabled={!composer.trim()}>
                                    Gửi
                                </button>
                            </div>
                        </>
                    )}
                </section>

                <aside className="col-right">
                    {activeConversation ? (
                        <>
                            <section className="info-card">
                                <h4>Thông tin yêu cầu</h4>
                                <p className="title">{activeConversation.requestTitle}</p>
                                <p>{truncate(activeConversation.requestDescription, 120)}</p>
                                <p>Ngân sách: {new Intl.NumberFormat('vi-VN').format(activeConversation.minBudget || 0)} - {new Intl.NumberFormat('vi-VN').format(activeConversation.maxBudget || 0)} đ</p>
                            </section>

                            {role === 'CUSTOMER' ? (
                                <section className="info-card">
                                    <h4>Nghệ nhân quan tâm</h4>
                                    {interestedArtisans.map((a) => {
                                        const artisanId = a?.artisanId || a?.artisan?.id;
                                        const selected = String(activeConversation.selectedArtisanId || '') === String(artisanId);
                                        return (
                                            <div key={`${artisanId}`} className="artisan-row">
                                                <span className="avatar sm">{initials(a?.artisanName || a?.artisan?.name)}</span>
                                                <span>{a?.artisanName || a?.artisan?.name || 'Nghệ nhân'}</span>
                                                {selected ? (
                                                    <span className="status-chip">Đã chọn</span>
                                                ) : (
                                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => handleSelectArtisan(a)}>
                                                        Chọn
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </section>
                            ) : null}

                            <section className="info-card">
                                <h4>Trạng thái</h4>
                                <p>Yêu cầu: <span className="status-chip">{activeConversation.requestStatus || 'Đang xử lý'}</span></p>
                                <p className={isConnected ? 'online' : 'offline'}>{isConnected ? '● Đã kết nối' : '○ Mất kết nối'}</p>
                            </section>
                        </>
                    ) : null}
                </aside>
            </div>
        </div>
    );
};

export default MessageCenterPage;
