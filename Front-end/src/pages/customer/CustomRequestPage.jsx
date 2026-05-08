import React, { useState } from 'react';
import { FiClock, FiImage, FiMessageSquare, FiPackage, FiShield, FiStar, FiUsers, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header/Header';
import ImageUpload from '../../components/ui/ImageUpload';
import { generateConceptImage, validateImageUrl } from '../../services/aiService';
import { createCustomRequestV2 as createCustomRequest } from '../../services/customRequestService';
import { appToast } from '../../lib/appToast';
import './CustomRequestPage.css';

const initialFormData = {
    title: '',
    description: '',
    referenceImageUrl: '',
    aiConceptImageUrl: '',
    aiImagePrompt: '',
    minBudget: '',
    maxBudget: '',
};

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
    if (['COMPLETED', 'PAID'].includes(key)) {
        return { label: key === 'PAID' ? 'Đã thanh toán' : 'Hoàn thành', className: 'stage-done' };
    }
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



const CustomRequestPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [formData, setFormData] = useState(initialFormData);
    const [submitting, setSubmitting] = useState(false);
    const [generatingImage, setGeneratingImage] = useState(false);
    const [validatingReference, setValidatingReference] = useState(false);
    const [referenceValidation, setReferenceValidation] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);

    const resetForm = () => {
        setFormData(initialFormData);
        setReferenceValidation(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleReferenceImageChange = async (nextValue) => {
        setFormData((prev) => ({ ...prev, referenceImageUrl: nextValue }));
        setReferenceValidation(null);

        const imageUrl = String(nextValue || '').trim();
        if (!imageUrl) return;

        setValidatingReference(true);
        try {
            const result = await validateImageUrl(imageUrl);
            if (result.success) {
                const data = result.data || {};
                setReferenceValidation(data);
                if (data.valid) {
                    appToast.success('Đã kiểm tra ảnh tham khảo', 'Ảnh tham khảo hợp lệ');
                } else {
                    appToast.warning('Cần kiểm tra ảnh tham khảo', 'Ảnh không phải vật phẩm Công Giáo');
                }
                return;
            }
            appToast.error('Không kiểm tra được ảnh tham khảo', result.error || 'Vui lòng thử lại');
        } finally {
            setValidatingReference(false);
        }
    };

    const validateForm = () => {
        const title = formData.title.trim();
        const description = formData.description.trim();
        const minBudget = Number(formData.minBudget || 0);
        const maxBudget = Number(formData.maxBudget || 0);

        if (title.length < 15) return 'Tiêu đề phải có ít nhất 15 ký tự.';
        if (description.length < 50) return 'Mô tả phải có ít nhất 50 ký tự.';
        if (Number.isFinite(minBudget) && Number.isFinite(maxBudget) && minBudget > maxBudget) {
            return 'Ngân sách tối thiểu phải nhỏ hơn hoặc bằng ngân sách tối đa.';
        }
        if (!formData.aiConceptImageUrl.trim()) return 'Vui lòng tạo hoặc thêm ảnh AI concept trước khi gửi.';
        return '';
    };

    const handleGenerateAiImage = async () => {
        const description = formData.description.trim();
        if (description.length < 50) {
            appToast.warning('Thiếu mô tả', 'Mô tả phải có ít nhất 50 ký tự trước khi tạo ảnh AI');
            return;
        }

        setGeneratingImage(true);
        try {
            const result = await generateConceptImage({ description });
            if (result.success) {
                const data = result.data || {};
                setFormData((prev) => ({
                    ...prev,
                    aiConceptImageUrl: String(data.imageUrl || '').trim(),
                    aiImagePrompt: String(data.prompt || '').trim(),
                }));
                appToast.success('Tạo ảnh AI thành công', 'Ảnh concept đã được cập nhật');
                return;
            }
            appToast.error('Không tạo được ảnh AI', result.error || 'Vui lòng thử lại');
        } finally {
            setGeneratingImage(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!isAuthenticated) {
            appToast.warning('Vui lòng đăng nhập', 'Bạn cần đăng nhập để gửi yêu cầu đặt riêng');
            navigate('/login');
            return;
        }

        const validationError = validateForm();
        if (validationError) {
            appToast.warning('Dữ liệu chưa hợp lệ', validationError);
            return;
        }

        if (referenceValidation && referenceValidation.valid === false) {
            appToast.warning('Ảnh tham khảo chưa hợp lệ', 'Vui lòng đổi ảnh tham khảo khác trước khi gửi yêu cầu');
            return;
        }

        setSubmitting(true);
        try {
            const result = await createCustomRequest({
                title: formData.title.trim(),
                description: formData.description.trim(),
                minBudget: Number(formData.minBudget || 0),
                maxBudget: Number(formData.maxBudget || 0),
                referenceImages: formData.referenceImageUrl.trim() ? [formData.referenceImageUrl.trim()] : [],
                aiConceptImageUrl: formData.aiConceptImageUrl.trim(),
                aiImagePrompt: formData.aiImagePrompt.trim(),
            });

            if (result.success) {
                resetForm();
                setModalOpen(false);
                appToast.success('Gửi yêu cầu thành công', 'Nghệ nhân sẽ xem và phản hồi sớm nhất');
                return;
            }

            appToast.error('Có lỗi xảy ra', result.error || 'Vui lòng thử lại');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="custom-request-page">
            <Header />
            <main className="custom-request-page-main">
                <section className="custom-request-hero">
                    <div className="custom-request-hero-content">
                        <div className="custom-request-badge">Đặt hàng riêng cho khách hàng</div>
                        <h1 className="custom-request-title">Thiết kế món quà Công giáo theo ý bạn</h1>
                        <p className="custom-request-subtitle">
                            Gửi ý tưởng, chọn nghệ nhân yêu thích và nhận báo giá riêng — hoàn toàn không bị ràng buộc mua ngay.
                        </p>

                        <div className="custom-request-actions">
                            <button type="button" className="btn btn-primary btn-large" onClick={() => setModalOpen(true)}>
                                Bắt đầu đặt riêng
                            </button>
                            <button type="button" className="btn btn-outline btn-large" onClick={() => navigate('/custom-requests')}>
                                Xem yêu cầu của tôi
                            </button>
                            <button type="button" className="btn btn-outline btn-large" onClick={() => navigate('/manage-custom-request')}>
                                Quản lý yêu cầu của tôi
                            </button>
                        </div>

                        <div className="custom-request-stats">
                            <div className="stat-card"><FiShield /><span>Riêng tư & an toàn</span></div>
                            <div className="stat-card"><FiClock /><span>Phản hồi nhanh</span></div>
                            <div className="stat-card"><FiImage /><span>Gợi ý AI trực quan</span></div>
                        </div>
                    </div>

                    <div className="custom-request-hero-card">
                        <div className="hero-card-top">
                            <FiStar />
                            <span>Quy trình 4 bước</span>
                        </div>
                        <ol className="hero-steps">
                            <li><FiMessageSquare />Tạo custom request</li>
                            <li><FiUsers />Artisan báo giá</li>
                            <li><FiImage />Chọn artisan & thanh toán theo từng stage</li>
                            <li><FiPackage />Artisan thực hiện, customer duyệt & tạo shipment</li>
                        </ol>
                    </div>
                </section>

                <section className="custom-request-content-grid">
                    <div className="custom-request-form-card">
                        <div className="section-heading">
                            <h2>Thông tin yêu cầu</h2>
                            <p>Hãy mô tả càng rõ càng tốt để nghệ nhân hiểu đúng mong muốn của bạn.</p>
                        </div>
                        <button type="button" className="btn btn-primary btn-large" onClick={() => setModalOpen(true)}>
                            Mở form đặt riêng
                        </button>
                    </div>
                </section>
            </main>

            {modalOpen && (
                <div className="custom-request-modal-overlay" onClick={() => setModalOpen(false)} role="button" tabIndex={0}>
                    <div className="custom-request-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Form đặt riêng">
                        <div className="custom-request-modal-header">
                            <div>
                                <h2>Thông tin yêu cầu</h2>
                                <p>Điền nội dung để gửi yêu cầu đặt riêng cho nghệ nhân.</p>
                            </div>
                            <button type="button" className="custom-request-modal-close" onClick={() => setModalOpen(false)} aria-label="Đóng modal">
                                <FiX />
                            </button>
                        </div>

                        <form className="custom-request-modal-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="title">Tiêu đề dự án <span className="required">*</span></label>
                                <input id="title" name="title" className="form-input" value={formData.title} onChange={handleChange} required />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="description">Mô tả chi tiết <span className="required">*</span></label>
                                <textarea id="description" name="description" className="form-input form-textarea" rows="6" value={formData.description} onChange={handleChange} required />
                            </div>

                            <div className="custom-request-budget-row">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="minBudget">Ngân sách tối thiểu</label>
                                    <input id="minBudget" name="minBudget" type="number" className="form-input" value={formData.minBudget} onChange={handleChange} min="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="maxBudget">Ngân sách tối đa</label>
                                    <input id="maxBudget" name="maxBudget" type="number" className="form-input" value={formData.maxBudget} onChange={handleChange} min="0" />
                                </div>
                            </div>

                            <ImageUpload
                                value={formData.referenceImageUrl}
                                onChange={handleReferenceImageChange}
                                label="Ảnh tham khảo"
                                folder="custom-requests"
                            />

                            <div className="form-hint-row">
                                {validatingReference ? (
                                    <span className="form-hint form-hint-info">Đang kiểm tra ảnh tham khảo...</span>
                                ) : referenceValidation ? (
                                    <span className={`form-hint ${referenceValidation.valid ? 'form-hint-success' : 'form-hint-warning'}`}>
                                        {referenceValidation.valid
                                            ? `Ảnh hợp lệ${referenceValidation.requiresManualReview ? ' - cần review thủ công' : ''}`
                                            : 'Ảnh không phải vật phẩm Công Giáo'}
                                    </span>
                                ) : null}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Ảnh concept AI</label>
                                <div className="ai-concept-preview">
                                    {formData.aiConceptImageUrl.trim() ? (
                                        <img src={formData.aiConceptImageUrl.trim()} alt="AI concept preview" className="ai-concept-preview-img" />
                                    ) : (
                                        <div className="ai-concept-preview-empty">
                                            <FiImage />
                                            <span>Chưa có ảnh concept</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <button type="button" className="btn btn-outline btn-large" onClick={handleGenerateAiImage} disabled={generatingImage || submitting}>
                                    {generatingImage ? 'Đang tạo ảnh AI...' : 'Generate AI Image'}
                                </button>
                            </div>

                            <div className="request-form-footer">
                                <p className="notice-text">Gửi form này không ràng buộc bạn mua hàng. Nghệ nhân sẽ gửi báo giá chính thức để bạn duyệt.</p>
                                <button type="submit" className="btn btn-primary btn-large" disabled={submitting || generatingImage}>
                                    {submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu báo giá'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomRequestPage;
