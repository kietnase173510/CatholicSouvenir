import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    FiCalendar,
    FiCheckCircle,
    FiChevronDown,
    FiChevronLeft,
    FiChevronRight,
    FiClock,
    FiFilter,
    FiPackage,
    FiSearch,
    FiSliders,
    FiUser,
    FiX,
    FiXCircle,
} from 'react-icons/fi';
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
    { key: 'CANCELLED_BY_ARTISAN', label: 'Đã huỷ bởi nghệ nhân' },
    { key: 'CANCELLED_BY_CUSTOMER', label: 'Đã huỷ bởi khách hàng' },
    { key: 'CANCELLED_BY_SYSTEM', label: 'Đã huỷ bởi hệ thống' },
    { key: 'REFUNDED', label: 'Đã hoàn tiền' },
];

const sortOptions = [
    { key: 'NEWEST', label: 'Mới nhất', hint: 'Theo thời gian tạo giảm dần' },
    { key: 'OLDEST', label: 'Cũ nhất', hint: 'Theo thời gian tạo tăng dần' },
];

const quickFilters = [
    { key: 'ALL', label: 'Tất cả', icon: FiFilter },
    { key: 'IN_PROGRESS', label: 'Đang thực hiện', icon: FiClock },
    { key: 'COMPLETED', label: 'Hoàn thành', icon: FiCheckCircle },
    { key: 'CANCELLED', label: 'Đã huỷ', icon: FiXCircle },
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
    if (s === 'CANCELLED_BY_ARTISAN') return 'Đã huỷ bởi nghệ nhân';
    if (s === 'CANCELLED_BY_CUSTOMER') return 'Đã huỷ bởi khách hàng';
    if (s === 'CANCELLED_BY_SYSTEM') return 'Đã huỷ bởi hệ thống';
    if (s === 'REFUNDED') return 'Đã hoàn tiền';
    return 'Chờ xử lý';
};

const getStatusClass = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'IN_PROGRESS') return 'in-progress';
    if (s === 'COMPLETED') return 'completed';
    if (s === 'CANCELLED') return 'cancelled';
    if (s === 'CANCELLED_BY_ARTISAN') return 'cancelled';
    if (s === 'CANCELLED_BY_CUSTOMER') return 'cancelled';
    if (s === 'CANCELLED_BY_SYSTEM') return 'cancelled';
    if (s === 'REFUNDED') return 'refunded';
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
    const [pageInfo, setPageInfo] = useState({ totalPages: 0, totalElements: 0, number: 0 });
    const [allOrders, setAllOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('ALL');
    const [sortOrder, setSortOrder] = useState('NEWEST');
    const [cancellingId, setCancellingId] = useState('');
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [targetCancelOrderId, setTargetCancelOrderId] = useState('');
    const [cancelConfirmText, setCancelConfirmText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [sortDropdownOpen, setSortDropdownOpen] = useState(false);


    useEffect(() => {
        const loadOrders = async () => {
            setLoading(true);
            const firstRes = await getArtisanCustomOrders({ page: 0, size: PAGE_SIZE });

            if (!firstRes.success) {
                setLoading(false);
                setOrders([]);
                setAllOrders([]);
                setPageInfo({ totalPages: 0, totalElements: 0, number: 0 });
                appToast.error('Không tải được đơn tùy chỉnh', firstRes.error || 'Vui lòng thử lại');
                return;
            }

            const firstData = firstRes.data || {};
            const totalPages = Number(firstData.totalPages || 0);
            const totalElements = Number(firstData.totalElements || 0);
            let merged = Array.isArray(firstData.content) ? firstData.content : [];

            if (totalPages > 1) {
                const requests = Array.from({ length: totalPages - 1 }, (_, idx) => getArtisanCustomOrders({ page: idx + 1, size: PAGE_SIZE }));
                const results = await Promise.all(requests);
                results.forEach((res) => {
                    if (!res.success) return;
                    const content = Array.isArray(res.data?.content) ? res.data.content : [];
                    merged = merged.concat(content);
                });
            }

            setOrders(firstData.content || []);
            setAllOrders(merged);
            setPageInfo({
                totalPages,
                totalElements,
                number: 0,
            });
            setLoading(false);
        };

        loadOrders();
    }, []);

    useEffect(() => {
        if (!cancelModalOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [cancelModalOpen]);

    const sourceOrders = useMemo(() => allOrders.length ? allOrders : [], [allOrders]);

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return sourceOrders.filter((order) => {
            const matchesStatus = activeTab === 'ALL' || String(order?.status || '').toUpperCase() === activeTab;
            if (!matchesStatus) return false;
            if (!term) return true;

            const searchable = [
                order?.requestDescription,
                order?.requestTitle,
                order?.description,
                order?.customerName,
                order?.customer?.fullName,
                order?.artisanName,
                order?.artisanEmail,
                order?.status,
                order?.customOrderId,
                order?.orderId,
                order?.id,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchable.includes(term);
        });
    }, [activeTab, searchTerm, sourceOrders]);

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

    const activeSortLabel = sortOptions.find((option) => option.key === sortOrder)?.label || 'Mới nhất';
    const activeStatusLabel = tabs.find((tab) => tab.key === activeTab)?.label || 'Tất cả';
    const filteredTotal = filtered.length;

    const summary = useMemo(() => {
        const inProgress = sourceOrders.filter((order) => String(order?.status || '').toUpperCase() === 'IN_PROGRESS').length;
        const completed = sourceOrders.filter((order) => String(order?.status || '').toUpperCase() === 'COMPLETED').length;
        const cancelled = sourceOrders.filter((order) => String(order?.status || '').toUpperCase() === 'CANCELLED').length;
        return {
            total: pageInfo.totalElements || sourceOrders.length,
            inProgress,
            completed,
            cancelled,
            // paginationText: 'Hiện chưa phân trang, đang hiển thị toàn bộ đơn đã tải.',
        };
    }, [pageInfo, sourceOrders]);
    const totalOrders = summary.total;

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
        fetchAllOrders();
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
                        <strong>{totalOrders}</strong>
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

            <section className="orders-filter-panel">
                <div className="orders-filter-toolbar">
                    <div className="search-box">
                        <FiSearch />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                            }}
                            placeholder="Tìm theo mã đơn, khách hàng, nghệ nhân, mô tả..."
                            aria-label="Tìm kiếm đơn hàng"
                        />
                        {searchTerm ? (
                            <button type="button" className="search-clear-btn" onClick={() => setSearchTerm('')} aria-label="Xoá tìm kiếm">
                                <FiX />
                            </button>
                        ) : null}
                    </div>

                    <div className="dropdown-group">
                        <button
                            type="button"
                            className={`filter-trigger ${statusDropdownOpen ? 'open' : ''}`}
                            onClick={() => {
                                setStatusDropdownOpen((prev) => !prev);
                                setSortDropdownOpen(false);
                            }}
                        >
                            <FiFilter />
                            <span>{activeStatusLabel}</span>
                            <FiChevronDown />
                        </button>
                        <button
                            type="button"
                            className={`filter-trigger ${sortDropdownOpen ? 'open' : ''}`}
                            onClick={() => {
                                setSortDropdownOpen((prev) => !prev);
                                setStatusDropdownOpen(false);
                            }}
                        >
                            <FiSliders />
                            <span>{activeSortLabel}</span>
                            <FiChevronDown />
                        </button>
                    </div>
                </div>

                <div className="filter-chip-row" role="tablist" aria-label="Lọc đơn hàng">
                    {quickFilters.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                className={`filter-chip ${activeTab === tab.key ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveTab(tab.key);
                                }}
                            >
                                <Icon />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="filter-panel-meta">
                    <span>Trạng thái: <strong>{activeStatusLabel}</strong></span>
                    <span>Sắp xếp: <strong>{activeSortLabel}</strong></span>
                    <span>Kết quả: <strong>{filtered.length}</strong></span>
                </div>

                {statusDropdownOpen ? (
                    <div className="filter-dropdown-panel" role="menu" aria-label="Danh sách trạng thái">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                className={`filter-menu-item ${activeTab === tab.key ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveTab(tab.key);
                                    setPage(0);
                                    setStatusDropdownOpen(false);
                                }}
                            >
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                ) : null}

                {sortDropdownOpen ? (
                    <div className="filter-dropdown-panel sort-panel" role="menu" aria-label="Chọn kiểu sắp xếp">
                        {sortOptions.map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                className={`filter-menu-item ${sortOrder === option.key ? 'active' : ''}`}
                                onClick={() => {
                                    setSortOrder(option.key);
                                    setSortDropdownOpen(false);
                                }}
                            >
                                <span>{option.label}</span>
                                <small>{option.hint}</small>
                            </button>
                        ))}
                    </div>
                ) : null}
            </section>

            {loading ? (
                <div className="list-grid">{[1, 2, 3].map((item) => <div key={item} className="artisan-skeleton-card" />)}</div>
            ) : sortedFiltered.length === 0 ? (
                <div className="artisan-empty">Không tìm thấy đơn phù hợp với bộ lọc hiện tại.</div>
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

            <div className="pagination-toolbar pagination-toolbar-bottom">
                    <div className="pagination-info">
                        <strong>{summary.paginationText}</strong>
                        <span>Bộ lọc hiện tại trả về {sortedFiltered.length} đơn</span>
                    </div>
                    <div className="pagination-actions">
                        <button type="button" className="btn btn-outline btn-sm" disabled>
                            <FiChevronLeft /> Trước
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" disabled>
                            Sau <FiChevronRight />
                        </button>
                    </div>
                </div>

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
