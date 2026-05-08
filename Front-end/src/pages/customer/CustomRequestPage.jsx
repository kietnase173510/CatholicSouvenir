import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiArrowRight,
    FiCheckCircle,
    FiChevronLeft,
    FiChevronRight,
    FiClock,
    FiFilter,
    FiGrid,
    FiHash,
    FiImage,
    FiLayers,
    FiList,
    FiLoader,
    FiSearch,
    FiSliders,
    FiStar,
    FiTag,
    FiTruck,
    FiUser,
    FiX,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header/Header';
import { appToast } from '../../lib/appToast';
import { cancelCustomOrder, getCustomerCustomOrders, getCustomOrderDetail, getCustomOrderRefundEstimate } from '../../services/customRequestService';
import './CustomRequestPage.css';

const PAGE_SIZE = 10;

const ORDER_STATUS_META = {
    PENDING_CONFIRMATION: { label: 'Chờ xác nhận', className: 'status-pending' },
    PENDING_PAYMENT: { label: 'Chờ thanh toán', className: 'status-pending' },
    CONFIRMED: { label: 'Đã xác nhận', className: 'status-confirmed' },
    IN_PROGRESS: { label: 'Đang sản xuất', className: 'status-progress' },
    IN_PRODUCTION: { label: 'Đang sản xuất', className: 'status-progress' },
    SHIPPING: { label: 'Đang giao hàng', className: 'status-shipping' },
    DELIVERED: { label: 'Đã giao', className: 'status-delivered' },
    COMPLETED: { label: 'Hoàn thành', className: 'status-completed' },
    CANCELLED: { label: 'Đã huỷ', className: 'status-cancelled' },
    CANCELLED_BY_CUSTOMER: { label: 'Huỷ bởi khách hàng', className: 'status-cancelled' },
    CANCELLED_BY_ARTISAN: { label: 'Huỷ bởi nghệ nhân', className: 'status-cancelled' },
    REFUNDED: { label: 'Đã hoàn tiền', className: 'status-refunded' },
};

const STATUS_OPTIONS = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'PENDING_CONFIRMATION', label: 'Chờ xác nhận' },
    { id: 'PENDING_PAYMENT', label: 'Chờ thanh toán' },
    { id: 'CONFIRMED', label: 'Đã xác nhận' },
    { id: 'IN_PROGRESS', label: 'Đang sản xuất' },
    { id: 'IN_PRODUCTION', label: 'Đang sản xuất' },
    { id: 'SHIPPING', label: 'Đang giao hàng' },
    { id: 'DELIVERED', label: 'Đã giao' },
    { id: 'COMPLETED', label: 'Hoàn thành' },
    { id: 'CANCELLED', label: 'Đã huỷ' },
    { id: 'CANCELLED_BY_CUSTOMER', label: 'Huỷ bởi khách hàng' },
    { id: 'CANCELLED_BY_ARTISAN', label: 'Huỷ bởi nghệ nhân' },
    { id: 'REFUNDED', label: 'Đã hoàn tiền' },
];

const SORT_OPTIONS = [
    { id: 'newest', label: 'Mới nhất' },
    { id: 'oldest', label: 'Cũ nhất' },
    { id: 'price_desc', label: 'Giá cao nhất' },
    { id: 'price_asc', label: 'Giá thấp nhất' },
    { id: 'updated_desc', label: 'Cập nhật mới nhất' },
];

const formatCurrency = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} đ`;

const formatDate = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return value;
    }
};

const getStatusMeta = (status) => {
    const key = String(status || '').toUpperCase();
    return ORDER_STATUS_META[key] || { label: status || 'Không xác định', className: 'status-default' };
};

const getStageStatusMeta = (status) => {
    const key = String(status || '').toUpperCase();
    if (['COMPLETED', 'PAID'].includes(key)) return { label: key === 'PAID' ? 'Đã thanh toán' : 'Hoàn thành', className: 'stage-done' };
    return { label: 'Đang chờ', className: 'stage-waiting' };
};

const clampText = (value, maxLength = 120) => {
    const text = String(value || '').trim();
    if (!text) return '—';
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const translateRefundReason = (reason) => {
    const text = String(reason || '').trim();
    if (!text) return '—';

    const translations = {
        'Stage completed - no refund': 'Giai đoạn đã hoàn thành - không hoàn tiền',
        'Stage not started - full refund': 'Giai đoạn chưa bắt đầu - hoàn tiền toàn bộ',
    };

    return translations[text] || text;
};

const StatCard = ({ icon, label, value, hint }) => (
    <div className="custom-order-stat-card">
        <div className="custom-order-stat-icon">{icon}</div>
        <div>
            <span>{label}</span>
            <strong>{value}</strong>
            {hint ? <p>{hint}</p> : null}
        </div>
    </div>
);

const DetailModalContent = ({ detail, selectedOrderId, setDetailOpen, navigate }) => {
    const statusMeta = getStatusMeta(detail?.status);
    const stages = Array.isArray(detail?.stages) ? detail.stages : [];
    const completedStages = stages.filter((stage) => ['COMPLETED', 'PAID'].includes(String(stage?.status || '').toUpperCase())).length;
    const firstImage = detail?.aiConceptImageUrl || detail?.referenceImageUrl || '';
    const supportMessage = detail?.fullyPaid
        ? 'Đơn hàng đang được theo dõi bình thường. Nếu cần hỗ trợ thêm, bạn có thể liên hệ đội ngũ hỗ trợ.'
        : 'Đơn hàng đang trong quá trình xử lý. Bạn có thể liên hệ hỗ trợ nếu cần kiểm tra thêm về tiến độ.';

    return (
        <div className="custom-order-detail-body">
            <section className="custom-order-detail-order-card">
                <div className="custom-order-detail-order-left">
                    <span className="custom-order-detail-label">Mã đơn hàng</span>
                    <strong className="custom-order-detail-order-code">#{String(detail?.customOrderId || selectedOrderId || '—').slice(0, 18)}</strong>
                </div>
                <div className="custom-order-detail-order-right">
                    <span className="custom-order-detail-label">Trạng thái</span>
                    <span className={`custom-order-status-pill ${statusMeta.className}`}>
                        <FiCheckCircle />
                        <span>{statusMeta.label}</span>
                    </span>
                </div>
            </section>

            <section className="custom-order-detail-section">
                <div className="custom-order-detail-section-head">
                    <h4><FiUser /> Thông tin người dùng</h4>
                </div>
                <div className="custom-order-user-grid">
                    <div className="custom-order-detail-card custom-order-user-card">
                        <div className="custom-order-user-avatar"><FiUser /></div>
                        <div className="custom-order-user-content">
                            <span className="custom-order-detail-label">Khách hàng</span>
                            <strong>{detail?.customerName || '—'}</strong>
                            <p>{detail?.customerEmail || '—'}</p>
                            <p>{detail?.customerPhone || '—'}</p>
                        </div>
                    </div>

                    <div className="custom-order-detail-card custom-order-user-card">
                        <div className="custom-order-user-avatar"><FiUser /></div>
                        <div className="custom-order-user-content">
                            <span className="custom-order-detail-label">Nghệ nhân</span>
                            <strong>{detail?.artisanName || '—'}</strong>
                            <p>{detail?.artisanEmail || '—'}</p>
                            <p>{detail?.artisanPhone || '—'}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="custom-order-detail-section custom-order-detail-content-grid">
                <div className="custom-order-detail-card custom-order-description-card">
                    <div className="custom-order-detail-title-line">
                        <h4><FiList /> Mô tả yêu cầu</h4>
                    </div>
                    <div className="custom-order-detail-description-box">
                        <p className="custom-order-detail-description">{detail?.description || '—'}</p>
                    </div>
                </div>

                <div className="custom-order-detail-card custom-order-ai-card">
                    <div className="custom-order-detail-title-line">
                        <h4><FiImage /> Ý tưởng thiết kế AI</h4>
                    </div>
                    <div className="custom-order-ai-preview">
                        <span className="custom-order-ai-badge">AI Preview</span>
                        {firstImage ? (
                            <img className="custom-order-detail-image" src={firstImage} alt="AI concept" />
                        ) : (
                            <div className="custom-order-detail-empty-preview">
                                <FiImage />
                                <span>Chưa có ảnh concept</span>
                            </div>
                        )}
                    </div>
                    <div className="custom-order-detail-total-price">
                        <span>Tổng giá trị</span>
                        <strong>{formatCurrency(detail?.totalPrice)}</strong>
                    </div>
                </div>
            </section>

            <section className="custom-order-detail-section">
                <div className="custom-order-detail-card">
                    <div className="custom-order-detail-section-head">
                        <h4><FiLayers /> Tiến độ thanh toán</h4>
                    </div>
                    <div className="custom-order-stage-table-wrap">
                        <table className="custom-order-stage-table">
                            <thead>
                                <tr>
                                    <th>Tên stage</th>
                                    <th>Mô tả</th>
                                    <th>Tỷ lệ</th>
                                    <th>Số tiền</th>
                                    <th>Trạng thái</th>
                                    <th>Ngày cập nhật</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stages.length > 0 ? (
                                    stages.map((stage) => {
                                        const meta = getStageStatusMeta(stage?.status);
                                        return (
                                            <tr key={stage?.stageId || `${stage?.stageOrder}-${stage?.stageName}`}>
                                                <td>{stage?.stageName || 'Stage'}</td>
                                                <td>{clampText(stage?.description, 120)}</td>
                                                <td>{stage?.percentage ?? 0}%</td>
                                                <td>{formatCurrency(stage?.amount)}</td>
                                                <td className="custom-order-stage-status-cell">
                                                    <span className={`custom-order-stage-pill ${meta.className}`}>{meta.label}</span>
                                                </td>
                                                <td>{formatDate(stage?.completedAt || stage?.paidAt || stage?.createdAt)}</td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="6">
                                            <div className="custom-order-empty">Chưa có stage nào cho đơn hàng này.</div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <footer className="custom-order-detail-footer">
                <div className="custom-order-detail-footer-message">
                    <FiTruck />
                    <span>{supportMessage}</span>
                </div>
                <div className="custom-order-detail-footer-actions">
                    <button type="button" className="btn btn-outline btn-large" onClick={() => setDetailOpen(false)}>
                        Đóng
                    </button>
                    <button type="button" className="btn btn-primary btn-large" onClick={onCancelOrder}>
                        Hủy đơn hàng
                    </button>
                </div>
            </footer>
        </div>
    );
};

const CustomRequestPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const [statusFilter, setStatusFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('newest');
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(0);
    const [pageData, setPageData] = useState({ content: [], totalPages: 0, totalElements: 0, number: 0, size: PAGE_SIZE });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detail, setDetail] = useState(null);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelEstimateLoading, setCancelEstimateLoading] = useState(false);
    const [cancelRefundEstimate, setCancelRefundEstimate] = useState(null);
    const [cancellingOrder, setCancellingOrder] = useState(false);
    const [cancelTargetOrder, setCancelTargetOrder] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        let mounted = true;
        const loadOrders = async () => {
            setLoading(true);
            setError('');
            const res = await getCustomerCustomOrders({
                status: statusFilter === 'ALL' ? '' : statusFilter,
                page,
                size: PAGE_SIZE,
            });

            if (!mounted) return;

            if (res.success) {
                setPageData(res.data || { content: [], totalPages: 0, totalElements: 0, number: 0, size: PAGE_SIZE });
            } else {
                setError(res.error || 'Không tải được danh sách đơn hàng theo yêu cầu.');
                setPageData({ content: [], totalPages: 0, totalElements: 0, number: 0, size: PAGE_SIZE });
            }
            setLoading(false);
        };

        loadOrders();
        return () => {
            mounted = false;
        };
    }, [isAuthenticated, navigate, page, statusFilter]);

    const orders = useMemo(() => {
        const list = Array.isArray(pageData?.content) ? [...pageData.content] : [];
        const query = searchText.trim().toLowerCase();

        const filtered = query
            ? list.filter((item) => {
                const haystack = [
                    item?.customOrderId,
                    item?.requestId,
                    item?.customerName,
                    item?.artisanName,
                    item?.status,
                ].join(' ').toLowerCase();
                return haystack.includes(query);
            })
            : list;

        const compareDate = (a, b, field) => new Date(b?.[field] || 0).getTime() - new Date(a?.[field] || 0).getTime();
        const sorted = [...filtered].sort((a, b) => {
            if (sortBy === 'oldest') return compareDate(b, a, 'createdAt');
            if (sortBy === 'price_desc') return Number(b?.totalPrice || 0) - Number(a?.totalPrice || 0);
            if (sortBy === 'price_asc') return Number(a?.totalPrice || 0) - Number(b?.totalPrice || 0);
            if (sortBy === 'updated_desc') return compareDate(a, b, 'updatedAt');
            return compareDate(a, b, 'createdAt');
        });

        return sorted;
    }, [pageData, searchText, sortBy]);

    const summary = useMemo(() => {
        const list = Array.isArray(pageData?.content) ? pageData.content : [];
        return {
            total: Number(pageData?.totalElements ?? list.length ?? 0),
            completed: list.filter((item) => String(item?.status || '').toUpperCase() === 'COMPLETED').length,
            inProgress: list.filter((item) => ['IN_PROGRESS', 'IN_PRODUCTION', 'SHIPPING'].includes(String(item?.status || '').toUpperCase())).length,
            cancelled: list.filter((item) => String(item?.status || '').toUpperCase().includes('CANCELLED')).length,
        };
    }, [pageData]);

    const openDetail = async (orderId) => {
        if (!orderId) return;

        setSelectedOrderId(orderId);
        setDetailOpen(true);
        setDetailLoading(true);
        setDetail(null);

        const res = await getCustomOrderDetail(orderId);
        if (res.success) {
            setDetail(res.data || null);
        } else {
            appToast.error('Không tải được chi tiết đơn hàng', res.error || 'Vui lòng thử lại');
        }
        setDetailLoading(false);
    };

    const openCancelModal = async (orderId) => {
        if (!orderId) return;
        setCancelTargetOrder(orderId);
        setCancelReason('');
        setCancelRefundEstimate(null);
        setCancelModalOpen(true);
        setCancelEstimateLoading(true);

        const res = await getCustomOrderRefundEstimate(orderId);
        setCancelEstimateLoading(false);
        if (res.success) {
            setCancelRefundEstimate(res.data || null);
        } else {
            appToast.warning('Không tải được ước tính hoàn tiền', res.error || 'Vui lòng thử lại');
        }
    };

    const closeCancelModal = () => {
        if (cancellingOrder) return;
        setCancelModalOpen(false);
        setCancelReason('');
        setCancelRefundEstimate(null);
        setCancelTargetOrder(null);
    };

    const handleCancelOrder = async () => {
        const reason = cancelReason.trim();
        if (!cancelTargetOrder || cancellingOrder) return;
        if (!reason) {
            appToast.warning('Vui lòng nhập lý do huỷ đơn');
            return;
        }

        setCancellingOrder(true);
        const res = await cancelCustomOrder(cancelTargetOrder, reason);
        setCancellingOrder(false);

        if (!res.success) {
            appToast.error('Không thể huỷ đơn', res.error || 'Vui lòng thử lại');
            return;
        }

        appToast.success('Đã huỷ đơn hàng');
        setCancelModalOpen(false);
        setCancelReason('');
        setCancelRefundEstimate(null);
        setCancelTargetOrder(null);
        await openDetail(cancelTargetOrder);
    };

    const totalPages = Number(pageData?.totalPages || 0);
    const currentPage = Number(pageData?.number ?? page);

    return (
        <div className="custom-request-page">
            <Header />
            <main className="custom-request-page-main custom-order-page-main">
                <section className="custom-order-hero">
                    <div className="custom-order-hero-content">
                        <div className="custom-order-badge">Quản lí đơn hàng theo yêu cầu</div>
                        <h1 className="custom-request-title">Theo dõi tiến độ, thanh toán và trạng thái đơn custom của bạn</h1>
                        <p className="custom-request-subtitle">
                            Xem danh sách đơn hàng, lọc theo trạng thái, sắp xếp theo nhu cầu và mở chi tiết từng đơn để kiểm tra tiến độ các stage.
                        </p>

                        <div className="custom-request-actions">
                            <button type="button" className="btn btn-primary btn-large" onClick={() => navigate('/custom-order')}>
                                Tạo yêu cầu mới
                            </button>
                            <button type="button" className="btn btn-outline btn-large" onClick={() => navigate('/custom-requests')}>
                                Quản lí yêu cầu gốc
                            </button>
                        </div>

                        <div className="custom-order-stats-grid">
                            <StatCard icon={<FiLayers />} label="Tổng đơn" value={summary.total} hint="Theo trang hiện tại hoặc tổng từ API" />
                            <StatCard icon={<FiClock />} label="Đang xử lí" value={summary.inProgress} hint="Bao gồm Đang tiến hành, Đang sản xuất, Đang vận chuyển" />
                            <StatCard icon={<FiCheckCircle />} label="Hoàn thành" value={summary.completed} hint="Đơn đã hoàn tất" />
                            <StatCard icon={<FiX />} label="Đã huỷ" value={summary.cancelled} hint="Bao gồm mọi trạng thái huỷ" />
                        </div>
                    </div>

                    <div className="custom-order-hero-card">
                        <div className="custom-order-hero-card-top">
                            <FiStar />
                            <span>Luồng quản lí đơn custom</span>
                        </div>
                        <div className="custom-order-flow">
                            <div>
                                <FiFilter />
                                <div>
                                    <strong>Lọc trạng thái</strong>
                                    <p>Chọn nhanh từ menu trạng thái.</p>
                                </div>
                            </div>
                            <div>
                                <FiSliders />
                                <div>
                                    <strong>Sắp xếp</strong>
                                    <p>Theo mới nhất, giá, hoặc cập nhật.</p>
                                </div>
                            </div>
                            <div>
                                <FiGrid />
                                <div>
                                    <strong>Xem chi tiết</strong>
                                    <p>Theo dõi thông tin khách hàng, nghệ nhân và stages.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="custom-order-management-card">
                    <div className="custom-order-toolbar">
                        <div className="custom-order-search">
                            <FiSearch />
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Tìm theo mã đơn, request, khách hàng, nghệ nhân..."
                            />
                        </div>

                        <div className="custom-order-select-group">
                            <label>
                                <FiFilter />
                                <select value={statusFilter} onChange={(e) => { setPage(0); setStatusFilter(e.target.value); }}>
                                    {STATUS_OPTIONS.map((item) => (
                                        <option key={item.id} value={item.id}>{item.label}</option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                <FiSliders />
                                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                    {SORT_OPTIONS.map((item) => (
                                        <option key={item.id} value={item.id}>{item.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    <div className="custom-order-list-head">
                        <div>
                            <h2>Danh sách đơn custom</h2>
                            <p>{loading ? 'Đang tải dữ liệu...' : `${pageData?.totalElements ?? orders.length} đơn hàng`}</p>
                        </div>
                        <div className="custom-order-list-mode">
                            <FiList />
                            <span>Trang {currentPage + 1} / {Math.max(1, totalPages || 1)}</span>
                        </div>
                    </div>

                    {error ? <div className="custom-order-alert">{error}</div> : null}

                    <div className="custom-order-table-wrap">
                        <table className="custom-order-table">
                            <thead>
                                <tr>
                                    <th>Mã đơn</th>
                                    <th>Khách hàng</th>
                                    <th>Nghệ nhân</th>
                                    <th>Trạng thái</th>
                                    <th>Tổng tiền</th>
                                    <th>Ngày tạo</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="7">
                                            <div className="custom-order-empty">
                                                <FiLoader className="spin" />
                                                <span>Đang tải danh sách đơn hàng...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : orders.length > 0 ? orders.map((order) => {
                                    const statusMeta = getStatusMeta(order?.status);
                                    return (
                                        <tr key={order?.customOrderId || order?.requestId}>
                                            <td>
                                                <div className="custom-order-id-cell">
                                                    <strong>{String(order?.customOrderId || '').slice(0, 8) || '—'}</strong>
                                                    <span>{String(order?.requestId || '').slice(0, 8) || '—'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="custom-order-person-cell">
                                                    <FiUser />
                                                    <span>{order?.customerName || '—'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="custom-order-person-cell">
                                                    <FiUser />
                                                    <span>{order?.artisanName || '—'}</span>
                                                </div>
                                            </td>
                                            <td><span className={`custom-order-status-pill ${statusMeta.className}`}>{statusMeta.label}</span></td>
                                            <td>{formatCurrency(order?.totalPrice)}</td>
                                            <td>{formatDate(order?.createdAt)}</td>
                                            <td>
                                                <div className="custom-order-action-cell">
                                                    <button type="button" className="btn btn-outline btn-small" onClick={() => openDetail(order?.customOrderId)}>
                                                        Xem chi tiết 
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-danger btn-small"
                                                        onClick={() => openCancelModal(order?.customOrderId)}
                                                        disabled={!['IN_PROGRESS', 'IN_PRODUCTION'].includes(String(order?.status || '').toUpperCase())}
                                                        title={['IN_PROGRESS', 'IN_PRODUCTION'].includes(String(order?.status || '').toUpperCase()) ? 'Huỷ đơn' : 'Chỉ có thể huỷ khi đơn đang sản xuất'}
                                                    >
                                                        Hủy đơn
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="7">
                                            <div className="custom-order-empty">
                                                <FiTag />
                                                <span>Không tìm thấy đơn hàng phù hợp.</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="custom-order-pagination">
                        <button type="button" className="btn btn-outline btn-small" disabled={currentPage <= 0 || loading} onClick={() => setPage((prev) => Math.max(0, prev - 1))}>
                            <FiChevronLeft />
                            Trước
                        </button>
                        <div className="custom-order-pagination-info">
                            <FiHash />
                            <span>Trang {currentPage + 1}</span>
                        </div>
                        <button type="button" className="btn btn-outline btn-small" disabled={loading || totalPages <= currentPage + 1} onClick={() => setPage((prev) => prev + 1)}>
                            Sau
                            <FiChevronRight />
                        </button>
                    </div>
                </section>
            </main>

            {detailOpen && (
                <div className="custom-order-modal-overlay" onClick={() => setDetailOpen(false)} role="button" tabIndex={0}>
                    <div className="custom-order-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Chi tiết đơn hàng theo yêu cầu">
                        <div className="custom-order-modal-header">
                            <div>
                                <h2>Chi tiết đơn custom</h2>
                                <p>{selectedOrderId ? `Mã đơn: ${selectedOrderId}` : 'Thông tin đầy đủ về đơn hàng'}</p>
                            </div>
                            <button type="button" className="custom-order-modal-close" onClick={() => setDetailOpen(false)} aria-label="Đóng modal">
                                <FiX />
                            </button>
                        </div>

                        {detailLoading ? (
                            <div className="custom-order-detail-loading">
                                <FiLoader className="spin" />
                                <span>Đang tải chi tiết đơn hàng...</span>
                            </div>
                        ) : detail ? (
                            <DetailModalContent
                                detail={detail}
                                selectedOrderId={selectedOrderId}
                                setDetailOpen={setDetailOpen}
                                navigate={navigate}
                            />
                        ) : (
                            <div className="custom-order-empty">Không có dữ liệu chi tiết.</div>
                        )}
                    </div>
                </div>
            )}

            {cancelModalOpen && (
                <div className="custom-order-modal-overlay custom-order-cancel-overlay" onClick={closeCancelModal} role="button" tabIndex={0}>
                    <div className="custom-order-cancel-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Huỷ đơn hàng">
                        <div className="custom-order-cancel-header">
                            <div>
                                <h2>Huỷ đơn hàng</h2>
                                <p>{cancelTargetOrder ? `Mã đơn: ${cancelTargetOrder}` : 'Xem ước tính hoàn tiền trước khi xác nhận'}</p>
                            </div>
                            <button type="button" className="custom-order-cancel-close" onClick={closeCancelModal} aria-label="Đóng modal">
                                <FiX />
                            </button>
                        </div>

                        <div className="custom-order-cancel-body">
                            <div className="custom-order-cancel-summary">
                                <div className="custom-order-cancel-summary-head">
                                    <strong>Ước tính hoàn tiền</strong>
                                    {cancelEstimateLoading ? <span>Đang tải...</span> : null}
                                </div>
                                <div className="custom-order-cancel-summary-grid">
                                    <div>
                                        <span>Gộp</span>
                                        <strong>{cancelEstimateLoading ? '...' : formatCurrency(cancelRefundEstimate?.grossRefundAmount ?? 0)}</strong>
                                    </div>
                                    <div>
                                        <span>Hoa hồng</span>
                                        <strong>{cancelEstimateLoading ? '...' : `- ${formatCurrency(cancelRefundEstimate?.platformCommission ?? 0)}`}</strong>
                                    </div>
                                    <div>
                                        <span>Thực nhận</span>
                                        <strong>{cancelEstimateLoading ? '...' : formatCurrency(cancelRefundEstimate?.netRefundAmount ?? 0)}</strong>
                                    </div>
                                    <div>
                                        <span>Khả năng huỷ</span>
                                        <strong>{cancelEstimateLoading ? '...' : (cancelRefundEstimate?.canCancel ? 'Có thể huỷ' : 'Không thể huỷ')}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="custom-order-cancel-breakdown">
                                <strong>Chi tiết từng stage</strong>
                                {cancelEstimateLoading ? (
                                    <div className="custom-order-cancel-empty">Đang tải dữ liệu...</div>
                                ) : Array.isArray(cancelRefundEstimate?.stageBreakdown) && cancelRefundEstimate.stageBreakdown.length > 0 ? (
                                    cancelRefundEstimate.stageBreakdown.map((stage, index) => (
                                        <div key={`${stage?.stageId || index}`} className="custom-order-cancel-breakdown-item">
                                            <div className="custom-order-cancel-breakdown-head">
                                                <span>{stage?.stageName || `Giai đoạn ${index + 1}`}</span>
                                                <strong>{stage?.refundPercentage != null ? `${stage.refundPercentage}%` : '—'}</strong>
                                            </div>
                                            <div className="custom-order-cancel-breakdown-meta">
                                                <span>Đã thanh toán: {formatCurrency(stage?.paidAmount ?? 0)}</span>
                                                <span>Gộp: {formatCurrency(stage?.grossRefund ?? 0)}</span>
                                                <span>Hoa hồng: {formatCurrency(stage?.platformCommission ?? 0)}</span>
                                                <span>Thực nhận: {formatCurrency(stage?.netRefund ?? 0)}</span>
                                                <span>Lý do: {translateRefundReason(stage?.refundReason)}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="custom-order-cancel-empty">Chưa có dữ liệu hoàn tiền.</div>
                                )}
                            </div>

                            <div className="custom-order-cancel-reason">
                                <label htmlFor="cancel-reason-input">Lý do huỷ</label>
                                <textarea
                                    id="cancel-reason-input"
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder="Nhập lý do huỷ đơn..."
                                    disabled={cancellingOrder}
                                />
                            </div>
                        </div>

                        <div className="custom-order-cancel-footer">
                            <button type="button" className="btn btn-outline btn-large" onClick={closeCancelModal} disabled={cancellingOrder}>
                                Hủy
                            </button>
                            <button type="button" className="btn btn-danger btn-large" onClick={handleCancelOrder} disabled={cancellingOrder}>
                                {cancellingOrder ? 'Đang huỷ...' : 'Xác nhận huỷ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomRequestPage;
