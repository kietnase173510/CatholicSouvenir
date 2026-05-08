import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiCheckCircle, FiClock, FiDollarSign, FiFileText, FiMail, FiPhone, FiTruck, FiUser } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import ImageUpload from '../../components/ui/ImageUpload';
import { useAuth } from '../../context/AuthContext';
import { appToast } from '../../lib/appToast';
import {
    cancelCustomOrder,
    completeStage,
    getCustomOrderDetail,
    getCustomOrderRefundEstimate,
    getCustomOrderStages,
    getUserProfileById,
    startStage,
    updateCustomOrderStatus,
    uploadStageProof,
} from '../../services/customRequestService';
import { createShipment } from '../../services/shipmentService';
import Sidebar from './components/Sidebar';
import './ArtisanDashboard.css';
import './ArtisanCustomOrderDetailPage.css';

const moneyFormatter = new Intl.NumberFormat('vi-VN');
const formatCurrency = (value) => `${moneyFormatter.format(Number(value || 0))} đ`;

const formatDate = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString('vi-VN');
    } catch {
        return value;
    }
};

const ORDER_STATUS_LABELS = {
    PENDING_PAYMENT: 'Chờ thanh toán',
    CONFIRMED: 'Đã xác nhận',
    IN_PROGRESS: 'Đang thực hiện',
    IN_PRODUCTION: 'Đang sản xuất',
    SHIPPING: 'Đang giao hàng',
    DELIVERED: 'Đã giao',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã huỷ',
    CANCELLED_BY_ARTISAN: 'Đã huỷ bởi nghệ nhân',
    CANCELLED_BY_CUSTOMER: 'Đã huỷ bởi khách hàng',
    CANCELLED_BY_SYSTEM: 'Đã huỷ bởi hệ thống',
    REFUNDED: 'Đã hoàn tiền',
};

const ORDER_STATUS_OPTIONS = [
    { value: 'PENDING_PAYMENT', label: 'Chờ thanh toán' },
    { value: 'CONFIRMED', label: 'Đã xác nhận' },
    { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
    { value: 'IN_PRODUCTION', label: 'Đang sản xuất' },
    { value: 'SHIPPING', label: 'Đang giao hàng' },
    { value: 'DELIVERED', label: 'Đã giao' },
    { value: 'COMPLETED', label: 'Hoàn thành' },
    { value: 'CANCELLED', label: 'Đã huỷ' },
    { value: 'REFUNDED', label: 'Đã hoàn tiền' },
];

const getStatusLabel = (status) => ORDER_STATUS_LABELS[String(status || '').toUpperCase()] || status || '—';

const getStatusClass = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'COMPLETED') return 'completed';
    if (s === 'CANCELLED' || s === 'REFUNDED') return 'cancelled';
    if (s === 'IN_PROGRESS' || s === 'IN_PRODUCTION' || s === 'SHIPPING' || s === 'DELIVERED' || s === 'PAID') return 'in-progress';
    return 'pending';
};

const ORDER_STATUS_FLOW = {
    PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['IN_PRODUCTION', 'CANCELLED'],
    IN_PRODUCTION: ['SHIPPING', 'CANCELLED'],
    SHIPPING: ['DELIVERED', 'CANCELLED'],
    DELIVERED: ['COMPLETED', 'REFUNDED'],
    COMPLETED: [],
    CANCELLED: [],
    REFUNDED: [],
};

const getAllowedNextStatuses = (status, role) => {
    const current = String(status || '').toUpperCase();
    const currentAllowed = ORDER_STATUS_FLOW[current] || [];
    if (role !== 'ADMIN') {
        return currentAllowed.filter((nextStatus) => nextStatus !== 'REFUNDED');
    }
    return currentAllowed;
};

const isCompleted = (stage) => String(stage?.status || '').toUpperCase() === 'COMPLETED';
const isActiveStage = (stage) => {
    const s = String(stage?.status || '').toUpperCase();
    return s === 'PAID' || s === 'IN_PROGRESS';
};

const LOCATION_API_BASE = 'https://provinces.open-api.vn/api';

const mapLocationItem = (item) => ({
    code: String(item?.code ?? item?.province_id ?? item?.district_id ?? item?.ward_id ?? ''),
    name: item?.name || item?.province_name || item?.district_name || item?.ward_name || '',
});

const normalizeLocationText = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const findLocationCodeByName = (items, name) => {
    const target = normalizeLocationText(name);
    if (!target) return '';
    const found = items.find((item) => normalizeLocationText(item?.name) === target);
    return found?.code || '';
};

const ArtisanOrderDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const role = String(user?.role || '').toUpperCase();

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState(null);
    const [stages, setStages] = useState([]);
    const [submittingStageId, setSubmittingStageId] = useState('');
    const [cancelling, setCancelling] = useState(false);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelEstimate, setCancelEstimate] = useState(null);
    const [cancelEstimateLoading, setCancelEstimateLoading] = useState(false);
    const [proofByStage, setProofByStage] = useState({});
    const [notesByStage, setNotesByStage] = useState({});
    const [shipmentFormOpen, setShipmentFormOpen] = useState(false);
    const [shippingSubmitting, setShippingSubmitting] = useState(false);
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [shipmentForm, setShipmentForm] = useState({
        recipientName: '',
        recipientPhone: '',
        deliveryAddress: '',
        provinceCode: '',
        districtCode: '',
        wardCode: '',
        orderValue: '',
        weight: '1000',
        length: '20',
        width: '20',
        height: '20',
        note: '',
        serviceTypeId: '2',
        paymentTypeId: '1',
    });
    const [statusDraft, setStatusDraft] = useState('');
    const [statusSubmitting, setStatusSubmitting] = useState(false);
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);
    const [customerProfile, setCustomerProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileApplied, setProfileApplied] = useState(false);
    const [locationLoading, setLocationLoading] = useState({ provinces: false, districts: false, wards: false });
    const customerAccountId = order?.accountId || order?.customerAccountId || order?.customer?.accountId || order?.customerId || '';

    const loadAll = async () => {
        setLoading(true);
        const [detailRes, stagesRes] = await Promise.all([
            getCustomOrderDetail(id),
            getCustomOrderStages(id),
        ]);
        setLoading(false);

        if (!detailRes.success) {
            appToast.error('Không tải được chi tiết đơn', detailRes.error || 'Vui lòng thử lại');
            return;
        }

        const nextOrder = detailRes.data || null;
        setOrder(nextOrder);
        setStages(stagesRes.success ? (Array.isArray(stagesRes.data) ? stagesRes.data : []) : []);
        setStatusDraft(String(nextOrder?.status || '').toUpperCase());
    };

    useEffect(() => {
        loadAll();
    }, [id]);

    useEffect(() => {
        if (!customerAccountId) {
            setCustomerProfile(null);
            setProfileApplied(false);
            setProfileLoading(false);
            return;
        }

        let cancelled = false;
        setProfileLoading(true);

        const loadProfile = async () => {
            const res = await getUserProfileById(customerAccountId);
            if (cancelled) return;

            if (res.success) {
                setCustomerProfile(res.data || null);
            } else {
                setCustomerProfile(null);
            }
            setProfileLoading(false);
        };

        loadProfile();

        return () => {
            cancelled = true;
        };
    }, [customerAccountId]);

    const applyCustomerProfileToShipmentForm = useCallback(() => {
        const profile = customerProfile || {};
        const mergedAddress = [profile?.address, profile?.ward, profile?.district, profile?.city].filter(Boolean).join(', ');
        const provinceCode = findLocationCodeByName(provinces, profile?.city || profile?.province || profile?.provinceName);
        const districtCode = findLocationCodeByName(districts, profile?.district || profile?.districtName);
        const wardCode = findLocationCodeByName(wards, profile?.ward || profile?.wardName);

        console.groupCollapsed('[Shipment] Apply customer profile to form');
        console.log('profile:', profile);
        console.log('mergedAddress:', mergedAddress);
        console.log('resolved provinceCode:', provinceCode);
        console.log('resolved districtCode:', districtCode);
        console.log('resolved wardCode:', wardCode);
        console.log('current provinces:', provinces);
        console.log('current districts:', districts);
        console.log('current wards:', wards);
        console.groupEnd();

        setShipmentForm((prev) => ({
            ...prev,
            recipientName: profile?.fullName || order?.recipientName || order?.customerName || prev.recipientName || '',
            recipientPhone: profile?.phone || order?.recipientPhone || order?.customerPhone || prev.recipientPhone || '',
            deliveryAddress: mergedAddress || order?.deliveryAddress || order?.shippingAddress || prev.deliveryAddress || '',
            provinceCode: provinceCode || prev.provinceCode,
            districtCode: districtCode || prev.districtCode,
            wardCode: wardCode || prev.wardCode,
            orderValue: String(order?.totalPrice || prev.orderValue || ''),
        }));
        setProfileApplied(true);
    }, [customerProfile, districts, order, provinces, wards]);

    useEffect(() => {
        if (!shipmentFormOpen) return;
        if (!customerProfile && !order) return;

        console.groupCollapsed('[Shipment] Re-apply profile while modal open');
        console.log('shipmentFormOpen:', shipmentFormOpen);
        console.log('customerProfile:', customerProfile);
        console.log('order:', order);
        console.groupEnd();

        applyCustomerProfileToShipmentForm();
    }, [shipmentFormOpen, customerProfile, order, applyCustomerProfileToShipmentForm]);

    const progress = useMemo(() => {
        if (!stages.length) return 0;
        const done = stages.filter(isCompleted).length;
        return Math.round((done / stages.length) * 100);
    }, [stages]);

    const activeStage = useMemo(() => stages.find(isActiveStage) || null, [stages]);

    const shipmentReady = useMemo(() => {
        const profile = customerProfile || {};
        const phone = String(
            profile?.phone || order?.recipientPhone || order?.customerPhone || order?.shippingPhone || ''
        ).trim();
        const address = String(
            profile?.address
            || [profile?.ward, profile?.district, profile?.city].filter(Boolean).join(', ')
            || order?.deliveryAddress
            || order?.shippingAddress
            || ''
        ).trim();
        const name = String(profile?.fullName || order?.recipientName || order?.customerName || '').trim();
        return {
            recipientName: shipmentForm.recipientName || name,
            recipientPhone: shipmentForm.recipientPhone || phone,
            deliveryAddress: shipmentForm.deliveryAddress || address,
            orderValue: shipmentForm.orderValue || order?.totalPrice || 0,
        };
    }, [order, shipmentForm, customerProfile]);

    const selectedProvince = useMemo(
        () => provinces.find((item) => item.code === shipmentForm.provinceCode) || null,
        [provinces, shipmentForm.provinceCode],
    );
    const selectedDistrict = useMemo(
        () => districts.find((item) => item.code === shipmentForm.districtCode) || null,
        [districts, shipmentForm.districtCode],
    );

    useEffect(() => {
        if (!shipmentFormOpen) {
            setShipmentForm((prev) => ({
                ...prev,
                provinceCode: '',
                districtCode: '',
                wardCode: '',
            }));
            setDistricts([]);
            setWards([]);
            setProfileApplied(false);
        }
    }, [shipmentFormOpen]);

    const revenueCurrent = Number(activeStage?.amount || 0) * 0.9;
    const completedRevenue = stages.filter(isCompleted).reduce((sum, stage) => sum + Number(stage?.amount || 0) * 0.9, 0);
    const expectedRemain = stages.filter((stage) => !isCompleted(stage)).reduce((sum, stage) => sum + Number(stage?.amount || 0) * 0.9, 0);

    const openCancelModal = async () => {
        if (!id || cancelling) return;

        setCancelReason('');
        setCancelEstimate(null);
        setCancelModalOpen(true);
        setCancelEstimateLoading(true);

        const res = await getCustomOrderRefundEstimate(id);
        setCancelEstimateLoading(false);

        if (!res.success) {
            setCancelEstimate(null);
            appToast.error('Không thể ước tính hoàn tiền', res.error || 'Vui lòng thử lại');
            return;
        }

        setCancelEstimate(res.data || null);
    };

    const handleCancelOrder = async () => {
        if (!id || cancelling) return;
        if (!cancelReason.trim()) return;

        setCancelling(true);
        const res = await cancelCustomOrder(id, cancelReason.trim());
        setCancelling(false);

        if (!res.success) {
            appToast.error('Hủy đơn thất bại', res.error || 'Vui lòng thử lại');
            return;
        }

        setCancelModalOpen(false);
        setCancelEstimate(null);
        appToast.success('Đã hủy đơn thành công');
        navigate('/artisan/orders');
    };

    const handleStatusUpdate = async () => {
        if (!id || !statusDraft || statusSubmitting) return;
        if (isCancelledOrder) {
            appToast.warning('Đơn hàng đã hủy', 'Không thao tác được.');
            return;
        }

        const currentStatus = String(order?.status || '').toUpperCase();
        const nextStatus = String(statusDraft || '').toUpperCase();
        const allowedNextStatuses = getAllowedNextStatuses(currentStatus, role);

        if (!allowedNextStatuses.includes(nextStatus)) {
            appToast.warning('Trạng thái không hợp lệ', 'Vui lòng chọn trạng thái đúng theo luồng xử lý.');
            return;
        }

        setStatusSubmitting(true);
        const res = await updateCustomOrderStatus(id, nextStatus);
        setStatusSubmitting(false);

        if (!res.success) {
            appToast.error('Cập nhật trạng thái thất bại', res.error || 'Vui lòng thử lại');
            return;
        }

        appToast.success(`Đã chuyển sang ${getStatusLabel(nextStatus)}`);
        loadAll();
    };

    const handleStartStage = async (stage) => {
        const stageId = stage?.stageId ?? stage?.id;
        if (!stageId || submittingStageId) return;
        if (isCancelledOrder) {
            appToast.warning('Đơn hàng đã hủy', 'Không thao tác được.');
            return;
        }

        setSubmittingStageId(String(stageId));
        const res = await startStage(stageId);
        setSubmittingStageId('');

        if (!res.success) {
            appToast.error('Không thể bắt đầu stage', res.error || 'Vui lòng thử lại');
            return;
        }

        appToast.success(`Đã bắt đầu giai đoạn ${stage?.stageName || ''}`);
        loadAll();
    };

    const handleCompleteStage = async (stage) => {
        const stageId = stage?.stageId ?? stage?.id;
        if (!stageId || submittingStageId) return;
        if (isCancelledOrder) {
            appToast.warning('Đơn hàng đã hủy', 'Không thao tác được.');
            return;
        }

        const completionImageUrl = proofByStage[String(stageId)] || stage?.completionImageUrl || '';
        const notes = notesByStage[String(stageId)] || '';

        if (!completionImageUrl) {
            appToast.warning('Vui lòng upload ảnh kết quả trước khi hoàn thành');
            return;
        }

        setSubmittingStageId(String(stageId));
        const uploadRes = await uploadStageProof(stageId, { completionImageUrl, notes });

        if (!uploadRes.success) {
            setSubmittingStageId('');
            appToast.error('Không thể upload proof stage', uploadRes.error || 'Vui lòng thử lại');
            return;
        }

        const completeRes = await completeStage(stageId, { completionImageUrl, notes });
        setSubmittingStageId('');

        if (!completeRes.success) {
            appToast.error('Không thể hoàn thành stage', completeRes.error || 'Vui lòng thử lại');
            loadAll();
            return;
        }

        appToast.success(`Đã hoàn thành giai đoạn ${stage?.stageName || ''}`);
        loadAll();
    };

    const openImagePreview = (url) => {
        if (!url) return;
        setImagePreviewUrl(url);
    };

    const closeImagePreview = () => setImagePreviewUrl('');

    const openShipmentForm = () => {
        navigate('/artisan/shipments');
    };

    const customerShippingPreview = useMemo(() => {
        const profile = customerProfile || {};
        return {
            fullName: profile?.fullName || order?.customerName || 'Khách hàng',
            email: profile?.email || order?.customerEmail || '—',
            phone: profile?.phone || order?.customerPhone || '—',
            address: profile?.address || order?.deliveryAddress || order?.shippingAddress || '—',
        };
    }, [customerProfile, order]);

    useEffect(() => {
        const loadProvinces = async () => {
            setLocationLoading((prev) => ({ ...prev, provinces: true }));
            try {
                const response = await fetch(`${LOCATION_API_BASE}/p/`);
                const data = await response.json();
                setProvinces(Array.isArray(data) ? data.map(mapLocationItem) : []);
            } catch {
                appToast.error('Không tải được danh sách tỉnh/thành');
            } finally {
                setLocationLoading((prev) => ({ ...prev, provinces: false }));
            }
        };

        loadProvinces();
    }, []);

    useEffect(() => {
        const loadDistricts = async () => {
            if (!shipmentForm.provinceCode) {
                setDistricts([]);
                setWards([]);
                return;
            }

            setLocationLoading((prev) => ({ ...prev, districts: true }));
            try {
                const response = await fetch(`${LOCATION_API_BASE}/p/${shipmentForm.provinceCode}?depth=2`);
                const data = await response.json();
                setDistricts(Array.isArray(data?.districts) ? data.districts.map(mapLocationItem) : []);
                setWards([]);
                setShipmentForm((prev) => ({ ...prev, districtCode: '', wardCode: '' }));
            } catch {
                appToast.error('Không tải được danh sách quận/huyện');
            } finally {
                setLocationLoading((prev) => ({ ...prev, districts: false }));
            }
        };

        loadDistricts();
    }, [shipmentForm.provinceCode]);

    useEffect(() => {
        const loadWards = async () => {
            if (!shipmentForm.districtCode) {
                setWards([]);
                return;
            }

            setLocationLoading((prev) => ({ ...prev, wards: true }));
            try {
                const response = await fetch(`${LOCATION_API_BASE}/d/${shipmentForm.districtCode}?depth=2`);
                const data = await response.json();
                setWards(Array.isArray(data?.wards) ? data.wards.map(mapLocationItem) : []);
                setShipmentForm((prev) => ({ ...prev, wardCode: '' }));
            } catch {
                appToast.error('Không tải được danh sách phường/xã');
            } finally {
                setLocationLoading((prev) => ({ ...prev, wards: false }));
            }
        };

        loadWards();
    }, [shipmentForm.districtCode]);

    const handleCreateShipment = async () => {
        const shipmentOrderId = order?.customOrderId || order?.orderId || order?.id;
        const recipientName = String(shipmentForm.recipientName || '').trim();
        const recipientPhone = String(shipmentForm.recipientPhone || '').trim();
        const deliveryAddress = String(shipmentForm.deliveryAddress || '').trim();
        const provinceCode = String(shipmentForm.provinceCode || '').trim();
        const districtCode = String(shipmentForm.districtCode || '').trim();
        const wardCode = String(shipmentForm.wardCode || '').trim();
        const selectedProvinceName = selectedProvince?.name || '';
        const selectedDistrictName = selectedDistrict?.name || '';
        const fullAddress = [deliveryAddress, selectedDistrictName, selectedProvinceName].filter(Boolean).join(', ');

        console.groupCollapsed('[Shipment] Create shipment request');
        console.log('order detail:', order);
        console.log('shipment form:', shipmentForm);
        console.log('selected province:', selectedProvince);
        console.log('selected district:', selectedDistrict);
        console.log('selected ward code:', wardCode);
        console.log('resolved orderId:', shipmentOrderId, '(will send null for this page)');
        console.groupEnd();

        if (shippingSubmitting) {
            console.warn('[Shipment] Skip create shipment because request is already in progress.');
            appToast.error('Đang xử lý', 'Vui lòng chờ yêu cầu hiện tại hoàn tất.');
            return;
        }

        if (!recipientName || !recipientPhone || !deliveryAddress) {
            console.warn('[Shipment] Skip create shipment because required recipient fields are missing.', {
                recipientName,
                recipientPhone,
                deliveryAddress,
            });
            appToast.error('Thiếu thông tin giao hàng', 'Vui lòng nhập đầy đủ người nhận, số điện thoại và địa chỉ.');
            return;
        }

        if (!provinceCode || !districtCode || !wardCode) {
            appToast.error('Thiếu địa chỉ nhận', 'Vui lòng chọn đầy đủ tỉnh/thành, quận/huyện và phường/xã.');
            return;
        }

        if (!selectedProvince || !selectedDistrict) {
            appToast.error('Địa chỉ không hợp lệ', 'Vui lòng chọn lại tỉnh/thành và quận/huyện.');
            return;
        }

        const payload = {
            orderId: null,
            customOrderId: order?.customOrderId || order?.id || undefined,
            recipientName,
            recipientPhone,
            deliveryAddress: fullAddress,
            toDistrictId: selectedDistrict?.code || '',
            toWardCode: wardCode,
            orderValue: shipmentForm.orderValue || order?.totalPrice || 0,
            weight: shipmentForm.weight,
            length: shipmentForm.length,
            width: shipmentForm.width,
            height: shipmentForm.height,
            note: shipmentForm.note.trim(),
            serviceTypeId: shipmentForm.serviceTypeId,
            paymentTypeId: shipmentForm.paymentTypeId,
        };

        console.groupCollapsed('[Shipment] Payload before API call');
        console.log(payload);
        console.groupEnd();

        setShippingSubmitting(true);
        try {
            const res = await createShipment(payload);
            console.log('[Shipment] API response:', res);

            if (!res.success) {
                appToast.error('Tạo vận đơn thất bại', res.error || 'Vui lòng thử lại');
                return;
            }

            setShipmentFormOpen(false);
            appToast.success('Đã tạo vận đơn thành công');
        } catch (error) {
            console.error('[Shipment] Unexpected error while creating shipment:', error);
            appToast.error('Tạo vận đơn thất bại', 'Đã xảy ra lỗi không mong muốn. Vui lòng kiểm tra console.');
        } finally {
            setShippingSubmitting(false);
        }
    };

    if (!id) return <div className="artisan-empty">Thiếu mã đơn hàng.</div>;
    if (loading) return <div className="artisan-skeleton-page" />;
    if (!order) return <div className="artisan-empty">Không tìm thấy đơn hàng.</div>;

    const status = String(order?.status || '').toUpperCase();
    const allowedNextStatuses = getAllowedNextStatuses(status, role);
    const isCancelledOrder = status === 'CANCELLED' || status === 'CANCELLED_BY_ARTISAN';
    const orderTitle = order?.requestDescription || order?.requestTitle || order?.description || 'Đơn tùy chỉnh';

    return (
        <div className="artisan-dashboard">
            <Sidebar
                user={user}
                activeView="customOrders"
                setActiveView={(view) => navigate(view === 'customOrders' ? '/artisan/orders' : `/artisan/${view}`)}
                onLogout={logout}
            />

            <main className="artisan-main">
                <div className="artisan-order-detail-page modern-order-detail-page">
                    <header className="detail-page-header">
                        <button type="button" className="btn btn-outline back-btn-top" onClick={() => navigate('/artisan/orders')}>
                            ← Quay lại danh sách
                        </button>

                        <div className="header-main-row">
                            <h1>{orderTitle}</h1>
                        </div>
                    </header>

                    <section className="detail-summary-grid">
                        <article className="summary-card summary-status-card">
                            <span className="summary-icon"><FiCheckCircle /></span>
                            <div>
                                <p>Trạng thái đơn</p>
                                <strong><span className={`status-badge ${getStatusClass(status)}`}>{getStatusLabel(status)}</span></strong>
                            </div>
                        </article>
                        <article className="summary-card">
                            <span className="summary-icon"><FiDollarSign /></span>
                            <div>
                                <p>Tổng đơn</p>
                                <strong>{formatCurrency(order?.totalPrice)}</strong>
                            </div>
                        </article>
                        <article className="summary-card">
                            <span className="summary-icon icon-blue"><FiClock /></span>
                            <div>
                                <p>Đang xử lý</p>
                                <strong>{activeStage?.stageName || '—'}</strong>
                            </div>
                        </article>
                        <article className="summary-card">
                            <span className="summary-icon icon-green"><FiCheckCircle /></span>
                            <div>
                                <p>Tiến độ</p>
                                <strong>{progress}%</strong>
                            </div>
                        </article>
                        <article className="summary-card">
                            <span className="summary-icon icon-amber"><FiCalendar /></span>
                            <div>
                                <p>Ngày tạo</p>
                                <strong>{formatDate(order?.createdAt)}</strong>
                            </div>
                        </article>
                    </section>

                    <div className="detail-layout-grid">
                        <section className="left-col">
                            <article className="card-box info-card">
                                <h3>Thông tin đơn</h3>
                                <div className="info-grid">
                                    <div>
                                        <label>Khách hàng</label>
                                        <p>{order?.customerName || '—'}</p>
                                    </div>
                                    <div>
                                        <label>Tổng giá trị</label>
                                        <p>{formatCurrency(order?.totalPrice)}</p>
                                    </div>
                                    <div className="full-width">
                                        <label>Mô tả</label>
                                        <p>{order?.description || '—'}</p>
                                    </div>
                                </div>
                            </article>

                            <article className="card-box">
                                <div className="stage-card-header">
                                    <h3>Tiến độ các giai đoạn</h3>
                                    <span>{stages.length} giai đoạn</span>
                                </div>

                                <div className="progress-wrap">
                                    <div className="progress-track"><div className="progress-value" style={{ width: `${progress}%` }} /></div>
                                    <small>{progress}% hoàn thành</small>
                                </div>

                                <div className="stages-list">
                                    {stages.map((stage, idx) => {
                                        const stageId = stage?.stageId ?? stage?.id;
                                        const completed = isCompleted(stage);
                                        const active = isActiveStage(stage);
                                        const pending = !completed && !active;
                                        const proofPreview = proofByStage[String(stageId)] || stage?.completionImageUrl || '';

                                        return (
                                            <div key={String(stageId || idx)} className={`stage-item ${completed ? 'completed' : active ? 'active' : 'pending'}`}>
                                                <div className="timeline-dot">{completed ? '✓' : idx + 1}</div>
                                                <div className="stage-content">
                                                    <div className="stage-top-row">
                                                        <h4>{stage?.stageName || `Giai đoạn ${idx + 1}`}</h4>
                                                        <span className={`mini-status ${getStatusClass(stage?.status)}`}>{getStatusLabel(stage?.status)}</span>
                                                    </div>

                                                    <div className="stage-sub-row">
                                                        <span>{completed ? `Hoàn thành: ${formatDate(stage?.completedAt)}` : `Hạn: ${formatDate(stage?.dueDate)}`}</span>
                                                        <strong>{formatCurrency(stage?.amount)}</strong>
                                                    </div>

                                                    {proofPreview && (
                                                        <button
                                                            type="button"
                                                            className="proof-thumb-button"
                                                            onClick={() => openImagePreview(proofPreview)}
                                                            aria-label="Xem ảnh hoàn thành"
                                                        >
                                                            <img src={proofPreview} alt="completion" className="proof-thumb" />
                                                            <span>Xem ảnh</span>
                                                        </button>
                                                    )}

                                                    {completed && <p className="muted">Giai đoạn đã hoàn thành.</p>}

                                                    {active && (
                                                        <div className="stage-complete-form">
                                                            <ImageUpload
                                                                label="Ảnh kết quả"
                                                                helperText="Tải ảnh lên hoặc dán URL ảnh hoàn thành."
                                                                folder="stage-proofs"
                                                                value={proofByStage[String(stageId)] || stage?.completionImageUrl || ''}
                                                                onChange={(nextValue) => setProofByStage((prev) => ({ ...prev, [String(stageId)]: nextValue }))}
                                                                disabled={submittingStageId === String(stageId) || isCancelledOrder}
                                                                nativeFileInputOnly
                                                            />
                                                            <textarea
                                                                rows="3"
                                                                placeholder="Ghi chú hoàn thành"
                                                                value={notesByStage[String(stageId)] || ''}
                                                                onChange={(e) => setNotesByStage((prev) => ({ ...prev, [String(stageId)]: e.target.value }))}
                                                                disabled={isCancelledOrder}
                                                            />
                                                            <div className="stage-action-row">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline"
                                                                    disabled={submittingStageId === String(stageId) || completed || isCancelledOrder}
                                                                    onClick={() => handleStartStage(stage)}
                                                                >
                                                                    {submittingStageId === String(stageId)
                                                                        ? 'Đang xử lý...'
                                                                        : 'Bắt đầu làm'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-primary"
                                                                    disabled={submittingStageId === String(stageId) || completed || isCancelledOrder}
                                                                    onClick={() => handleCompleteStage(stage)}
                                                                >
                                                                    {isCancelledOrder
                                                                        ? 'Đơn đã hủy'
                                                                        : submittingStageId === String(stageId) || completed
                                                                            ? 'Đã hoàn thành'
                                                                            : `Đánh dấu hoàn thành giai đoạn ${idx + 1}`}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {pending && <p className="muted">Chờ giai đoạn trước hoàn thành.</p>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </article>
                        </section>

                        <aside className="right-col">
                            <article className="card-box side-card">
                                <h3>Thông tin khách hàng</h3>
                                <div className="person-row">
                                    <span className="person-icon"><FiUser /></span>
                                    <div>
                                        <strong>{customerShippingPreview.fullName}</strong>
                                        <p><FiMail /> {customerShippingPreview.email}</p>
                                        <p><FiPhone /> {customerShippingPreview.phone}</p>
                                    </div>
                                </div>
                                <div className="customer-shipping-preview">
                                    <p><strong>Địa chỉ:</strong> {customerShippingPreview.address}</p>
                                    {profileLoading && <p className="muted">Đang tải hồ sơ khách hàng...</p>}
                                </div>
                            </article>

                            <article className="card-box side-card shipment-card">
                                <h3>Tạo vận đơn</h3>
                                <p className="muted">Tạo vận đơn cho đơn này trực tiếp từ dashboard artisan.</p>
                                <div className="shipment-card-actions">
                                    <button type="button" className="btn btn-primary" onClick={openShipmentForm} disabled={isCancelledOrder}>
                                        <FiTruck /> Tạo vận đơn
                                    </button>
                                </div>
                            </article>

                            <article className="card-box side-card">
                                <h3>Cập nhật trạng thái</h3>
                                <div className="status-update-panel">
                                    <div className="status-select-wrap">
                                        <select
                                            className="form-input status-select"
                                            value={statusDraft}
                                            onChange={(e) => setStatusDraft(e.target.value)}
                                            disabled={isCancelledOrder || !allowedNextStatuses.length || statusSubmitting}
                                        >
                                            <option value="">Chọn trạng thái mới</option>
                                            {allowedNextStatuses.map((optionValue) => (
                                                <option key={optionValue} value={optionValue}>
                                                    {getStatusLabel(optionValue)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={handleStatusUpdate}
                                        disabled={isCancelledOrder || !statusDraft || statusSubmitting || !allowedNextStatuses.includes(statusDraft)}
                                    >
                                        {statusSubmitting ? 'Đang cập nhật...' : 'Cập nhật trạng thái'}
                                    </button>
                                </div>
                            </article>

                            <article className="card-box side-card">
                                <h3>Thông tin nghệ nhân</h3>
                                <p><FiUser /> <strong>{order?.artisanName || '—'}</strong></p>
                                <p><FiMail /> {order?.artisanEmail || '—'}</p>
                                <p><FiPhone /> {order?.artisanPhone || '—'}</p>
                            </article>

                            <article className="card-box side-card">
                                <h3>Doanh thu dự kiến</h3>
                                <p><span>Tổng đơn:</span> <strong>{formatCurrency(order?.totalPrice)}</strong></p>
                                <p><span>Đã thanh toán:</span> <strong>{order?.fullyPaid ? 'Có' : 'Chưa'}</strong></p>
                                <p><span>Hiện tại:</span> <strong>{formatCurrency(revenueCurrent)}</strong></p>
                                <p><span>Đã nhận:</span> <strong>{formatCurrency(completedRevenue)}</strong></p>
                                <p><span>Còn lại:</span> <strong>{formatCurrency(expectedRemain)}</strong></p>
                            </article>

                            <article className="card-box side-card">
                                <h3>Ghi chú nhanh</h3>
                                <p className="muted"><FiFileText /> Khi hoàn thành giai đoạn, vui lòng cập nhật ảnh minh chứng rõ ràng để khách hàng duyệt nhanh hơn.</p>
                            </article>
                        </aside>
                    </div>

                    {!isCancelledOrder && status !== 'COMPLETED' && (
                        <section className="danger-zone">
                            <div className="danger-copy">
                                <h3>Thao tác nguy hiểm</h3>
                                <p>Hủy đơn sẽ dừng toàn bộ quy trình của đơn tùy chỉnh này.</p>
                            </div>
                            <button type="button" className="btn btn-danger" onClick={openCancelModal} disabled={isCancelledOrder || cancelling}>
                                Hủy đơn
                            </button>
                        </section>
                    )}

                    {cancelModalOpen && (
                        <div className="cancel-modal-overlay" onClick={() => setCancelModalOpen(false)}>
                            <div className="cancel-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title" onClick={(e) => e.stopPropagation()}>
                                <h3 id="cancel-modal-title">Xác nhận hủy đơn</h3>
                                

                                <div className="detail-cancel-estimate">
                                    {cancelEstimateLoading ? (
                                        <div className="detail-empty-inline">Đang tính ước tính hoàn tiền...</div>
                                    ) : cancelEstimate ? (
                                        <>
                                            <div className="detail-cancel-estimate-grid">
                                                <div><span>Tổng số tiền hoàn lại: </span><strong>{formatCurrency(cancelEstimate.grossRefundAmount)}</strong></div>
                                                <div><span>Phí nền tảng: </span><strong>{formatCurrency(cancelEstimate.platformCommissionAmount ?? cancelEstimate.platformCommission)}</strong></div>
                                                <div><span>Hoàn thực nhận: </span><strong>{formatCurrency(cancelEstimate.netRefundAmount)}</strong></div>
                                            </div>
                                            {cancelEstimate.canCancel === false && <p className="detail-muted-text">Đơn hàng này hiện chưa thể hủy.</p>}
                                        </>
                                    ) : (
                                        <div className="detail-empty-inline">Không có dữ liệu hoàn tiền.</div>
                                    )}
                                </div>

                                <textarea
                                    rows="3"
                                    className="form-input"
                                    placeholder="Nhập lý do hủy đơn"
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                />
                                <div className="cancel-modal-actions">
                                    <button type="button" className="btn btn-outline" onClick={() => setCancelModalOpen(false)} disabled={cancelling}>Đóng</button>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={handleCancelOrder}
                                        disabled={!cancelReason.trim() || cancelling}
                                    >
                                        {cancelling ? 'Đang hủy...' : 'Hủy đơn'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {imagePreviewUrl && (
                        <div className="cancel-modal-overlay image-preview-overlay" onClick={closeImagePreview}>
                            <div className="image-preview-modal" role="dialog" aria-modal="true" aria-label="Xem ảnh hoàn thành" onClick={(e) => e.stopPropagation()}>
                                <button type="button" className="image-preview-close" onClick={closeImagePreview} aria-label="Đóng ảnh preview">×</button>
                                <img src={imagePreviewUrl} alt="preview" className="image-preview-full" />
                            </div>
                        </div>
                    )}

                    {shipmentFormOpen && (
                        <div className="cancel-modal-overlay" onClick={() => setShipmentFormOpen(false)}>
                            <div className="cancel-modal shipment-modal" role="dialog" aria-modal="true" aria-labelledby="shipment-modal-title" onClick={(e) => e.stopPropagation()}>
                                <div className="order-detail-modal-header">
                                    <div>
                                        <p className="page-kicker">Tạo vận đơn</p>
                                        <h3 id="shipment-modal-title">Điền thông tin giao hàng</h3>
                                    </div>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/artisan/shipments')} disabled={shippingSubmitting}>Đóng</button>
                                </div>
                                <p className="muted">Điền thông tin người nhận và thông số kiện hàng để gửi sang hệ thống vận chuyển. {profileLoading ? 'Đang tải profile khách hàng...' : ''}</p>
                                <div className="shipment-form-grid">
                                    <label className="shipment-field">
                                        <span>Tên người nhận</span>
                                        <input className="form-input" placeholder="Nhập tên người nhận" value={shipmentForm.recipientName} onChange={(e) => setShipmentForm((prev) => ({ ...prev, recipientName: e.target.value }))} />
                                    </label>
                                    <label className="shipment-field">
                                        <span>Số điện thoại</span>
                                        <input className="form-input" placeholder="Nhập số điện thoại" value={shipmentForm.recipientPhone} onChange={(e) => setShipmentForm((prev) => ({ ...prev, recipientPhone: e.target.value }))} />
                                    </label>
                                    <label className="shipment-field shipment-span-2">
                                        <span>Địa chỉ giao hàng</span>
                                        <input className="form-input" placeholder="Nhập địa chỉ giao hàng" value={shipmentForm.deliveryAddress} onChange={(e) => setShipmentForm((prev) => ({ ...prev, deliveryAddress: e.target.value }))} />
                                    </label>
                                    <label className="shipment-field">
                                        <span>Tỉnh / thành phố</span>
                                        <select
                                            className="form-input"
                                            value={shipmentForm.provinceCode}
                                            onChange={(e) => setShipmentForm((prev) => ({ ...prev, provinceCode: e.target.value }))}
                                            disabled={locationLoading.provinces}
                                        >
                                            <option value="">Chọn tỉnh/thành</option>
                                            {provinces.map((item) => (
                                                <option key={item.code} value={item.code}>{item.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="shipment-field">
                                        <span>Quận / huyện</span>
                                        <select
                                            className="form-input"
                                            value={shipmentForm.districtCode}
                                            onChange={(e) => setShipmentForm((prev) => ({ ...prev, districtCode: e.target.value }))}
                                            disabled={!shipmentForm.provinceCode || locationLoading.districts}
                                        >
                                            <option value="">Chọn quận/huyện</option>
                                            {districts.map((item) => (
                                                <option key={item.code} value={item.code}>{item.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="shipment-field">
                                        <span>Phường / xã</span>
                                        <select
                                            className="form-input"
                                            value={shipmentForm.wardCode}
                                            onChange={(e) => setShipmentForm((prev) => ({ ...prev, wardCode: e.target.value }))}
                                            disabled={!shipmentForm.districtCode || locationLoading.wards}
                                        >
                                            <option value="">Chọn phường/xã</option>
                                            {wards.map((item) => (
                                                <option key={item.code} value={item.code}>{item.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="shipment-field">
                                        <span>Giá trị đơn hàng</span>
                                        <input className="form-input" placeholder="Nhập giá trị đơn hàng" value={shipmentForm.orderValue} onChange={(e) => setShipmentForm((prev) => ({ ...prev, orderValue: e.target.value }))} />
                                    </label>
                                    <label className="shipment-field">
                                        <span>Cân nặng (gram)</span>
                                        <input className="form-input" placeholder="Nhập cân nặng" value={shipmentForm.weight} onChange={(e) => setShipmentForm((prev) => ({ ...prev, weight: e.target.value }))} />
                                    </label>
                                    <label className="shipment-field">
                                        <span>Dài (cm)</span>
                                        <input className="form-input" placeholder="Nhập chiều dài" value={shipmentForm.length} onChange={(e) => setShipmentForm((prev) => ({ ...prev, length: e.target.value }))} />
                                    </label>
                                    <label className="shipment-field">
                                        <span>Rộng (cm)</span>
                                        <input className="form-input" placeholder="Nhập chiều rộng" value={shipmentForm.width} onChange={(e) => setShipmentForm((prev) => ({ ...prev, width: e.target.value }))} />
                                    </label>
                                    <label className="shipment-field">
                                        <span>Cao (cm)</span>
                                        <input className="form-input" placeholder="Nhập chiều cao" value={shipmentForm.height} onChange={(e) => setShipmentForm((prev) => ({ ...prev, height: e.target.value }))} />
                                    </label>
                                    <label className="shipment-field shipment-span-2">
                                        <span>Ghi chú</span>
                                        <textarea className="form-input" rows="3" placeholder="Nhập ghi chú" value={shipmentForm.note} onChange={(e) => setShipmentForm((prev) => ({ ...prev, note: e.target.value }))} />
                                    </label>
                                </div>
                                <div className="cancel-modal-actions">
                                    <button type="button" className="btn btn-primary" onClick={() => navigate('/artisan/shipments')} disabled={shippingSubmitting}>
                                        Đi đến trang vận đơn
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ArtisanOrderDetailPage;