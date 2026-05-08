import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appToast } from '../../lib/appToast';
import Header from '../../components/Header/Header';
import complaintService from '../../services/complaintService';
import './ComplaintHistoryPage.css';

const PAGE_SIZE = 10;

const STATUS_META = {
    PENDING: { label: 'Chờ xử lý', className: 'complaint-status-pending' },
    ARTISAN_RESPONDED: { label: 'Artisan đã phản hồi', className: 'complaint-status-responded' },
    APPROVED: { label: 'Đã phê duyệt', className: 'complaint-status-approved' },
    REJECTED: { label: 'Đã từ chối', className: 'complaint-status-rejected' },
    RETURN_PENDING: { label: 'Chờ trả hàng', className: 'complaint-status-return' },
    REFUND_PROCESSING: { label: 'Đang hoàn tiền', className: 'complaint-status-refund' },
    REFUNDED: { label: 'Đã hoàn tiền', className: 'complaint-status-success' },
    CLOSED: { label: 'Đã đóng', className: 'complaint-status-closed' },
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—');

const ComplaintHistoryPage = () => {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const role = String(user?.role || '').toUpperCase();
    const canView = role === 'CUSTOMER';

    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(0);
    const [pageInfo, setPageInfo] = useState({ totalPages: 1, totalElements: 0, number: 0 });
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState('');

    const loadData = async (nextPage = page) => {
        setLoading(true);
        const res = await complaintService.getMyComplaints({ page: nextPage, size: PAGE_SIZE });
        if (!res.success) {
            appToast.error('Không tải được lịch sử khiếu nại', res.error || 'Vui lòng thử lại sau');
            setItems([]);
            setPageInfo({ totalPages: 1, totalElements: 0, number: nextPage });
            setLoading(false);
            return;
        }

        const data = res.data || {};
        setItems(Array.isArray(data.content) ? data.content : complaintService.toArray(data));
        setPageInfo({
            totalPages: Number(data.totalPages || 1),
            totalElements: Number(data.totalElements || 0),
            number: Number(data.number || nextPage),
        });
        setLoading(false);
    };

    useEffect(() => {
        if (!isAuthenticated || !canView) return;
        loadData(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, canView, page]);

    const paginationText = useMemo(() => {
        if (!pageInfo.totalElements) return 'Hiển thị 0 khiếu nại';
        const from = pageInfo.number * PAGE_SIZE + 1;
        const to = Math.min((pageInfo.number + 1) * PAGE_SIZE, pageInfo.totalElements);
        return `Hiển thị ${from}–${to} trong tổng ${pageInfo.totalElements} khiếu nại`;
    }, [pageInfo]);

    const openDetail = async (complaint) => {
        const id = complaint?.complaintId;
        if (!id) return;

        setSelectedComplaint(complaint);
        setPreviewImage('');
        setDetailLoading(true);
        const res = await complaintService.getComplaintDetail(id);
        setDetailLoading(false);

        if (!res.success) {
            appToast.error('Không tải được chi tiết', res.error || 'Vui lòng thử lại sau');
            return;
        }

        setSelectedComplaint({ ...complaint, ...(res.data || {}) });
    };

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!canView) return <Navigate to="/" replace />;

    return (
        <div className="complaint-history-page">
            <Header />
            <main className="complaint-history-shell">
                <header className="complaint-history-header">
                    <div className="complaint-history-hero">
                        <button type="button" className="complaint-back-link" onClick={() => navigate('/orders')}>
                            ← Quay lại lịch sử đơn hàng
                        </button>
                        <div>
                            <h1>Lịch sử khiếu nại</h1>
                            <p>Theo dõi trạng thái xử lý, phản hồi và hoàn tiền.</p>
                        </div>
                    </div>
                </header>

            <section className="complaint-history-summary">
                <div className="summary-card">
                    <span>Tổng khiếu nại</span>
                    <strong>{pageInfo.totalElements}</strong>
                </div>
                <div className="summary-card">
                    <span>Trang hiện tại</span>
                    <strong>{pageInfo.number + 1}</strong>
                </div>

            </section>

            <section className="complaint-history-list-card">
                <div className="complaint-history-list-head">
                    <h2>Danh sách khiếu nại</h2>
                    <span>{paginationText}</span>
                </div>

                {loading ? (
                    <div className="complaint-history-empty">Đang tải dữ liệu...</div>
                ) : items.length === 0 ? (
                    <div className="complaint-history-empty">
                        <h3>Chưa có khiếu nại nào</h3>
                        <p>Bạn có thể tạo khiếu nại từ trang chi tiết đơn hàng.</p>
                        <button type="button" className="btn btn-outline" onClick={() => navigate('/orders')}>
                            Đi tới đơn hàng
                        </button>
                    </div>
                ) : (
                    <div className="complaint-history-list">
                        {items.map((item) => {
                            const status = String(item.status || 'PENDING').toUpperCase();
                            const meta = STATUS_META[status] || { label: status, className: 'complaint-status-default' };

                            return (
                                <button key={item.complaintId} type="button" className="complaint-history-item" onClick={() => openDetail(item)}>
                                    <div className="complaint-history-item-head">
                                        <div>
                                            <strong>#{String(item.complaintId || '').slice(0, 8)}</strong>
                                            <p>Đơn hàng: {item.orderId ? String(item.orderId).slice(0, 8) : '—'}</p>
                                        </div>
                                        <span className={`complaint-status-badge ${meta.className}`}>{meta.label}</span>
                                    </div>

                                    <p className="complaint-history-reason">{item.reason || '—'}</p>

                                    <div className="complaint-history-meta">
                                        <span>Artisan: {item.artisanName || '—'}</span>
                                        <span>Hoàn tiền: {formatDateTime(item.updatedAt)}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="complaint-history-pagination">
                    <button type="button" className="btn btn-outline btn-sm" disabled={page <= 0 || loading} onClick={() => setPage((prev) => prev - 1)}>
                        Trước
                    </button>
                    <span>Trang {pageInfo.number + 1}/{Math.max(pageInfo.totalPages, 1)}</span>
                    <button type="button" className="btn btn-outline btn-sm" disabled={loading || page + 1 >= pageInfo.totalPages} onClick={() => setPage((prev) => prev + 1)}>
                        Sau
                    </button>
                </div>
            </section>

            </main>

            {selectedComplaint && (
                <div className="complaint-detail-overlay" onClick={() => setSelectedComplaint(null)} role="presentation">
                    <div className="complaint-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="complaint-detail-title">
                        <div className="complaint-detail-header">
                            <div>
                                <h2 id="complaint-detail-title">Chi tiết khiếu nại</h2>
                                <p>Theo dõi trạng thái xử lý từng bước.</p>
                            </div>
                            <button type="button" className="complaint-detail-close" onClick={() => setSelectedComplaint(null)} aria-label="Đóng">×</button>
                        </div>

                        <div className="complaint-detail-scroll">
                            {detailLoading ? (
                                <div className="complaint-history-empty">Đang tải chi tiết...</div>
                            ) : (
                                <>
                                    <div className="complaint-detail-grid">
                                        <div className="complaint-detail-block">
                                            <span>Mã khiếu nại</span>
                                            <strong>{selectedComplaint.complaintId || '—'}</strong>
                                        </div>
                                        <div className="complaint-detail-block">
                                            <span>Trạng thái</span>
                                            <strong>{STATUS_META[String(selectedComplaint.status || '').toUpperCase()]?.label || selectedComplaint.status || '—'}</strong>
                                        </div>
                                        <div className="complaint-detail-block">
                                            <span>Khách hàng</span>
                                            <strong>{selectedComplaint.customerName || '—'}</strong>
                                            <p>{selectedComplaint.customerEmail || '—'}</p>
                                        </div>
                                        <div className="complaint-detail-block">
                                            <span>Artisan</span>
                                            <strong>{selectedComplaint.artisanName || '—'}</strong>
                                        </div>
                             
                                        <div className="complaint-detail-block">
                                            <span>Số tiền hoàn</span>
                                            <strong>{new Intl.NumberFormat('vi-VN').format(Number(selectedComplaint.refundAmount || 0))} đ</strong>
                                        </div>
                                        <div className="complaint-detail-block wide">
                                            <span>Lý do</span>
                                            <p>{selectedComplaint.reason || '—'}</p>
                                        </div>
                                        <div className="complaint-detail-block wide">
                                            <span>Phản hồi artisan</span>
                                            <p>{selectedComplaint.artisanResponse || '—'}</p>
                                        </div>
                                        <div className="complaint-detail-block wide">
                                            <span>Ảnh bằng chứng</span>
                                            {Array.isArray(selectedComplaint.evidenceImages) && selectedComplaint.evidenceImages.length > 0 ? (
                                                <div className="complaint-evidence-grid">
                                                    {selectedComplaint.evidenceImages.map((imageUrl, idx) => (
                                                        <button
                                                            key={`${imageUrl}-${idx}`}
                                                            type="button"
                                                            className="complaint-evidence-item"
                                                            onClick={() => setPreviewImage(imageUrl)}
                                                        >
                                                            <img src={imageUrl} alt={`Bằng chứng ${idx + 1}`} />
                                                            <span>Xem</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p>Chưa có ảnh bằng chứng.</p>
                                            )}
                                        </div>
                                        <div className="complaint-detail-block">
                                            <span>Người duyệt</span>
                                            <strong>{selectedComplaint.reviewedByName || '—'}</strong>
                                        </div>
                                        <div className="complaint-detail-block wide">
                                            <span>Lý do từ chối</span>
                                            <p>{selectedComplaint.rejectionReason || '—'}</p>
                                        </div>
                                        <div className="complaint-detail-block wide">
                                            <span>Ghi chú admin</span>
                                            <p>{selectedComplaint.adminNote || '—'}</p>
                                        </div>
                                        <div className="complaint-detail-block">
                                            <span>Đã cập nhật</span>
                                            <strong>{formatDateTime(selectedComplaint.updatedAt)}</strong>
                                        </div>
                                        <div className="complaint-detail-block">
                                            <span>Ngày tạo</span>
                                            <strong>{formatDateTime(selectedComplaint.createdAt)}</strong>
                                        </div>
                                        <div className="complaint-detail-block wide">
                                            <span>Refund transaction</span>
                                            <p>{selectedComplaint.refundTransactionId || '—'} {selectedComplaint.refundStatus ? `• ${selectedComplaint.refundStatus}` : ''}</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="complaint-detail-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setSelectedComplaint(null)}>Đóng</button>
                            <button type="button" className="btn btn-outline" onClick={() => navigate('/orders')}>
                                Quay lại lịch sử đơn hàng
                            </button>
                            <button type="button" className="btn btn-primary" onClick={() => navigate(`/orders/${selectedComplaint.orderId}`)}>
                                Xem đơn hàng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {previewImage && (
                <div className="complaint-image-viewer" onClick={() => setPreviewImage('')} role="presentation">
                    <div className="complaint-image-viewer__panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <button type="button" className="complaint-image-viewer__close" onClick={() => setPreviewImage('')} aria-label="Đóng">×</button>
                        <img src={previewImage} alt="Ảnh bằng chứng phóng to" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComplaintHistoryPage;
