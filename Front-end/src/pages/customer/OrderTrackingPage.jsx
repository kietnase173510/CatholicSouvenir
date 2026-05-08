import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCalendar, FiCreditCard, FiHash, FiPackage, FiTruck, FiUser } from 'react-icons/fi';
import { appToast } from '../../lib/appToast';
import { getOrderById, updateOrderStatus, createFeedback, getFeedbackById } from '../../services/orderService';
import paymentService from '../../services/paymentService';
import shipmentService from '../../services/shipmentService';
import ImageUpload from '../../components/ui/ImageUpload';
import { createComplaint } from '../../services/complaintService';
import './OrderTrackingPage.css';

const formatCurrency = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} đ`;
const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—');

const STATUS_META = {
    PENDING: { label: 'Chờ thanh toán', className: 'status-pending' },
    PAID: { label: 'Đã thanh toán', className: 'status-paid' },
    SHIPPING: { label: 'Đang giao hàng', className: 'status-shipping' },
    DELIVERED: { label: 'Hoàn thành', className: 'status-delivered' },
    CANCELLED: { label: 'Đã huỷ', className: 'status-cancelled' },
};

const getStatusMeta = (status) => {
    const key = String(status || '').toUpperCase();
    return STATUS_META[key] || { label: key || 'Không xác định', className: 'status-unknown' };
};

const getItemImage = (item) => item?.image || item?.images?.[0]?.image_url || item?.thumbnail || 'https://via.placeholder.com/96x96?text=SP';
const getItemName = (item) => item?.productName || item?.templateName || 'Sản phẩm tuỳ chỉnh';

const FEEDBACK_SUGGESTIONS = {
    1: ['Hàng kém chất lượng', 'Không như mô tả', 'Giao hàng chậm', 'Đóng gói ẩu'],
    2: ['Chất lượng chưa ổn', 'Màu sắc sai', 'Kích thước lệch', 'Dịch vụ kém'],
    3: ['Tạm được', 'Chất lượng bình thường', 'Giá hơi cao', 'Giao hàng đúng hẹn'],
    4: ['Hàng chất lượng', 'Đóng gói cẩn thận', 'Giao hàng nhanh', 'Đúng mô tả'],
    5: ['Tuyệt vời!', 'Chất lượng xuất sắc', 'Sẽ mua lại', 'Đóng gói rất đẹp'],
};

const FEEDBACK_LABELS = {
    1: 'Không hài lòng',
    2: 'Chưa hài lòng',
    3: 'Bình thường',
    4: 'Hài lòng',
    5: 'Rất hài lòng',
};

const OrderTrackingPage = () => {
    const navigate = useNavigate();
    const { orderId } = useParams();

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState(null);
    const [shipment, setShipment] = useState(null);
    const [payments, setPayments] = useState([]);
    const [cancelling, setCancelling] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [feedbackStatus, setFeedbackStatus] = useState('Chưa đánh giá');
    const [feedbackDetail, setFeedbackDetail] = useState(null);
    const [feedbackDetailLoading, setFeedbackDetailLoading] = useState(false);
    const [feedbackForm, setFeedbackForm] = useState({ rating: 0, textComment: '' });
    const [feedbackHoverRating, setFeedbackHoverRating] = useState(0);
    const [selectedRating, setSelectedRating] = useState(0);
    const [selectedTags, setSelectedTags] = useState([]);
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
    const [complaintOpen, setComplaintOpen] = useState(false);
    const [complaintForm, setComplaintForm] = useState({ reason: '', evidenceImages: [] });
    const [complaintSubmitting, setComplaintSubmitting] = useState(false);

    useEffect(() => {
        if (!orderId) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            const [orderRes, paymentRes, shipmentRes] = await Promise.all([
                getOrderById(orderId),
                paymentService.getPaymentsByOrder(orderId),
                shipmentService.getShipmentByOrderId(orderId),
            ]);

            if (cancelled) return;

            if (!orderRes.success) {
                appToast.error('Không tải được đơn hàng', orderRes.error || 'Vui lòng thử lại');
                setLoading(false);
                return;
            }

            setOrder(orderRes.data || null);
            setFeedbackStatus(orderRes.data?.feedback ? 'Đã đánh giá' : 'Chưa đánh giá');
            setFeedbackDetail(orderRes.data?.feedback || null);
            setPayments(paymentRes.success ? (paymentRes.data || []) : []);
            setShipment(shipmentRes.success ? (shipmentRes.data || null) : null);
            setLoading(false);
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [orderId]);

    const allItems = useMemo(() => {
        const orderDetails = Array.isArray(order?.orderDetails) ? order.orderDetails : [];
        const templateDetails = Array.isArray(order?.templateDetails) ? order.templateDetails : [];
        return [...orderDetails, ...templateDetails];
    }, [order]);

    const latestPayment = useMemo(() => {
        if (!payments.length) return null;
        return [...payments].sort((a, b) => new Date(b.paidAt || b.createdAt || 0) - new Date(a.paidAt || a.createdAt || 0))[0];
    }, [payments]);

    const statusMeta = useMemo(() => getStatusMeta(order?.status), [order?.status]);
    const canSubmitFeedback = Boolean(order?.orderId || order?.id || order?.customOrderId);

    const handleCancelOrder = async () => {
        if (!order || cancelling) return;
        const accepted = window.confirm('Bạn có chắc chắn muốn huỷ đơn hàng này?');
        if (!accepted) return;

        setCancelling(true);
        const res = await updateOrderStatus(order.orderId, 'CANCELLED');
        setCancelling(false);

        if (!res.success) {
            appToast.error('Huỷ đơn thất bại', res.error || 'Vui lòng thử lại');
            return;
        }

        appToast.success('Huỷ đơn thành công');
        const refreshed = await getOrderById(orderId);
        if (refreshed.success) setOrder(refreshed.data || null);
    };

    const openFeedbackModal = () => {
        if (!canSubmitFeedback) {
            appToast.warning('Thiếu thông tin đánh giá', 'Không xác định được đơn hàng để gửi đánh giá');
            return;
        }
        setFeedbackForm({ rating: 0, textComment: '' });
        setFeedbackHoverRating(0);
        setSelectedRating(0);
        setSelectedTags([]);
        setFeedbackOpen(true);
    };

    const closeFeedbackModal = () => {
        if (feedbackSubmitting) return;
        setFeedbackOpen(false);
    };

    const visibleRating = feedbackHoverRating || selectedRating || feedbackForm.rating || 0;
    const selectedSuggestions = FEEDBACK_SUGGESTIONS[selectedRating] || [];
    const feedbackSummary = FEEDBACK_LABELS[visibleRating] || 'Chưa đánh giá';
    const feedbackSummaryClass = visibleRating <= 2 ? 'is-negative' : visibleRating === 3 ? 'is-neutral' : 'is-positive';

    const handleStarEnter = (rating) => setFeedbackHoverRating(rating);
    const handleStarLeave = () => setFeedbackHoverRating(0);
    const handleStarClick = (rating) => {
        if (selectedRating !== rating) setSelectedTags([]);
        setSelectedRating(rating);
        setFeedbackForm((prev) => ({ ...prev, rating }));
        setFeedbackHoverRating(0);
    };

    const toggleTag = (tag) => {
        setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
        setFeedbackForm((prev) => ({ ...prev, textComment: '' }));
    };

    const handleFeedbackSubmit = async () => {
        if (!canSubmitFeedback) {
            appToast.error('Không thể gửi đánh giá', 'Thiếu thông tin đơn hàng');
            return;
        }

        const textComment = [
            ...(selectedTags || []),
            String(feedbackForm.textComment || '').trim(),
        ]
            .filter(Boolean)
            .join(' | ');

        setFeedbackSubmitting(true);
        const res = await createFeedback({
            orderId: order?.orderId || order?.id || null,
            customOrderId: order?.customOrderId || null,
            rating: selectedRating,
            comment: textComment,
        });
        setFeedbackSubmitting(false);

        if (!res.success) {
            appToast.error('Gửi đánh giá thất bại', res.error || 'Vui lòng thử lại sau');
            return;
        }

        setFeedbackStatus('Đã đánh giá');
        setFeedbackDetail(res.data || null);
        setFeedbackOpen(false);
        appToast.success('Đánh giá thành công');
    };

    const openComplaintModal = () => {
        setComplaintForm({
            reason: '',
            evidenceImages: [],
        });
        setComplaintOpen(true);
    };

    const closeComplaintModal = () => {
        if (complaintSubmitting) return;
        setComplaintOpen(false);
    };

    const handleComplaintSubmit = async () => {
        if (complaintSubmitting) return;
        if (!complaintForm.reason.trim()) {
            appToast.error('Thiếu thông tin khiếu nại', 'Vui lòng nhập nội dung khiếu nại.');
            return;
        }

        const evidenceImages = Array.isArray(complaintForm.evidenceImages)
            ? complaintForm.evidenceImages.filter(Boolean).slice(0, 10)
            : [];

        const complaintPayload = {
            orderId: order?.orderId || orderId,
            customOrderId: order?.customOrderId || order?.id || order?.orderId || orderId,
            productId: order?.productId || order?.templateId || order?.orderDetails?.[0]?.productId || order?.templateDetails?.[0]?.templateId || null,
            reason: complaintForm.reason.trim(),
            evidenceImages,
        };

        setComplaintSubmitting(true);
        try {
            const res = await createComplaint(complaintPayload);
            if (!res.success) {
                appToast.error('Không gửi được khiếu nại', res.error || 'Vui lòng thử lại.');
                return;
            }

            appToast.success('Đã ghi nhận yêu cầu khiếu nại', 'Bộ phận CSKH sẽ liên hệ lại sớm nhất có thể.');
            setComplaintOpen(false);
            setComplaintForm({ reason: '', evidenceImages: [] });
        } catch {
            appToast.error('Không gửi được khiếu nại', 'Vui lòng thử lại.');
        } finally {
            setComplaintSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="order-tracking-page">
                <div className="tracking-skeleton hero" />
                <div className="tracking-skeleton content" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="order-tracking-page empty-state">
                <h2>Không tìm thấy đơn hàng</h2>
                <button type="button" className="btn btn-primary" onClick={() => navigate('/orders')}>
                    Quay lại danh sách
                </button>
            </div>
        );
    }

    return (
        <div className="order-tracking-page">
            <div className="tracking-shell">
                <button type="button" className="back-link" onClick={() => navigate('/orders')}>
                    <FiArrowLeft /> Quay lại đơn hàng
                </button>

                <section className="hero-card">
                    <div>
                        <div className={`status-pill ${statusMeta.className}`}>{statusMeta.label}</div>
                        <h1>#{order.orderId}</h1>
                        <p>Đơn hàng của <strong>{order.fullName || '—'}</strong> được tạo lúc {formatDateTime(order.orderDate || order.createAt)}</p>
                    </div>

                    <div className="hero-summary">
                        <div className="summary-chip"><FiPackage /><span>{allItems.length} sản phẩm</span></div>
                        <div className="summary-chip"><FiCreditCard /><span>{order.paymentMethod || '—'}</span></div>
                        <div className="summary-chip"><FiCalendar /><span>{formatDateTime(order.updateAt)}</span></div>
                    </div>
                </section>

                <div className="tracking-grid">
                    <main>
                        <section className="panel">
                            <div className="panel-head">
                                <h2>Sản phẩm đặt mua</h2>
                                <div className="panel-head-actions">
                                </div>
                            </div>

                            <div className="items-list">
                                {allItems.length > 0 ? allItems.map((item, idx) => (
                                    <article key={`${item.id || idx}`} className="item-row">
                                        <img src={getItemImage(item)} alt={getItemName(item)} />
                                        <div className="item-info">
                                            <h3>{getItemName(item)}</h3>
                                            <p>x{item.quantity || 1} · Đơn giá: {formatCurrency(item.unitPrice)}</p>
                                            {item.customizations && typeof item.customizations === 'object' && (
                                                <div className="custom-tags">
                                                    {Object.entries(item.customizations).map(([key, value]) => (
                                                        <span key={key}>{key}: {String(value)}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <strong>{formatCurrency(item.subTotal ?? item.subtotal ?? 0)}</strong>
                                    </article>
                                )) : (
                                    <div className="empty-items">Đơn hàng chưa có sản phẩm chi tiết.</div>
                                )}
                            </div>
                        </section>

                        <section className="panel">
                            <div className="panel-head">
                                <h2>Thông tin giao hàng</h2>
                            </div>
                            <div className="info-grid">
                                <div><FiUser /><span>Người nhận</span><strong>{order.fullName || '—'}</strong></div>
                                <div><FiTruck /><span>Trạng thái</span><strong>{statusMeta.label}</strong></div>
                                <div className="full"><FiHash /><span>Mã đơn</span><strong>{order.orderId}</strong></div>
                                <div className="full"><FiTruck /><span>Địa chỉ</span><strong>{shipment?.deliveryAddress || order.deliveryAddress || '—'}</strong></div>
                            </div>
                        </section>

                        <section className="panel">
                            <div className="panel-head">
                                <h2>Đánh giá của bạn</h2>
                                <span className={`feedback-status ${feedbackStatus === 'Đã đánh giá' ? 'is-done' : 'is-pending'}`}>
                                    {feedbackStatus}
                                </span>
                            </div>

                            {feedbackStatus === 'Đã đánh giá' ? (
                                <div className="feedback-detail-card">
                                    <div className="feedback-detail-header">
                                        <div className="feedback-detail-avatar">
                                            {order.fullName ? order.fullName.charAt(0).toUpperCase() : 'C'}
                                        </div>
                                        <div>
                                            <h3>{feedbackDetail?.customerName || order.fullName || 'Bạn'}</h3>
                                            <p>{formatDateTime(feedbackDetail?.createdAt || order.updateAt)}</p>
                                        </div>
                                    </div>

                                    <div className="feedback-detail-stars" aria-label={`Đánh giá ${feedbackDetail?.rating || 0} sao`}>
                                        {Array.from({ length: 5 }, (_, index) => index + 1).map((star) => (
                                            <span key={star} className={star <= Number(feedbackDetail?.rating || 0) ? 'active' : ''}>★</span>
                                        ))}
                                    </div>

                                    <p className="feedback-detail-comment">
                                        {feedbackDetail?.comment || 'Khách hàng chưa để lại nhận xét.'}
                                    </p>

                                    <div className="feedback-detail-meta">
                                        <span>Mã đánh giá: {feedbackDetail?.feedbackId || '—'}</span>
                                        <span>Thợ thủ công: {feedbackDetail?.artisanName || '—'}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-items">Chưa có đánh giá cho đơn hàng này.</div>
                            )}
                        </section>
                    </main>

                    <aside>
                        <section className="panel">
                            <div className="panel-head">
                                <h2>Tóm tắt đơn hàng</h2>
                            </div>
                            <div className="summary-box">
                                <p><span>Tổng tiền</span><strong>{formatCurrency(order.total)}</strong></p>
                                <p><span>Phí vận chuyển</span><strong>{formatCurrency(order.shippingFee ?? shipment?.shippingFee ?? 0)}</strong></p>
                                <p><span>Khách hàng</span><strong>{order.fullName || '—'}</strong></p>
                                <p><span>Thanh toán</span><strong>{order.paymentMethod || '—'}</strong></p>
                            </div>
                        </section>

                        <section className="panel">
                            <div className="panel-head">
                                <h2>Vận chuyển</h2>
                            </div>
                            {shipment?.trackingNumber ? (
                                <div className="summary-box">
                                    <p><span>Mã vận đơn</span><strong>{shipment.trackingNumber}</strong></p>
                                    <p><span>Trạng thái</span><strong>{shipment.status || '—'}</strong></p>
                                </div>
                            ) : (
                                <div className="empty-items">Đơn hàng chưa có thông tin vận chuyển.</div>
                            )}
                        </section>

                        <div className="action-stack">
                            <button type="button" className="btn btn-primary btn-full" onClick={openFeedbackModal} disabled={!canSubmitFeedback}>
                                Đánh giá đơn hàng
                            </button>
                            <button type="button" className="btn btn-outline btn-full" onClick={openComplaintModal}>
                                Khiếu nại đơn hàng
                            </button>
                            {String(order.status || '').toUpperCase() === 'PENDING' && (
                                <button type="button" className="btn btn-outline btn-full" onClick={handleCancelOrder} disabled={cancelling}>
                                    {cancelling ? 'Đang huỷ...' : 'Huỷ đơn'}
                                </button>
                            )}
                        </div>
                    </aside>
                </div>
            </div>

            {feedbackOpen && (
                <div className="modal-overlay" onClick={closeFeedbackModal}>
                    <div className="feedback-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="feedback-title">
                        <div className="feedback-modal-hero">
                            <div>
                                <p className="modal-kicker">Customer feedback</p>
                                <h3 id="feedback-title">Đánh giá đơn hàng</h3>
                                <p className="feedback-modal-subtitle">Chia sẻ trải nghiệm của bạn để chúng tôi cải thiện chất lượng tốt hơn.</p>
                            </div>
                            <button type="button" className="modal-close" onClick={closeFeedbackModal} disabled={feedbackSubmitting}>×</button>
                        </div>

                        <div className="feedback-modal-body">
                            <div className="feedback-rating-card">
                                <div className="feedback-rating-header">
                                    <span className="feedback-field-label">Số sao</span>
                                    <strong>{selectedRating || visibleRating}/5</strong>
                                </div>
                                <div className="feedback-stars-preview" aria-hidden="true">
                                    {Array.from({ length: 5 }, (_, index) => index + 1).map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            className={`feedback-star ${visibleRating >= star ? 'active' : ''}`}
                                            onMouseEnter={() => handleStarEnter(star)}
                                            onMouseLeave={handleStarLeave}
                                            onFocus={() => handleStarEnter(star)}
                                            onBlur={handleStarLeave}
                                            onClick={() => handleStarClick(star)}
                                            aria-label={`${star} sao`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                                <p className={`feedback-hint-text ${feedbackSummaryClass}`}>{feedbackSummary}</p>
                            </div>

                            {selectedRating > 0 && (
                                <div className="feedback-suggestions-section">
                                    <span className="feedback-field-label">Gợi ý nhanh</span>
                                    <div className="feedback-chip-group" role="list">
                                        {selectedSuggestions.map((suggestion) => {
                                            const active = selectedTags.includes(suggestion);
                                            return (
                                                <button
                                                    key={suggestion}
                                                    type="button"
                                                    className={`feedback-chip ${active ? 'active' : ''}`}
                                                    onClick={() => toggleTag(suggestion)}
                                                >
                                                    {suggestion}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="feedback-note">Đánh giá của bạn giúp người mua khác rất nhiều</p>
                                </div>
                            )}

                            <label className="feedback-textarea-field">
                                <span className="feedback-field-label">Nhận xét</span>
                                <textarea
                                    rows="5"
                                    value={feedbackForm.textComment}
                                    onChange={(e) => setFeedbackForm((prev) => ({ ...prev, textComment: e.target.value }))}
                                    placeholder="Chia sẻ thêm cảm nhận của bạn..."
                                />
                            </label>
                        </div>

                        <div className="feedback-modal-footer">
                            <button type="button" className="btn btn-outline" onClick={closeFeedbackModal} disabled={feedbackSubmitting}>
                                Huỷ
                            </button>
                            <button type="button" className="btn btn-primary" onClick={handleFeedbackSubmit} disabled={feedbackSubmitting}>
                                {feedbackSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {complaintOpen && (
                <div className="modal-overlay" onClick={closeComplaintModal}>
                    <div className="complaint-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="complaint-title">
                        <div className="complaint-modal-hero">
                            <div className="complaint-modal-badge">Hỗ trợ khách hàng</div>
                            <div className="complaint-modal-title-wrap">
                                <h3 id="complaint-title">Gửi khiếu nại đơn hàng</h3>
                                <p>
                                    Mô tả vấn đề thật rõ ràng để đội ngũ CSKH xử lý nhanh hơn và phản hồi đúng trọng tâm.
                                </p>
                            </div>
                            <button type="button" className="modal-close" onClick={closeComplaintModal} disabled={complaintSubmitting} aria-label="Đóng">
                                ×
                            </button>
                        </div>

                        <div className="complaint-modal-body">
                            <div className="complaint-callout">
                                <div className="complaint-callout-dot" />
                                <div>
                                    <strong>Gợi ý:</strong> nêu rõ sản phẩm bị ảnh hưởng, thời điểm phát sinh và mong muốn xử lý của bạn.
                                </div>
                            </div>

                            <label className="complaint-field complaint-field-textarea">
                                <span>Nội dung khiếu nại</span>
                                <textarea
                                    rows="6"
                                    value={complaintForm.reason}
                                    onChange={(e) => setComplaintForm((prev) => ({ ...prev, reason: e.target.value }))}
                                    placeholder="Ví dụ: Sản phẩm nhận được bị sai màu, bể góc hoặc thiếu phụ kiện..."
                                />
                            </label>

                            <div className="complaint-upload-section">
                                <div className="complaint-section-head">
                                    <span>Ảnh minh chứng</span>
                                    <p>Tải ảnh lên Supabase hoặc dán link ảnh có sẵn.</p>
                                </div>

                                <ImageUpload
                                    label=""
                                    helperText=""
                                    folder="complaints"
                                    value={complaintForm.evidenceImages[0] || ''}
                                    onChange={(nextValue) =>
                                        setComplaintForm((prev) => ({
                                            ...prev,
                                            evidenceImages: nextValue ? [nextValue] : [],
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="complaint-modal-footer">
                            <button type="button" className="btn btn-outline" onClick={closeComplaintModal} disabled={complaintSubmitting}>
                                Huỷ
                            </button>
                            <button type="button" className="btn btn-primary" onClick={handleComplaintSubmit} disabled={complaintSubmitting}>
                                {complaintSubmitting ? 'Đang gửi...' : 'Gửi khiếu nại'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderTrackingPage;
