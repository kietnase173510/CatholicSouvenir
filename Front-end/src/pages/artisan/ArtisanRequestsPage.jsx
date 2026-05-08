import React, { memo, useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { appToast } from '../../lib/appToast';
import { getArtisanCustomRequests, getOpenCustomRequests } from '../../services/customRequestService';
import { getMyConversations, startConversation } from '../../services/chatService';
import './ArtisanRequestsPage.css';

const formatCurrency = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} đ`;

const formatDate = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString('vi-VN');
    } catch {
        return value;
    }
};

const truncate = (value, max = 120) => {
    const text = String(value || '').trim();
    if (!text) return 'Yêu cầu đặt làm riêng';
    return text.length > max ? `${text.slice(0, max)}...` : text;
};

const getRequestId = (item) => item?.requestId ?? item?.id ?? item?.customRequestId;

const budgetOptions = [
    { key: 'ALL', label: 'Mọi ngân sách' },
    { key: 'UNDER_2M', label: 'Dưới 2.000.000 đ' },
    { key: '2M_5M', label: '2.000.000 - 5.000.000 đ' },
    { key: 'ABOVE_5M', label: 'Trên 5.000.000 đ' },
];

const statusOptions = [
    { key: 'ALL', label: 'Tất cả trạng thái' },
    { key: 'ARTISAN_SELECTED', label: 'Đã chọn nghệ nhân' },
    { key: 'IN_PROGRESS', label: 'Đang thực hiện' },
    { key: 'COMPLETED', label: 'Hoàn thành' },
    { key: 'CANCELLED', label: 'Đã huỷ' },
    // { key: 'CLOSED', label: 'Đã đóng' },
];

const viewOptions = [
    { key: 'OPEN', label: 'Đơn đang mở' },
    { key: 'DEFAULT', label: 'Đơn của tôi' },
];

const RequestFilters = memo(({ search, onSearchChange, statusFilter, onStatusChange, budgetFilter, onBudgetChange, activeView, onViewChange }) => (
    <header className="artisan-page-header">
        <div>
            <h1>Yêu cầu đặt làm riêng</h1>
            <p>Các yêu cầu từ khách hàng đang tìm nghệ nhân</p>
        </div>
        <div className="artisan-page-header-center">
            <div className="artisan-view-toggle" role="tablist" aria-label="Chọn chế độ xem yêu cầu">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeView === 'OPEN'}
                    className={activeView === 'OPEN' ? 'is-active' : ''}
                    onClick={() => onViewChange('OPEN')}
                >
                    {viewOptions[0].label}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeView === 'DEFAULT'}
                    className={activeView === 'DEFAULT' ? 'is-active' : ''}
                    onClick={() => onViewChange('DEFAULT')}
                >
                    {viewOptions[1].label}
                </button>
            </div>
        </div>
        <div className="artisan-requests-toolbar">
            <div className="artisan-requests-filters">
                <input type="search" placeholder="Tìm theo mô tả yêu cầu..." value={search} onChange={(e) => onSearchChange(e.target.value)} />
                {activeView !== 'OPEN' && (
                    <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)}>
                        {statusOptions.map((option) => (
                            <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                    </select>
                )}
                <select value={budgetFilter} onChange={(e) => onBudgetChange(e.target.value)}>
                    {budgetOptions.map((option) => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                </select>
            </div>
        </div>
    </header>
));

const RequestList = memo(({ loading, filtered, page, totalPages, onPrev, onNext, navigate, conversationByRequest, startConversationHandler }) => {
    if (loading) {
        return (
            <div className="artisan-requests-grid">
                {[1, 2, 3].map((item) => <div key={item} className="artisan-skeleton-card" />)}
            </div>
        );
    }

    if (filtered.length === 0) {
        return <div className="artisan-empty">Không có yêu cầu phù hợp với bộ lọc hiện tại</div>;
    }

    return (
        <>
            <div className="artisan-requests-grid">
                {filtered.map((item) => {
                    const id = getRequestId(item);
                    const refs = Array.isArray(item?.referenceImages) ? item.referenceImages : [];
                    const customerName = item?.customerName || item?.customer?.fullName || item?.customer?.name || 'Khách hàng';
                    const status = String(item?.status || '').toUpperCase();
                    const canCreateCustomOrder = status === 'ARTISAN_SELECTED';
                    const statusLabel = status === 'OPEN' ? 'Đang mở' : status === 'ARTISAN_SELECTED' ? 'Đã chọn nghệ nhân' : status === 'IN_PROGRESS' ? 'Đang thực hiện' : status === 'COMPLETED' ? 'Hoàn thành' : status === 'CANCELLED' ? 'Đã huỷ' : status === 'CLOSED' ? 'Đã đóng' : status || 'Không xác định';

                    return (
                        <article key={String(id)} className="artisan-request-card unified-card">
                            <header className="card-header-block">
                                <div className="card-title-row">
                                    <h3 title={truncate(item?.description, 70)}>{truncate(item?.description, 70)}</h3>
                                    <span className="status-badge status-open">{statusLabel}</span>
                                </div>
                                <div className="card-meta-row">
                                    <span>{formatDate(item?.createdAt)}</span>
                                    <span>{formatCurrency(item?.minBudget)} – {formatCurrency(item?.maxBudget)}</span>
                                </div>
                            </header>
                            <div className="card-body-block">
                                <p className="card-description">{truncate(item?.description, 140)}</p>
                                <div className="card-avatar-row">
                                    <div className="card-avatar">{String(customerName || 'K').trim().slice(0, 2).toUpperCase()}</div>
                                    <div>
                                        <strong>{customerName}</strong>
                                        <p>Khách hàng</p>
                                    </div>
                                </div>
                                <div className="thumbs">
                                    {item?.aiGeneratedImageUrl && <img src={item.aiGeneratedImageUrl} alt="AI" />}
                                    {refs.slice(0, 3).map((url) => <img key={url} src={url} alt="ref" />)}
                                </div>
                            </div>
                            <footer className="card-footer-block">
                                <div className="artisan-request-actions">
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate(`/artisan/requests/${id}`)}>
                                        Xem chi tiết
                                    </button>
                                    {canCreateCustomOrder ? (
                                        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate(`/artisan/requests/${id}/custom-order`)}>
                                            Tạo đơn
                                        </button>
                                    ) : (
                                        <button type="button" className="btn btn-outline btn-sm" disabled title="Chỉ tạo custom order khi khách đã chọn nghệ nhân">
                                            Chưa chọn
                                        </button>
                                    )}
                                    <button type="button" className="btn btn-primary btn-sm" onClick={async () => {
                                        const existingConversationId = conversationByRequest[String(id)];
                                        if (existingConversationId) {
                                            navigate(`/artisan/messages?conversationId=${existingConversationId}`);
                                            return;
                                        }

                                        await startConversationHandler(id);
                                    }}>
                                        {conversationByRequest[String(id)] ? 'Tiếp tục trò chuyện' : 'Bắt đầu trò chuyện'}
                                    </button>
                                </div>
                            </footer>
                        </article>
                    );
                })}
            </div>

            <div className="artisan-pagination">
                <button type="button" className="btn btn-outline btn-sm" disabled={page <= 0} onClick={onPrev}>Trang trước</button>
                <span>Trang {page + 1} / {Math.max(1, totalPages || 1)}</span>
                <button type="button" className="btn btn-outline btn-sm" disabled={totalPages > 0 && page + 1 >= totalPages} onClick={onNext}>Trang sau</button>
            </div>
        </>
    );
});

const ArtisanRequestsPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);
    const [search, setSearch] = useState('');
    const [budgetFilter, setBudgetFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [page, setPage] = useState(0);
    const [size] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [conversationByRequest, setConversationByRequest] = useState({});
    const [activeView, setActiveView] = useState('DEFAULT');

    const handleSearchChange = useCallback((value) => setSearch(value), []);
    const handleStatusChange = useCallback((value) => {
        setStatusFilter(value);
        setPage(0);
    }, []);
    const handleBudgetChange = useCallback((value) => setBudgetFilter(value), []);
    const handleViewChange = useCallback((value) => {
        setActiveView(value);
        setPage(0);
    }, []);
    const handlePrevPage = useCallback(() => setPage((current) => Math.max(0, current - 1)), []);
    const handleNextPage = useCallback(() => setPage((current) => current + 1), []);

    const startConversationHandler = useCallback(async (requestId) => {
        const startRes = await startConversation(requestId);
        if (!startRes.success) {
            appToast.error('Không thể bắt đầu trò chuyện', startRes.error || 'Vui lòng thử lại');
            return;
        }

        appToast.success('Đã bắt đầu cuộc trò chuyện');
        const conversationId = startRes?.data?.id ?? startRes?.data?.conversationId;
        if (conversationId) navigate(`/artisan/messages?conversationId=${conversationId}`);
        else navigate('/artisan/messages');
    }, [navigate]);

    useEffect(() => {
        let ignore = false;
        const fetchOpenRequests = async () => {
            setLoading(true);
            const requestsPromise = activeView === 'OPEN'
                ? getOpenCustomRequests({ page, size })
                : getArtisanCustomRequests({ status: statusFilter, page, size });

            if (activeView === 'OPEN' && statusFilter !== 'OPEN') {
                setStatusFilter('OPEN');
            }

            const [res, convRes] = await Promise.all([
                requestsPromise,
                getMyConversations(),
            ]);
            if (ignore) return;
            setLoading(false);

            if (!res.success) {
                setRequests([]);
                setTotalPages(0);
                appToast.error('Không tải được yêu cầu', res.error || 'Vui lòng thử lại');
                return;
            }

            setRequests(Array.isArray(res.data?.content) ? res.data.content : []);
            setTotalPages(Number(res.data?.totalPages || 0));

            if (convRes.success) {
                const map = (convRes.data || []).reduce((acc, item) => {
                    const key = item?.requestId ?? item?.customRequestId;
                    if (key) acc[String(key)] = item?.id ?? item?.conversationId;
                    return acc;
                }, {});
                setConversationByRequest(map);
            }
        };

        fetchOpenRequests();
        return () => {
            ignore = true;
        };
    }, [activeView, page, size, statusFilter]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return requests.filter((item) => {
            const description = String(item?.description || '').toLowerCase();
            const inSearch = !q || description.includes(q);
            if (!inSearch) return false;

            const min = Number(item?.minBudget || 0);
            const max = Number(item?.maxBudget || 0);
            if (budgetFilter === 'UNDER_2M') return max > 0 && max < 2000000;
            if (budgetFilter === '2M_5M') return min >= 2000000 && max <= 5000000;
            if (budgetFilter === 'ABOVE_5M') return max >= 5000000;
            return true;
        });
    }, [budgetFilter, requests, search]);

    return (
        <div className="artisan-requests-page">
            <RequestFilters
                search={search}
                onSearchChange={handleSearchChange}
                statusFilter={statusFilter}
                onStatusChange={handleStatusChange}
                budgetFilter={budgetFilter}
                onBudgetChange={handleBudgetChange}
                activeView={activeView}
                onViewChange={handleViewChange}
            />

            <RequestList
                loading={loading}
                filtered={filtered}
                page={page}
                totalPages={totalPages}
                onPrev={handlePrevPage}
                onNext={handleNextPage}
                navigate={navigate}
                conversationByRequest={conversationByRequest}
                startConversationHandler={startConversationHandler}
            />
        </div>
    );
};

export default ArtisanRequestsPage;
