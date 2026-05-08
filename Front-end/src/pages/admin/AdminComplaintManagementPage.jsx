import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appToast } from '../../lib/appToast';
import complaintService from '../../services/complaintService';
import './AdminComplaintManagementPage.css';

const PAGE_SIZE = 8;
const COMPLAINT_STATUS_LABELS = {
    PENDING: 'Đang chờ xử lý',
    WAITING_RETURN: 'Chờ khách hoàn hàng',
    RETURN_PENDING: 'Chờ khách hoàn hàng',
    PROCESSING_REFUND: 'Đang xử lý hoàn tiền',
    REFUND_PROCESSING: 'Đang xử lý hoàn tiền',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Đã từ chối',
};
const COMPLAINT_STATUS_OPTIONS = Object.keys(COMPLAINT_STATUS_LABELS);
const REFUND_STATUS_LABELS = {
    PENDING: 'Chờ xử lý',
    PROCESSING: 'Đang xử lý',
    COMPLETED: 'Hoàn thành',
    FAILED: 'Thất bại',
    PARTIALLY_REFUNDED: 'Hoàn tiền một phần',
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—');
const translateStatus = (status, labels) => labels[String(status || '').toUpperCase()] || status || '—';

const AdminComplaintManagementPage = () => {
    const { isAuthenticated, user } = useAuth();
    const role = String(user?.role || '').toUpperCase();
    const canView = role === 'ADMIN';

    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [selected, setSelected] = useState(null);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [sortOrder, setSortOrder] = useState('DESC');
    const [detailMode, setDetailMode] = useState(false);
    const [modalAction, setModalAction] = useState('DETAIL');
    const [actionLoading, setActionLoading] = useState(false);
    const [refundAmount, setRefundAmount] = useState('');
    const [adminNote, setAdminNote] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [zoomedEvidence, setZoomedEvidence] = useState(null);
    const [orderTotal, setOrderTotal] = useState(null);
    const [commissionRate, setCommissionRate] = useState(null);
    const [orderLoading, setOrderLoading] = useState(false);

    const compareCreatedAt = (a, b) => dayjs(a?.createdAt || a?.created_at || 0).valueOf() - dayjs(b?.createdAt || b?.created_at || 0).valueOf();

    const getRefundableAmount = (total, rate) => {
        const numericTotal = Number(total);
        const numericRate = Number(rate);
        if (!Number.isFinite(numericTotal) || !Number.isFinite(numericRate)) return null;
        return Math.max(0, Math.round(numericTotal * (1 - numericRate / 100)));
    };

    const loadComplaints = async () => {
        setLoading(true);
        const firstRes = await complaintService.getAdminComplaints({ status: statusFilter || undefined, page: 0, size: PAGE_SIZE });
        if (!firstRes.success) {
            appToast.error('Không tải được danh sách khiếu nại', firstRes.error || 'Vui lòng thử lại sau');
            setItems([]);
            setTotalPages(1);
            setLoading(false);
            return;
        }

        const firstData = firstRes.data || {};
        const firstItems = Array.isArray(firstData.content) ? firstData.content : complaintService.toArray(firstData);
        const firstTotalPages = Number(firstData.totalPages || 1);
        const pageRequests = [];

        if (commissionRate == null) {
            const rateRes = await complaintService.getCommissionRate();
            if (rateRes.success) {
                setCommissionRate(Number(rateRes.data?.commissionRate ?? 0));
            }
        }

        for (let nextPage = 1; nextPage < firstTotalPages; nextPage += 1) {
            pageRequests.push(complaintService.getAdminComplaints({ status: statusFilter || undefined, page: nextPage, size: PAGE_SIZE }));
        }

        const restResults = pageRequests.length > 0 ? await Promise.all(pageRequests) : [];
        const restItems = restResults.flatMap((result) => {
            if (!result?.success) return [];
            const data = result.data || {};
            return Array.isArray(data.content) ? data.content : complaintService.toArray(data);
        });

        const allItems = [...firstItems, ...restItems].sort(compareCreatedAt);
        const orderedItems = sortOrder === 'ASC' ? allItems : [...allItems].reverse();
        const pageCount = Math.max(1, Math.ceil(orderedItems.length / PAGE_SIZE));
        const currentPage = Math.min(page, pageCount - 1);
        const startIndex = currentPage * PAGE_SIZE;

        setItems(orderedItems.slice(startIndex, startIndex + PAGE_SIZE));
        setTotalPages(pageCount);
        setLoading(false);
    };

    useEffect(() => {
        if (!isAuthenticated || !canView) return;
        loadComplaints();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, canView, page, statusFilter, sortOrder]);

    const filteredItems = useMemo(() => items, [items]);

    const openDetail = async (item, action = 'DETAIL') => {
        setSelected(item);
        setSelectedDetail(null);
        setModalAction(action);
        setDetailMode(true);
        setOrderTotal(null);
        setCommissionRate(null);
        const res = await complaintService.getAdminComplaintDetail(item.complaintId || item.id);
        if (!res.success) {
            appToast.error('Không tải được chi tiết', res.error || 'Vui lòng thử lại sau');
            return;
        }
        const detailData = res.data || item;
        setSelectedDetail(detailData);
        setRefundAmount(String(detailData?.refundAmount ?? item.refundAmount ?? ''));
        setAdminNote(detailData?.adminNote || '');
        setRejectionReason(detailData?.rejectionReason || '');

        const orderId = detailData?.orderId || item.orderId;
        if (orderId) {
            setOrderLoading(true);
            const [orderRes, rateRes] = await Promise.all([
                complaintService.getOrderById(orderId),
                complaintService.getCommissionRate(),
            ]);

            if (orderRes.success) {
                setOrderTotal(orderRes.data?.total ?? null);
            } else {
                setOrderTotal(null);
            }

            if (rateRes.success) {
                setCommissionRate(Number(rateRes.data?.commissionRate ?? 0));
            } else {
                setCommissionRate(null);
            }

            setOrderLoading(false);
        }
    };

    const openApproveModal = (item) => openDetail(item, 'APPROVE');
    const openRejectModal = (item) => openDetail(item, 'REJECT');

    const handleApprove = async () => {
        if (!selected?.complaintId) return;
        setActionLoading(true);
        const res = await complaintService.approveAdminComplaint(selected.complaintId, { refundAmount, adminNote });
        setActionLoading(false);
        if (!res.success) return appToast.error('Phê duyệt thất bại', res.error || 'Vui lòng thử lại sau');
        appToast.success('Đã phê duyệt khiếu nại');
        setDetailMode(false);
        await loadComplaints();
    };

    const handleReject = async () => {
        if (!selected?.complaintId) return;
        setActionLoading(true);
        const res = await complaintService.rejectAdminComplaint(selected.complaintId, { rejectionReason });
        setActionLoading(false);
        if (!res.success) return appToast.error('Từ chối thất bại', res.error || 'Vui lòng thử lại sau');
        appToast.success('Đã từ chối khiếu nại');
        setDetailMode(false);
        await loadComplaints();
    };

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!canView) return <Navigate to="/" replace />;

    return (
        <div className="admin-complaint-page">
            <div className="admin-complaint-header">
                <div>
                    <h1>Quản lý khiếu nại</h1>
                    <p>Duyệt, từ chối và xử lý hoàn tiền cho complaint</p>
                </div>
            </div>

            <section className="admin-complaint-section">
                <div className="admin-section-head">
                    <div>
                        <h2>Danh sách khiếu nại</h2>
                    </div>
                    <div className="admin-section-controls">
                        <select className="admin-filter-select inline" value={statusFilter} onChange={(e) => { setPage(0); setStatusFilter(e.target.value); }}>
                            <option value="">Tất cả trạng thái khiếu nại</option>
                            {COMPLAINT_STATUS_OPTIONS.map((option) => (
                                <option key={option} value={option}>{translateStatus(option, COMPLAINT_STATUS_LABELS)}</option>
                            ))}
                        </select>
                        <select className="admin-filter-select inline" value={sortOrder} onChange={(e) => { setPage(0); setSortOrder(e.target.value); }}>
                            <option value="DESC">Mới nhất</option>
                            <option value="ASC">Cũ nhất</option>
                        </select>
                    </div>
                </div>
                {loading ? <div className="admin-complaint-empty">Đang tải dữ liệu...</div> : filteredItems.length === 0 ? <div className="admin-complaint-empty">Chưa có khiếu nại nào</div> : (
                    <div className="admin-complaint-list">
                        {filteredItems.map((item) => (
                            <article key={item.complaintId} className="admin-complaint-card">
                                <div className="admin-complaint-card-header">
                                    <div>
                                        <strong>#{String(item.complaintId || '').slice(0, 8)}</strong>
                                        <span className="admin-complaint-status">{translateStatus(item.status, COMPLAINT_STATUS_LABELS)}</span>
                                    </div>
                                </div>
                                <p className="admin-complaint-reason">{item.reason || '—'}</p>
                                <small>{item.customerName || '—'} • {item.artisanName || '—'}</small>
                                <div className="admin-complaint-card-actions">
                                    <button type="button" className="admin-btn admin-btn-secondary" onClick={() => openDetail(item, 'DETAIL')}>
                                        Xem chi tiết
                                    </button>
                                    <button type="button" className="admin-btn admin-btn-success" onClick={() => openApproveModal(item)}>
                                        Phê duyệt
                                    </button>
                                    <button type="button" className="admin-btn admin-btn-danger" onClick={() => openRejectModal(item)}>
                                        Từ chối
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
                <div className="admin-complaint-pagination">
                    <button type="button" disabled={page <= 0} onClick={() => setPage((prev) => prev - 1)}>Trước</button>
                    <span>Trang {page + 1}/{totalPages}</span>
                    <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((prev) => prev + 1)}>Sau</button>
                </div>
            </section>

            {zoomedEvidence && (
                <div className="admin-evidence-modal-backdrop" onClick={() => setZoomedEvidence(null)} role="presentation">
                    <button type="button" className="admin-evidence-modal-close" onClick={() => setZoomedEvidence(null)} aria-label="Đóng hình">
                        ×
                    </button>
                    <div className="admin-evidence-modal-panel" onClick={(e) => e.stopPropagation()}>
                        <img src={zoomedEvidence} alt="Bằng chứng phóng to" className="admin-evidence-modal-image" />
                    </div>
                </div>
            )}

            {detailMode && selected && (
                <div className="admin-complaint-modal-backdrop" onClick={() => setDetailMode(false)} role="presentation">
                    <div className="admin-complaint-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="complaint-detail-title">
                        <div className="admin-complaint-modal-header">
                            <div>
                                <p className="admin-complaint-modal-kicker">Chi tiết khiếu nại</p>
                                <h2 id="complaint-detail-title">#{String(selectedDetail?.complaintId || selected.complaintId || '').slice(0, 8)}</h2>
                                <p className="admin-complaint-modal-subtitle">Xem toàn bộ thông tin để xử lý phê duyệt hoặc từ chối.</p>
                                {selectedDetail?.reviewedByName && (
                                    <p className="admin-complaint-modal-subtitle">Đã duyệt bởi: {selectedDetail.reviewedByName}{selectedDetail.reviewedAt ? ` · ${formatDateTime(selectedDetail.reviewedAt)}` : ''}</p>
                                )}
                            </div>
                            <button type="button" className="admin-complaint-modal-close" onClick={() => setDetailMode(false)} aria-label="Đóng">×</button>
                        </div>

                        <div className="admin-complaint-modal-body">
                            <aside className="admin-complaint-summary-card">
                                <div className="admin-complaint-summary-row">
                                    <span>Trạng thái</span>
                                    <strong>{translateStatus(selectedDetail?.status || selected.status, COMPLAINT_STATUS_LABELS)}</strong>
                                </div>

                                <div className="admin-complaint-summary-row">
                                    <span>Bằng chứng</span>
                                    <strong>{(selectedDetail?.evidenceImages || []).length} ảnh</strong>
                                </div>
                                <div className="admin-complaint-summary-row">
                                    <span>Ngày tạo</span>
                                    <strong>{formatDateTime(selectedDetail?.createdAt)}</strong>
                                </div>
                                <div className="admin-complaint-summary-row">
                                    <span>Cập nhật</span>
                                    <strong>{formatDateTime(selectedDetail?.updatedAt)}</strong>
                                </div>
                                <div className="admin-complaint-summary-row">
                                    <span>Tổng đơn hàng</span>
                                    <strong>{orderLoading ? 'Đang tải...' : (orderTotal != null ? `${Number(orderTotal).toLocaleString('vi-VN')} đ` : '—')}</strong>
                                </div>
                                <div className="admin-complaint-summary-row">
                                    <span>Số tiền có thể hoàn</span>
                                    <strong>{orderLoading ? 'Đang tải...' : (getRefundableAmount(orderTotal, commissionRate) != null ? `${getRefundableAmount(orderTotal, commissionRate).toLocaleString('vi-VN')} đ` : '—')}</strong>
                                </div>
                                <div className="admin-complaint-summary-row">
                                    <span>Commission rate</span>
                                    <strong>{commissionRate != null ? `${commissionRate}%` : '—'}</strong>
                                </div>
                                <div className="admin-complaint-summary-row">
                                    <span>ID khiếu nại</span>
                                    <strong>{selectedDetail?.complaintId || selected.complaintId || '—'}</strong>
                                </div>
                                <div className="admin-complaint-summary-row">
                                    <span>Refund Txn</span>
                                    <strong>{selectedDetail?.refundTransactionId || '—'}</strong>
                                </div>
                                <div className="admin-complaint-summary-row">
                                    <span>Refund status</span>
                                    <strong>{translateStatus(selectedDetail?.refundStatus, REFUND_STATUS_LABELS)}</strong>
                                </div>
                                <div className="admin-complaint-summary-row">
                                    <span>Admin note</span>
                                    <strong>{selectedDetail?.adminNote || '—'}</strong>
                                </div>
                                <div className="admin-complaint-summary-row">
                                    <span>Từ chối</span>
                                    <strong>{selectedDetail?.rejectionReason || '—'}</strong>
                                </div>
                                <div className="admin-complaint-summary-row">
                                    <span>Người duyệt</span>
                                    <strong>{selectedDetail?.reviewedByName || '—'}</strong>
                                </div>
                                <div className="admin-complaint-summary-row">
                                    <span>Thời gian duyệt</span>
                                    <strong>{formatDateTime(selectedDetail?.reviewedAt)}</strong>
                                </div>
                            </aside>

                            <div className="admin-complaint-details-grid">
                                <section className="admin-complaint-detail-block">
                                    <h3>Thông tin người gửi</h3>
                                    <div className="admin-complaint-detail-list">
                                        <div><span>Khách hàng</span><strong>{selectedDetail?.customerName || '—'}</strong></div>
                                        <div><span>Email</span><strong>{selectedDetail?.customerEmail || '—'}</strong></div>
                                        <div><span>Customer ID</span><strong>{selectedDetail?.customerId || '—'}</strong></div>
                                        <div><span>Artisan</span><strong>{selectedDetail?.artisanName || '—'}</strong></div>
                                        <div><span>Artisan ID</span><strong>{selectedDetail?.artisanId || '—'}</strong></div>
                                    </div>
                                </section>

                                <section className="admin-complaint-detail-block">
                                    <h3>Thông tin đơn liên quan</h3>
                                    <div className="admin-complaint-detail-list">
                                        <div><span>Order ID</span><strong>{selectedDetail?.orderId || '—'}</strong></div>
                                        <div><span>Custom Order ID</span><strong>{selectedDetail?.customOrderId || '—'}</strong></div>
                                        <div><span>Số tiền hoàn</span><strong>{selectedDetail?.refundAmount != null ? `${Number(selectedDetail.refundAmount).toLocaleString('vi-VN')} đ` : '—'}</strong></div>
                                        <div><span>Refund status</span><strong>{translateStatus(selectedDetail?.refundStatus, REFUND_STATUS_LABELS)}</strong></div>
                                    </div>
                                </section>

                                <section className="admin-complaint-detail-block">
                                    <h3>Nội dung khiếu nại</h3>
                                    <p className="admin-complaint-detail-text">{selectedDetail?.reason || selected.reason || '—'}</p>
                                </section>

                                <section className="admin-complaint-detail-block">
                                    <h3>Phản hồi artisan</h3>
                                    <p className="admin-complaint-detail-text">{selectedDetail?.artisanResponse || 'Chưa có phản hồi.'}</p>
                                    <p className="admin-complaint-detail-subtext">{selectedDetail?.artisanResponseAt ? `Phản hồi lúc ${formatDateTime(selectedDetail.artisanResponseAt)}` : ''}</p>
                                </section>

                                <section className="admin-complaint-detail-block">
                                    <h3>Bằng chứng đính kèm</h3>
                                    {(selectedDetail?.evidenceImages || []).length > 0 ? (
                                        <div className="admin-complaint-evidence-grid">
                                            {(selectedDetail?.evidenceImages || []).map((image, index) => (
                                                <button
                                                    key={`${image}-${index}`}
                                                    type="button"
                                                    className="admin-complaint-evidence-item"
                                                    onClick={() => setZoomedEvidence(image)}
                                                    aria-label={`Phóng to bằng chứng ${index + 1}`}
                                                >
                                                    <img src={image} alt={`Bằng chứng ${index + 1}`} />
                                                    <span>Xem</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="admin-complaint-empty inline">Chưa có ảnh bằng chứng</div>
                                    )}
                                </section>

                                {modalAction !== 'DETAIL' && (
                                    <section className="admin-complaint-detail-block">
                                        <h3>Thông tin xử lý</h3>
                                        <div className="admin-complaint-form-grid admin-complaint-modal-form">
                                            {modalAction === 'APPROVE' ? (
                                                <>
                                                    <input
                                                        value={refundAmount}
                                                        onChange={(e) => setRefundAmount(e.target.value)}
                                                        placeholder="Số tiền hoàn"
                                                    />
                                                    <div className="admin-complaint-helper-text">
                                                        Số tiền đề xuất: {getRefundableAmount(orderTotal, commissionRate) != null ? `${getRefundableAmount(orderTotal, commissionRate).toLocaleString('vi-VN')} đ` : '—'}
                                                    </div>
                                                    <input value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Ghi chú admin" />
                                                </>
                                            ) : (
                                                <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Lý do từ chối" />
                                            )}
                                        </div>
                                    </section>
                                )}
                            </div>
                        </div>

                        <div className="admin-complaint-modal-actions">
                            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setDetailMode(false)}>Đóng</button>
                            {modalAction === 'APPROVE' && (
                                <button type="button" className="admin-btn admin-btn-success" onClick={handleApprove} disabled={actionLoading}>
                                    Phê duyệt
                                </button>
                            )}
                            {modalAction === 'REJECT' && (
                                <button type="button" className="admin-btn admin-btn-danger" onClick={handleReject} disabled={actionLoading}>
                                    Từ chối
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminComplaintManagementPage;
