import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCalendar, FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiPackage, FiUser, FiXCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { appToast } from '../../lib/appToast';
import { cancelCustomOrder, getArtisanCustomOrders } from '../../services/customRequestService';
import './ArtisanOrdersPage.css';

const PAGE_SIZE = 9;

const tabs = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'IN_PROGRESS', label: 'Đang thực hiện' },
    { key: 'COMPLETED', label: 'Hoàn thành' },
    { key: 'CANCELLED', label: 'Đã huỷ' },
];

const sortOptions = [
    { key: 'NEWEST', label: 'Mới nhất' },
    { key: 'OLDEST', label: 'Cũ nhất' },
];

const formatCurrency = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} đ`;
const formatDate = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString('vi-VN');
    } catch {
        return value;
    }
};

const getStatusText = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'IN_PROGRESS') return 'Đang thực hiện';
    if (s === 'COMPLETED') return 'Hoàn thành';
    if (s === 'CANCELLED') return 'Đã huỷ';
    return 'Chờ xử lý';
};

const getStatusClass = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'IN_PROGRESS') return 'in-progress';
    if (s === 'COMPLETED') return 'completed';
    if (s === 'CANCELLED') return 'cancelled';
    return 'pending';
};

const getProgress = (order) => {
    const stages = Array.isArray(order?.stages) ? order.stages : [];
    if (!stages.length) return 0;
    const done = stages.filter((s) => String(s?.status || '').toUpperCase() === 'COMPLETED').length;
    return Math.round((done / stages.length) * 100);
};

const ArtisanOrdersPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [page, setPage] = useState(0);
    const [pageInfo, setPageInfo] = useState({ totalPages: 0, totalElements: 0, number: 0 });
    const [activeTab, setActiveTab] = useState('ALL');
    const [sortOrder, setSortOrder] = useState('NEWEST');
    const [cancellingId, setCancellingId] = useState('');
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [targetCancelOrderId, setTargetCancelOrderId] = useState('');
    const [cancelConfirmText, setCancelConfirmText] = useState('');

    const pageCount = Number(pageInfo.totalPages || 0);
    const currentPage = Number(pageInfo.number || page);
    const hasNextPage = currentPage < pageCount - 1;
    const hasPreviousPage = currentPage > 0;

    const fetchOrders = useCallback(async (nextPage = page) => {
        setLoading(true);
        const res = await getArtisanCustomOrders({ page: nextPage, size: PAGE_SIZE });
        setLoading(false);

        if (!res.success) {
            setOrders([]);
            setPageInfo({ totalPages: 0, totalElements: 0, number: nextPage });
            appToast.error('Không tải được đơn tùy chỉnh', res.error || 'Vui lòng thử lại');
            return;
        }

        const data = res.data || {};
        setOrders(Array.isArray(data.content) ? data.content : []);
        setPageInfo({
            totalPages: Number(data.totalPages || 0),
            totalElements: Number(data.totalElements || 0),
            number: Number(data.number || nextPage),
        });
    }, [page]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders(page);
        }, 0);
        return () => clearTimeout(timer);
    }, [fetchOrders, page]);

    useEffect(() => {
        if (!cancelModalOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [cancelModalOpen]);

    const filtered = useMemo(() => {
        if (activeTab === 'ALL') return orders;
        return orders.filter((order) => String(order?.status || '').toUpperCase() === activeTab);
    }, [activeTab, orders]);

    const sortedFiltered = useMemo(() => {
        const toTime = (value) => {
            const time = new Date(value || 0).getTime();
            return Number.isNaN(time) ? 0 : time;
        };

        return [...filtered].sort((a, b) => {
            const aTime = toTime(a?.createdAt);
            const bTime = toTime(b?.createdAt);
            return sortOrder === 'NEWEST' ? bTime - aTime : aTime - bTime;
        });
    }, [filtered, sortOrder]);

    const summary = useMemo(() => {
        const inProgress = orders.filter((order) => String(order?.status || '').toUpperCase() === 'IN_PROGRESS').length;
        const completed = orders.filter((order) => String(order?.status || '').toUpperCase() === 'COMPLETED').length;
        const cancelled = orders.filter((order) => String(order?.status || '').toUpperCase() === 'CANCELLED').length;
        const from = currentPage * PAGE_SIZE + 1;
        const to = Math.min((currentPage + 1) * PAGE_SIZE, pageInfo.totalElements || 0);
        const paginationText = pageInfo.totalElements ? `Hiển thị ${from}–${to} trong tổng ${pageInfo.totalElements} đơn` : 'Hiển thị 0 đơn';
        return {
            total: pageInfo.totalElements || orders.length,
            inProgress,
            completed,
            cancelled,
            paginationText,
        };
    }, [currentPage, orders, pageInfo]);

    const openCancelModal = (orderId) => {
        if (!orderId) return;
        setTargetCancelOrderId(String(orderId));
        setCancelConfirmText('');
        setCancelModalOpen(true);
    };

    const handleCancel = async () => {
        if (!targetCancelOrderId || cancellingId) return;
        if (cancelConfirmText.trim() !== 'Hủy đơn') return;

        setCancellingId(String(targetCancelOrderId));
        const res = await cancelCustomOrder(targetCancelOrderId);
        setCancellingId('');

        if (!res.success) {
            appToast.error('Huỷ đơn thất bại', res.error || 'Vui lòng thử lại');
            return;
        }

        setCancelModalOpen(false);
        setTargetCancelOrderId('');
        setCancelConfirmText('');
        appToast.success('Huỷ đơn thành công');
        fetchOrders();
    };

    return (
        <div className="artisan-orders-page modern-artisan-orders">
            <header className="artisan-orders-header">
                <div>
                    <p className="page-kicker">Quản lý đơn hàng</p>
                    <h1>Đơn hàng tùy chỉnh</h1>
                    <p className="page-subtitle">Theo dõi tiến độ từng yêu cầu, cập nhật trạng thái và thao tác nhanh ngay trên một màn hình.</p>
                </div>
            </header>

            <section className="orders-summary-grid">
                <article className="summary-card">
                    <span className="summary-icon"><FiPackage /></span>
                    <div>
                        <p>Tổng đơn</p>
                        <strong>{summary.total}</strong>
                    </div>
                </article>
                <article className="summary-card">
                    <span className="summary-icon summary-icon-progress"><FiClock /></span>
                    <div>
                        <p>Đang thực hiện</p>
                        <strong>{summary.inProgress}</strong>
                    </div>
                </article>
                <article className="summary-card">
                    <span className="summary-icon summary-icon-completed"><FiCheckCircle /></span>
                    <div>
                        <p>Hoàn thành</p>
                        <strong>{summary.completed}</strong>
                    </div>
                </article>
                <article className="summary-card">
                    <span className="summary-icon summary-icon-cancelled"><FiXCircle /></span>
                    <div>
                        <p>Đã huỷ</p>
                        <strong>{summary.cancelled}</strong>
                    </div>
                </article>
            </section>

            <div className="tabs" role="tablist" aria-label="Lọc đơn hàng">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="tabs sort-tabs" role="tablist" aria-label="Sắp xếp đơn hàng">
                {sortOptions.map((option) => (
                    <button
                        key={option.key}
                        type="button"
                        className={`tab-btn ${sortOrder === option.key ? 'active' : ''}`}
                        onClick={() => setSortOrder(option.key)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="list-grid">{[1, 2, 3].map((item) => <div key={item} className="artisan-skeleton-card" />)}</div>
            ) : sortedFiltered.length === 0 ? (
                <div className="artisan-empty">Không có đơn nào ở trạng thái này.</div>
            ) : (
                <div className="list-grid">
                    {sortedFiltered.map((order) => {
                        const id = order?.customOrderId ?? order?.orderId ?? order?.id;
                        const stages = Array.isArray(order?.stages) ? order.stages : [];
                        const progress = getProgress(order);
                        const status = String(order?.status || '').toUpperCase();

                        return (
                            <article key={String(id)} className="order-card unified-card">
                                <header className="card-header-block">
                                    <div className="card-title-row">
                                        <h3 title={order?.requestDescription || order?.requestTitle || 'Yêu cầu custom'}>{order?.requestDescription || order?.requestTitle || 'Yêu cầu custom'}</h3>
                                        <span className={`status-badge ${getStatusClass(status)}`}>{getStatusText(status)}</span>
                                    </div>
                                    <div className="card-meta-row">
                                        <span><FiCalendar /> {formatDate(order?.createdAt)}</span>
                                        <span><FiUser /> {order?.customerName || order?.customer?.fullName || 'Khách hàng'}</span>
                                        <strong>{formatCurrency(order?.totalPrice)}</strong>
                                    </div>
                                </header>

                                <div className="card-body-block">
                                    <p className="card-description">{order?.description || order?.requestDescription || order?.requestTitle || '—'}</p>
                                    <div className="card-compact-stat">{stages.length} giai đoạn • {progress}% hoàn thành</div>
                                    <div className="card-avatar-row">
                                        <div className="card-avatar">{String(order?.customerName || order?.customer?.fullName || 'KH').trim().slice(0, 2).toUpperCase()}</div>
                                        <div>
                                            <strong>{order?.artisanName || 'Nghệ nhân chưa chọn'}</strong>
                                            <p>{order?.artisanEmail || 'Đang chờ phân công'}</p>
                                        </div>
                                    </div>
                                    <div className="order-stage-badges">
                                        {stages.length === 0 ? (
                                            <span className="no-stage">Chưa có giai đoạn</span>
                                        ) : (
                                            stages.map((stage, idx) => {
                                                const s = String(stage?.status || '').toUpperCase();
                                                const klass = s === 'COMPLETED' ? 'done' : stage?.canComplete ? 'active' : 'idle';
                                                return <span key={`${stage?.id || idx}`} className={`mini-badge ${klass}`}>{idx + 1}</span>;
                                            })
                                        )}
                                    </div>
                                </div>

                                <footer className="card-footer-block">
                                    <div className="card-footer-meta">
                                        <span>Tiến độ: {progress}%</span>
                                    </div>
                                    <div className="actions">
                                        <button
                                            type="button"
                                            className="btn btn-outline btn-sm"
                                            disabled={status === 'COMPLETED' || cancellingId === String(id)}
                                            onClick={() => openCancelModal(id)}
                                        >
                                            {cancellingId === String(id) ? 'Đang huỷ...' : 'Huỷ đơn'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            disabled={!id}
                                            onClick={() => navigate(`/artisan/custom-orders/${id}`)}
                                        >
                                            Quản lý chi tiết
                                        </button>
                                    </div>
                                </footer>
                            </article>
                        );
                    })}
                </div>
            )}

            {!loading && filtered.length > 0 && pageCount > 1 && (
                <div className="pagination-toolbar pagination-toolbar-bottom">
                    <div className="pagination-info">
                        <strong>{summary.paginationText}</strong>
                        <span>Trang {pageCount ? currentPage + 1 : 0} / {pageCount || 0}</span>
                    </div>
                    <div className="pagination-actions">
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                            disabled={!hasPreviousPage || loading}
                        >
                            <FiChevronLeft /> Trước
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setPage((prev) => Math.min(prev + 1, Math.max(pageCount - 1, 0)))}
                            disabled={!hasNextPage || loading}
                        >
                            Sau <FiChevronRight />
                        </button>
                    </div>
                </div>
            )}

            {cancelModalOpen && createPortal(
                <div className="cancel-modal-overlay" onClick={() => setCancelModalOpen(false)} aria-hidden="true">
                    <div className="cancel-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                        <h3>Xác nhận hủy đơn</h3>
                        <p>Để xác nhận, vui lòng nhập chính xác <strong>Hủy đơn</strong> vào ô bên dưới.</p>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Nhập: Hủy đơn"
                            value={cancelConfirmText}
                            onChange={(e) => setCancelConfirmText(e.target.value)}
                        />
                        <div className="cancel-modal-actions">
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setCancelModalOpen(false)}
                                disabled={cancellingId === targetCancelOrderId}
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={handleCancel}
                                disabled={cancelConfirmText.trim() !== 'Hủy đơn' || cancellingId === targetCancelOrderId}
                            >
                                {cancellingId === targetCancelOrderId ? 'Đang hủy...' : 'Hủy đơn'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
};

export default ArtisanOrdersPage;
