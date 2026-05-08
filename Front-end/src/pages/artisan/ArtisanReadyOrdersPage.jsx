import React, { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiEye, FiPackage, FiUser, FiX } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { appToast } from '../../lib/appToast';
import { getOrderDetail, getOrdersByArtisan } from '../../services/orderService';
import './ArtisanOrdersPage.css';

const PAGE_SIZE = 9;

const formatCurrency = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} đ`;

const formatDateTime = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString('vi-VN');
    } catch {
        return value;
    }
};

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
    if (s === 'PAID') return 'Đã thanh toán';
    if (s === 'DELIVERED') return 'Đã giao';
    if (s === 'SHIPPING') return 'Đang giao';
    if (s === 'CANCELLED') return 'Đã huỷ';
    return s || 'Chờ xử lý';
};

const getStatusClass = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'PAID') return 'in-progress';
    if (s === 'DELIVERED') return 'completed';
    if (s === 'CANCELLED') return 'cancelled';
    return 'pending';
};

const statusOptions = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'PAID', label: 'Đã thanh toán' },
    { value: 'SHIPPING', label: 'Đang giao' },
    { value: 'DELIVERED', label: 'Đã giao' },
    { value: 'CANCELLED', label: 'Đã huỷ' },
];

const sortOptions = [
    { value: 'DESC', label: 'Mới nhất' },
    { value: 'ASC', label: 'Cũ nhất' },
];

const ArtisanReadyOrdersPage = () => {
    const { user } = useAuth();
    const artisanId = user?.accountId || user?.id || user?.userId || '';

    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [statusFilter, setStatusFilter] = useState('');
    const [sortDirection, setSortDirection] = useState('DESC');
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    useEffect(() => {
        let ignore = false;

        const load = async () => {
            if (!artisanId) {
                setLoading(false);
                setOrders([]);
                setPage(0);
                setTotalPages(0);
                setTotalElements(0);
                return;
            }

            setLoading(true);
            const res = await getOrdersByArtisan(artisanId, { page, size: PAGE_SIZE, sortBy: 'createAt', sortDirection });
            if (ignore) return;
            setLoading(false);

            if (!res.success) {
                setOrders([]);
                setTotalPages(0);
                setTotalElements(0);
                appToast.error('Không tải được đơn hàng sẵn', res.error || 'Vui lòng thử lại');
                return;
            }

            const nextOrders = Array.isArray(res.data?.content) ? res.data.content : [];
            const filteredOrders = statusFilter ? nextOrders.filter((order) => String(order?.status || '').toUpperCase() === statusFilter) : nextOrders;
            setOrders(filteredOrders);
            setTotalPages(Number(res.data?.totalPages ?? 0));
            setTotalElements(Number(res.data?.totalElements ?? filteredOrders.length ?? 0));
            setPage(Number(res.data?.pageNumber ?? page));
        };

        load();
        return () => {
            ignore = true;
        };
    }, [artisanId, page, sortDirection, statusFilter]);

    const summary = useMemo(() => ({ total: totalElements }), [totalElements]);
    const paginationStart = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
    const paginationEnd = totalElements === 0 ? 0 : page * PAGE_SIZE + orders.length;
    const canGoPrevious = page > 0;
    const canGoNext = totalPages > 0 ? page < totalPages - 1 : orders.length === PAGE_SIZE;

    const handleStatusFilterChange = (event) => {
        setStatusFilter(event.target.value);
        setPage(0);
    };

    const handleSortDirectionChange = (event) => {
        setSortDirection(event.target.value);
        setPage(0);
    };

    const goPrevious = () => {
        if (canGoPrevious) setPage((current) => Math.max(0, current - 1));
    };

    const goNext = () => {
        if (canGoNext) setPage((current) => current + 1);
    };

    const jumpToPage = (targetPage) => {
        if (targetPage >= 0 && (totalPages === 0 || targetPage < totalPages)) {
            setPage(targetPage);
        }
    };

    const closeDetailModal = () => {
        setDetailModalOpen(false);
        setSelectedOrder(null);
        setDetailError('');
    };

    const handleViewDetail = async (orderId) => {
        if (!orderId || detailLoading) return;

        setDetailLoading(true);
        setDetailError('');

        const res = await getOrderDetail(orderId);
        setDetailLoading(false);

        if (!res.success) {
            setSelectedOrder(null);
            setDetailError(res.error || 'Vui lòng thử lại');
            appToast.error('Không tải được chi tiết đơn hàng', res.error || 'Vui lòng thử lại');
            return;
        }

        setSelectedOrder(res.data || null);
        setDetailModalOpen(true);
    };

    const selectedOrderDetails = Array.isArray(selectedOrder?.orderDetails) ? selectedOrder.orderDetails : [];
    const selectedTemplateDetails = Array.isArray(selectedOrder?.templateDetails) ? selectedOrder.templateDetails : [];

    return (
        <div className="artisan-orders-page modern-artisan-orders">
            <header className="artisan-orders-header">
                <div>
                    <p className="page-kicker">Quản lý đơn hàng</p>
                    <h1>Đơn hàng sẵn</h1>
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
            </section>

            <section className="pagination-toolbar artisan-filter-toolbar">
                <div className="pagination-info">
                    <strong>Bộ lọc đơn hàng</strong>
                    <span>Lọc theo trạng thái hoặc sắp xếp theo thời gian tạo</span>
                </div>
                <div className="pagination-actions artisan-filter-actions">
                    <select className="artisan-filter-select" value={statusFilter} onChange={handleStatusFilterChange} aria-label="Lọc trạng thái đơn hàng">
                        {statusOptions.map((option) => (
                            <option key={option.value || 'all'} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <select className="artisan-filter-select" value={sortDirection} onChange={handleSortDirectionChange} aria-label="Sắp xếp đơn hàng">
                        {sortOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            </section>

            {loading ? (
                <div className="list-grid">{[1, 2, 3].map((item) => <div key={item} className="artisan-skeleton-card" />)}</div>
            ) : orders.length === 0 ? (
                <div className="artisan-empty">Chưa có đơn hàng sẵn nào.</div>
            ) : (
                <>
                    <div className="list-grid">
                        {orders.map((order) => {
                            const id = order?.orderId || order?.id;
                            const details = Array.isArray(order?.orderDetails) ? order.orderDetails : [];
                            const firstItem = details[0];

                            return (
                                <article key={String(id)} className="order-card unified-card">
                                    <header className="card-header-block">
                                        <div className="card-title-row">
                                            <h3 title={firstItem?.productName || 'Đơn hàng sẵn'}>{firstItem?.productName || 'Đơn hàng sẵn'}</h3>
                                            <span className={`status-badge ${getStatusClass(order?.status)}`}>{getStatusText(order?.status)}</span>
                                        </div>
                                        <div className="card-meta-row">
                                            <span><FiCalendar /> {formatDate(order?.orderDate || order?.createAt)}</span>
                                            <span><FiUser /> {order?.fullName || 'Khách hàng'}</span>
                                            <strong>{formatCurrency(order?.total)}</strong>
                                        </div>
                                    </header>

                                    <div className="card-body-block">
                                        <p className="card-description">Mã đơn: {id}</p>
                                        <p className="card-description">Sản phẩm: {firstItem?.productName || '—'}</p>
                                        <div className="card-compact-stat">{details.length} sản phẩm • {order?.paymentMethod || '—'}</div>
                                        <button
                                            type="button"
                                            className="btn btn-outline btn-sm"
                                            onClick={() => handleViewDetail(id)}
                                            disabled={detailLoading}
                                        >
                                            <FiEye /> Xem chi tiết
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <div className="pagination-toolbar pagination-toolbar-bottom artisan-pagination-toolbar">
                        <div className="pagination-info">
                            <strong>
                                Hiển thị {paginationStart}-{paginationEnd} trên {summary.total} đơn hàng
                            </strong>
                            <span>9 đơn mỗi trang • Trang {totalElements === 0 ? 0 : page + 1}{totalPages > 0 ? ` / ${totalPages}` : ''}</span>
                        </div>
                        <div className="pagination-actions artisan-pagination-actions">
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => jumpToPage(0)} disabled={!canGoPrevious}>
                                Trang đầu
                            </button>
                            <button type="button" className="btn btn-outline btn-sm" onClick={goPrevious} disabled={!canGoPrevious}>
                                <FiChevronLeft /> Trước
                            </button>
                            <button type="button" className="btn btn-primary btn-sm" disabled>
                                {page + 1}
                            </button>
                            <button type="button" className="btn btn-outline btn-sm" onClick={goNext} disabled={!canGoNext}>
                                Sau <FiChevronRight />
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => jumpToPage(Math.max(totalPages - 1, 0))}
                                disabled={!canGoNext}
                            >
                                Trang cuối
                            </button>
                        </div>
                    </div>
                </>
            )}

            {detailModalOpen && (
                <div className="cancel-modal-overlay" onClick={closeDetailModal}>
                    <div
                        className="cancel-modal shipment-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="order-detail-modal-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="order-detail-modal-header">
                            <div>
                                <p className="page-kicker">Chi tiết đơn hàng</p>
                                <h3 id="order-detail-modal-title">{selectedOrder?.orderId || '—'}</h3>
                            </div>
                            <button type="button" className="btn btn-outline btn-sm" onClick={closeDetailModal}>
                                <FiX /> Đóng
                            </button>
                        </div>

                        {detailLoading ? (
                            <div className="artisan-empty">Đang tải chi tiết đơn hàng...</div>
                        ) : detailError ? (
                            <div className="artisan-empty">{detailError}</div>
                        ) : (
                            <>
                                <div className="detail-summary-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                                    <article className="summary-card">
                                        <span className="summary-icon"><FiUser /></span>
                                        <div>
                                            <p>Khách hàng</p>
                                            <strong>{selectedOrder?.fullName || '—'}</strong>
                                        </div>
                                    </article>
                                    <article className="summary-card">
                                        <span className="summary-icon icon-blue"><FiPackage /></span>
                                        <div>
                                            <p>Trạng thái</p>
                                            <strong>{getStatusText(selectedOrder?.status)}</strong>
                                        </div>
                                    </article>
                                    <article className="summary-card">
                                        <span className="summary-icon icon-green"><FiCalendar /></span>
                                        <div>
                                            <p>Thanh toán</p>
                                            <strong>{selectedOrder?.paymentMethod || '—'}</strong>
                                        </div>
                                    </article>
                                    <article className="summary-card">
                                        <span className="summary-icon icon-amber"><FiCalendar /></span>
                                        <div>
                                            <p>Ngày đặt</p>
                                            <strong>{formatDateTime(selectedOrder?.orderDate || selectedOrder?.createAt)}</strong>
                                        </div>
                                    </article>
                                </div>

                                <div className="detail-layout-grid" style={{ marginTop: '1rem' }}>
                                    <section className="left-col">
                                        <article className="card-box">
                                            <h3>Thông tin thanh toán</h3>
                                            <div className="info-grid">
                                                <div>
                                                    <label>Tổng tiền</label>
                                                    <p>{formatCurrency(selectedOrder?.total)}</p>
                                                </div>
                                                <div>
                                                    <label>Phí giao hàng</label>
                                                    <p>{selectedOrder?.shippingFee == null ? '—' : formatCurrency(selectedOrder.shippingFee)}</p>
                                                </div>
                                                <div>
                                                    <label>Ngày cập nhật</label>
                                                    <p>{formatDateTime(selectedOrder?.updateAt)}</p>
                                                </div>
                                                <div>
                                                    <label>Mã đơn</label>
                                                    <p>{selectedOrder?.orderId || '—'}</p>
                                                </div>
                                            </div>
                                        </article>

                                        <article className="card-box" style={{ marginTop: '1rem' }}>
                                            <h3>Thông tin sản phẩm</h3>
                                            <div className="stages-list">
                                                {selectedOrderDetails.length === 0 ? (
                                                    <div className="artisan-empty">Đơn hàng chưa có sản phẩm.</div>
                                                ) : (
                                                    selectedOrderDetails.map((item) => (
                                                        <div key={item?.id || item?.productId} className="stage-item completed">
                                                            <div className="timeline-dot">✓</div>
                                                            <div className="stage-content">
                                                                <div className="stage-top-row">
                                                                    <h4>{item?.productName || 'Sản phẩm'}</h4>
                                                                    <span className="mini-status completed">{formatCurrency(item?.subTotal)}</span>
                                                                </div>
                                                                <div className="order-detail-product-row">
                                                                    {item?.image ? <img src={item.image} alt={item?.productName || 'product'} className="order-detail-thumb" /> : null}
                                                                    <div>
                                                                        <p>Mã sản phẩm: {item?.productId || '—'}</p>
                                                                        <p>Số lượng: {item?.quantity ?? 0}</p>
                                                                        <p>Đơn giá: {formatCurrency(item?.unitPrice)}</p>
                                                                        <p>Giảm giá: {formatCurrency(item?.discount)}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </article>
                                    </section>

                                    <aside className="right-col">
                                        <article className="card-box side-card">
                                            <h3>Thông tin khách hàng</h3>
                                            <p><FiUser /> <strong>{selectedOrder?.fullName || '—'}</strong></p>
                                            <p>Mã khách hàng: {selectedOrder?.customerId || '—'}</p>
                                        </article>

                                        <article className="card-box side-card" style={{ marginTop: '1rem' }}>
                                            <h3>Template đi kèm</h3>
                                            {selectedTemplateDetails.length === 0 ? (
                                                <p className="muted">Không có template nào trong đơn này.</p>
                                            ) : (
                                                selectedTemplateDetails.map((item, index) => (
                                                    <div key={item?.id || index} style={{ marginTop: index === 0 ? 0 : '0.75rem' }}>
                                                        <strong>{item?.templateName || `Template ${index + 1}`}</strong>
                                                        <p>Số lượng: {item?.quantity ?? 0}</p>
                                                        <p>Đơn giá: {formatCurrency(item?.price || item?.unitPrice || 0)}</p>
                                                    </div>
                                                ))
                                            )}
                                        </article>

                                        <article className="card-box side-card" style={{ marginTop: '1rem' }}>
                                            <h3>Tóm tắt đơn hàng</h3>
                                            <p><span>Trạng thái:</span> <strong>{getStatusText(selectedOrder?.status)}</strong></p>
                                            <p><span>Thanh toán:</span> <strong>{selectedOrder?.paymentMethod || '—'}</strong></p>
                                            <p><span>Ngày tạo:</span> <strong>{formatDateTime(selectedOrder?.createAt)}</strong></p>
                                            <p><span>Cập nhật:</span> <strong>{formatDateTime(selectedOrder?.updateAt)}</strong></p>
                                        </article>
                                    </aside>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArtisanReadyOrdersPage;
