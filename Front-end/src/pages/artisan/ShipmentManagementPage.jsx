import React, { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiExternalLink, FiPackage, FiTruck } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../../cofig/api';
import { appToast } from '../../lib/appToast';
import { getOrderById, getOrdersByArtisan } from '../../services/orderService';
import { getCustomerCustomOrders, getCustomOrderDetail } from '../../services/customRequestService';
import {
    cancelShipment,
    createShipment,
    getShipmentDistricts,
    getShipmentProvinces,
    getShipmentWardOptions,
    getShipmentByOrderId,
    webhookGhn,
} from '../../services/shipmentService';
import './ShipmentManagementPage.css';

const formatCurrency = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} đ`;
const formatInputMoney = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits ? new Intl.NumberFormat('vi-VN').format(Number(digits)) : '';
};
const parseInputMoney = (value) => String(value ?? '').replace(/\D/g, '');
const formatDateTime = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString('vi-VN');
    } catch {
        return value;
    }
};

const STATUS_LABELS = {
    CREATED: 'Đã tạo',
    PICKING: 'Đang lấy hàng',
    IN_TRANSIT: 'Đang vận chuyển',
    DELIVERED: 'Đã giao',
    CANCELLED: 'Đã huỷ',
};

const PAYMENT_LABELS = {
    VNPAY: 'VNPAY',
    COD: 'Thanh toán khi nhận hàng',
    BANK_TRANSFER: 'Chuyển khoản',
};

const mapProvinceItem = (item) => ({
    code: String(item?.provinceId ?? item?.ProvinceID ?? item?.id ?? ''),
    name: item?.provinceName || item?.ProvinceName || item?.Name || item?.name || '',
});

const mapDistrictItem = (item) => ({
    code: String(item?.districtId ?? item?.DistrictID ?? item?.id ?? ''),
    name: item?.districtName || item?.DistrictName || item?.Name || item?.name || '',
});

const mapWardItem = (item) => ({
    code: String(item?.wardCode ?? item?.WardCode ?? item?.id ?? ''),
    name: item?.wardName || item?.WardName || item?.Name || item?.name || '',
});

const normalizeProfileAddress = (profile) => ({
    fullName: profile?.fullName || '',
    phone: profile?.phone || '',
    address: profile?.address || '',
    city: profile?.city || '',
    district: profile?.district || '',
    ward: profile?.ward || '',
});

const getOrderAccountId = (order) =>
    String(
        order?.accountId ||
        order?.customerAccountId ||
        order?.buyerAccountId ||
        order?.customerId ||
        order?.userId ||
        order?.createdBy ||
        '',
    ).trim();

const defaultShipmentForm = {
    recipientName: '',
    recipientPhone: '',
    deliveryAddress: '',
    provinceCode: '',
    districtCode: '',
    wardCode: '',
    wardName: '',
    orderValue: '',
    weight: '1000',
    length: '20',
    width: '20',
    height: '20',
    note: '',
    serviceTypeId: '2',
    paymentTypeId: '1',
};

const ShipmentManagementPage = ({ user, embedded = false }) => {
    const navigate = useNavigate();
    const artisanId = user?.id || user?.artisanId || user?.artisanUuid;
    void embedded;

    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [customOrders, setCustomOrders] = useState([]);
    const [shipments, setShipments] = useState({});
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [orderTypeFilter, setOrderTypeFilter] = useState('ALL');
    const [orderSortDirection, setOrderSortDirection] = useState('DESC');
    const [actioningId, setActioningId] = useState('');
    const [shippingSubmitting, setShippingSubmitting] = useState(false);
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);
    const [locationLoading, setLocationLoading] = useState({ provinces: false, districts: false, wards: false });
    const [shipmentForm, setShipmentForm] = useState(defaultShipmentForm);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailOrder, setDetailOrder] = useState(null);
    const [detailError, setDetailError] = useState('');
    const [profileByAccountId, setProfileByAccountId] = useState({});
    const cityOptions = provinces;
    const availableDistricts = districts;
    const availableWards = wards;

    const loadShipments = async () => {
        if (!artisanId) return;
        setLoading(true);

        const [ordersRes, customOrdersRes] = await Promise.all([
            getOrdersByArtisan(artisanId),
            getCustomerCustomOrders({ status: 'COMPLETED', page: 0, size: 10 }),
        ]);

        if (!ordersRes.success) {
            appToast.error('Không tải được danh sách đơn', ordersRes.error || 'Vui lòng thử lại');
            setOrders([]);
        }

        if (!customOrdersRes.success) {
            appToast.error('Không tải được danh sách đơn custom', customOrdersRes.error || 'Vui lòng thử lại');
            setCustomOrders([]);
        }

        const ordersList = ordersRes.success
            ? (Array.isArray(ordersRes.data?.content)
                ? ordersRes.data.content
                : Array.isArray(ordersRes.data)
                    ? ordersRes.data
                    : [])
            : [];

        const customOrdersList = customOrdersRes.success
            ? (Array.isArray(customOrdersRes.data?.content)
                ? customOrdersRes.data.content
                : Array.isArray(customOrdersRes.data)
                    ? customOrdersRes.data
                    : [])
            : [];

        const paidOrders = ordersList.filter((order) => String(order?.status || '').toUpperCase() === 'PAID');
        const completedCustomOrders = customOrdersList.filter((order) => String(order?.status || '').toUpperCase() === 'COMPLETED');
        setOrders(paidOrders);
        setCustomOrders(completedCustomOrders);

        const pairs = await Promise.all(paidOrders.map(async (order) => {
            const orderId = order?.orderId || order?.id;
            if (!orderId) return [null, null];
            const res = await getShipmentByOrderId(orderId);
            return [orderId, res.success ? res.data : null];
        }));

        const nextMap = Object.fromEntries(pairs.filter(([key]) => Boolean(key)));
        setShipments(nextMap);
        setSelectedOrderId((current) => current || paidOrders[0]?.orderId || paidOrders[0]?.id || completedCustomOrders[0]?.customOrderId || completedCustomOrders[0]?.id || '');
        const accountIds = paidOrders.map((order) => getOrderAccountId(order) || String(order?.customerId || '').trim()).filter(Boolean);
        if (accountIds.length) {
            await loadProfilesByAccountIds(accountIds);
        }
        setLoading(false);
    };

    const loadProfilesByAccountIds = async (accountIds) => {
        const uniqueAccountIds = [...new Set((accountIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
        if (!uniqueAccountIds.length) return;

        const results = await Promise.all(uniqueAccountIds.map(async (accountId) => {
            try {
                const response = await api.get(`/profile/${accountId}`);
                const profile = response?.data?.data || response?.data || null;
                return [accountId, profile];
            } catch {
                return [accountId, null];
            }
        }));

        setProfileByAccountId((prev) => ({
            ...prev,
            ...Object.fromEntries(results.filter(([accountId, profile]) => accountId && profile)),
        }));
    };

    useEffect(() => { loadShipments(); }, [artisanId]);

    const shipmentCandidates = useMemo(() => {
        const toTimestamp = (order) => new Date(order?.createdAt || order?.createAt || order?.orderDate || order?.updateAt || 0).getTime();
        const mappedOrders = [
            ...orders.map((order) => ({ ...order, shipmentSource: 'PAID' })),
            ...customOrders.map((order) => ({ ...order, shipmentSource: 'CUSTOM', orderId: order?.customOrderId || order?.id })),
        ];

        const filteredOrders = mappedOrders.filter((order) => {
            const source = String(order?.shipmentSource || '').toUpperCase();
            if (orderTypeFilter === 'PAID') return source === 'PAID';
            if (orderTypeFilter === 'CUSTOM') return source === 'CUSTOM';
            return true;
        });

        return filteredOrders.sort((a, b) => {
            const aTime = toTimestamp(a);
            const bTime = toTimestamp(b);
            return orderSortDirection === 'ASC' ? aTime - bTime : bTime - aTime;
        });
    }, [orders, customOrders, orderTypeFilter, orderSortDirection]);

    const selectedOrder = useMemo(() => shipmentCandidates.find((order) => String(order?.orderId || order?.id || order?.customOrderId) === String(selectedOrderId)) || null, [shipmentCandidates, selectedOrderId]);
    const selectedShipment = selectedOrder ? shipments[selectedOrder.orderId || selectedOrder.id] : null;
    const selectedProfile = selectedOrder ? profileByAccountId[String(selectedOrder.customerId || selectedOrder.accountId || selectedOrder.customerAccountId || selectedOrder.buyerAccountId || '')] || null : null;
    const selectedProfileKey = String(selectedOrder?.customerId || selectedOrder?.accountId || selectedOrder?.customerAccountId || selectedOrder?.buyerAccountId || '').trim();

    useEffect(() => {
        if (!selectedOrder || !selectedProfileKey) return;
        if (profileByAccountId[selectedProfileKey]) return;

        let cancelled = false;

        const loadSelectedProfile = async () => {
            try {
                const response = await api.get(`/profile/${selectedProfileKey}`);
                const profile = response?.data?.data || response?.data || null;
                if (cancelled || !profile) return;
                setProfileByAccountId((prev) => ({
                    ...prev,
                    [selectedProfileKey]: profile,
                }));
            } catch {
                // bỏ qua để không làm gián đoạn chọn đơn
            }
        };

        loadSelectedProfile();

        return () => {
            cancelled = true;
        };
    }, [selectedOrder, selectedProfileKey, profileByAccountId]);

    useEffect(() => {
        if (!selectedOrder) return;
        console.log('selectedOrder fields for shipment', {
            orderId: selectedOrder.orderId || selectedOrder.id,
            customerId: selectedOrder.customerId,
            fullName: selectedOrder.fullName,
            phoneNumber: selectedOrder.phoneNumber,
            shippingAddress: selectedOrder.shippingAddress,
            address: selectedOrder.address,
            city: selectedOrder.city,
            district: selectedOrder.district,
            ward: selectedOrder.ward,
            status: selectedOrder.status,
            total: selectedOrder.total,
            paymentMethod: selectedOrder.paymentMethod,
            createAt: selectedOrder.createAt,
            updateAt: selectedOrder.updateAt,
        });
    }, [selectedOrder]);

    const resolveProfileLocation = (profile) => {
        const cityName = String(profile?.city || '').trim();
        const districtName = String(profile?.district || '').trim();
        const wardName = String(profile?.ward || '').trim();

        const matchedProvince = provinces.find((item) => item.name.toLowerCase() === cityName.toLowerCase());
        const matchedDistrict = districts.find((item) => item.name.toLowerCase() === districtName.toLowerCase());
        const matchedWard = wards.find((item) => item.name.toLowerCase() === wardName.toLowerCase());

        return {
            provinceCode: matchedProvince?.code || '',
            districtCode: matchedDistrict?.code || '',
            wardCode: matchedWard?.code || '',
            provinceName: matchedProvince?.name || cityName,
            districtName: matchedDistrict?.name || districtName,
            wardName: matchedWard?.name || wardName,
        };
    };

    const isShipmentLocked = Boolean(selectedShipment?.shipmentId || selectedShipment?.id || selectedShipment?.trackingNumber || selectedShipment?.code);

    useEffect(() => {
        if (!selectedOrder) return;
        const profile = selectedProfile;
        const normalizedProfile = normalizeProfileAddress(profile);
        const location = resolveProfileLocation(profile);
        setShipmentForm((prev) => ({
            ...defaultShipmentForm,
            recipientName: normalizedProfile.fullName || selectedOrder.fullName || selectedOrder.customerName || '',
            recipientPhone: normalizedProfile.phone || selectedOrder.phoneNumber || selectedOrder.customerPhone || '',
            deliveryAddress: normalizedProfile.address || selectedOrder.shippingAddress || selectedOrder.address || '',
            provinceCode: location.provinceCode,
            districtCode: location.districtCode,
            districtName: location.districtName,
            wardCode: location.wardCode,
            wardName: location.wardName,
            orderValue: String(selectedOrder.total ?? selectedOrder.totalPrice ?? 0),
        }));
    }, [selectedOrderId, selectedOrder, selectedProfile, provinces, districts, wards]);

    useEffect(() => {
        const loadProvinces = async () => {
            setLocationLoading((prev) => ({ ...prev, provinces: true }));
            const res = await getShipmentProvinces();
            if (res.success) {
                setProvinces((Array.isArray(res.data) ? res.data : []).map(mapProvinceItem));
            } else {
                setProvinces([]);
                appToast.error('Không tải được danh sách tỉnh/thành', res.error || 'Vui lòng thử lại');
            }
            setLocationLoading((prev) => ({ ...prev, provinces: false }));
        };

        loadProvinces();
    }, []);

    useEffect(() => {
        const loadDistricts = async () => {
            if (!shipmentForm.provinceCode) {
                setDistricts([]);
                setWards([]);
                setShipmentForm((prev) => ({ ...prev, districtCode: '', districtName: '', wardCode: '', wardName: '' }));
                return;
            }
            setLocationLoading((prev) => ({ ...prev, districts: true }));
            const res = await getShipmentDistricts(shipmentForm.provinceCode);
            if (res.success) {
                const mappedDistricts = (Array.isArray(res.data) ? res.data : []).map(mapDistrictItem);
                setDistricts(mappedDistricts);
                setWards([]);
                setShipmentForm((prev) => {
                    const matched = mappedDistricts.find((item) => item.code === prev.districtCode || item.name.toLowerCase() === String(prev.districtName || '').toLowerCase());
                    return {
                        ...prev,
                        districtCode: matched?.code || prev.districtCode || '',
                        districtName: matched?.name || prev.districtName || '',
                        wardCode: '',
                        wardName: '',
                    };
                });
            } else {
                setDistricts([]);
                setWards([]);
                appToast.error('Không tải được danh sách quận/huyện', res.error || 'Vui lòng thử lại');
            }
            setLocationLoading((prev) => ({ ...prev, districts: false }));
        };
        loadDistricts();
    }, [shipmentForm.provinceCode]);

    useEffect(() => {
        const loadWards = async () => {
            if (!shipmentForm.districtCode) {
                setWards([]);
                setShipmentForm((prev) => ({ ...prev, wardCode: '', wardName: '' }));
                return;
            }
            setLocationLoading((prev) => ({ ...prev, wards: true }));
            const res = await getShipmentWardOptions(shipmentForm.districtCode);
            if (res.success) {
                const mappedWards = (Array.isArray(res.data) ? res.data : []).map(mapWardItem);
                setWards(mappedWards);
                setShipmentForm((prev) => {
                    const matched = mappedWards.find((item) => item.code === prev.wardCode || item.name.toLowerCase() === String(prev.wardName || '').toLowerCase());
                    return {
                        ...prev,
                        wardCode: matched?.code || '',
                        wardName: matched?.name || prev.wardName || '',
                    };
                });
            } else {
                setWards([]);
                appToast.error('Không tải được danh sách phường/xã', res.error || 'Vui lòng thử lại');
            }
            setLocationLoading((prev) => ({ ...prev, wards: false }));
        };
        loadWards();
    }, [shipmentForm.districtCode]);

    const openShipmentForm = () => {
        setShipmentFormOpen(true);
        const profile = selectedProfile;
        const normalizedProfile = normalizeProfileAddress(profile);
        const location = resolveProfileLocation(profile);
        setShipmentForm({
            ...defaultShipmentForm,
            recipientName: normalizedProfile.fullName || selectedOrder?.fullName || selectedOrder?.customerName || '',
            recipientPhone: normalizedProfile.phone || selectedOrder?.phoneNumber || selectedOrder?.customerPhone || '',
            deliveryAddress: normalizedProfile.address || selectedOrder?.shippingAddress || selectedOrder?.address || '',
            provinceCode: location.provinceCode,
            districtCode: location.districtCode,
            districtName: location.districtName,
            wardCode: location.wardCode,
            wardName: location.wardName,
            orderValue: String(selectedOrder?.total ?? selectedOrder?.totalPrice ?? 0),
        });
    };

    const resetShipmentForm = () => {
        setShipmentForm(defaultShipmentForm);
    };

    const handleCreateShipment = async () => {
        if (!selectedOrder?.orderId || shippingSubmitting || isShipmentLocked) return;
        if (!shipmentForm.recipientName.trim() || !shipmentForm.recipientPhone.trim() || !shipmentForm.deliveryAddress.trim()) {
            appToast.error('Thiếu thông tin giao hàng', 'Vui lòng nhập đầy đủ người nhận, số điện thoại và địa chỉ.');
            return;
        }

        const resolvedDistrictId = Number(shipmentForm.districtCode || 0);
        const resolvedWardCode = String(shipmentForm.wardCode || '').trim();

        if (!resolvedDistrictId || !resolvedWardCode) {
            appToast.error('Thiếu khu vực giao hàng', 'Vui lòng chọn đúng quận/huyện và phường/xã từ profile hoặc danh sách.');
            return;
        }

        setShippingSubmitting(true);
        const res = await createShipment({
            orderId: selectedOrder.orderId,
            customOrderId: selectedOrder?.customOrderId || selectedOrder?.id || undefined,
            recipientName: shipmentForm.recipientName.trim(),
            recipientPhone: shipmentForm.recipientPhone.trim(),
            deliveryAddress: shipmentForm.deliveryAddress.trim(),
            toDistrictId: resolvedDistrictId,
            toWardCode: resolvedWardCode,
            orderValue: parseInputMoney(shipmentForm.orderValue) || selectedOrder?.total || selectedOrder?.totalPrice || 0,
            weight: shipmentForm.weight,
            length: shipmentForm.length,
            width: shipmentForm.width,
            height: shipmentForm.height,
            note: shipmentForm.note.trim(),
            serviceTypeId: Number(shipmentForm.serviceTypeId || 0),
            paymentTypeId: Number(shipmentForm.paymentTypeId || 0),
        });
        setShippingSubmitting(false);

        if (!res.success) {
            appToast.error('Tạo vận đơn thất bại', res.error || 'Vui lòng thử lại');
            return;
        }

        setShipmentFormOpen(false);
        resetShipmentForm();
        appToast.success('Đã tạo vận đơn thành công');
        await loadShipments();
    };

    const handleOpenOrderDetail = async (order) => {
        const orderId = order?.orderId || order?.id || order?.customOrderId;
        if (!orderId) return;

        setDetailModalOpen(true);
        setDetailLoading(true);
        setDetailError('');
        setDetailOrder(null);

        const isCustomOrder = String(order?.shipmentSource || '').toUpperCase() === 'CUSTOM';
        const res = isCustomOrder ? await getCustomOrderDetail(orderId) : await getOrderById(orderId);
        if (!res.success) {
            setDetailError(res.error || 'Không tải được thông tin đơn hàng.');
            setDetailLoading(false);
            return;
        }

        setDetailOrder(res.data);
        setDetailLoading(false);
    };

    const handleCloseOrderDetail = () => {
        setDetailModalOpen(false);
        setDetailLoading(false);
        setDetailOrder(null);
        setDetailError('');
    };

    const handleRefreshGhn = async () => {
        setRefreshing(true);
        const res = await webhookGhn({ source: 'artisan-dashboard' });
        setRefreshing(false);
        if (!res.success) {
            appToast.error('Gọi webhook GHN thất bại', res.error || 'Vui lòng thử lại');
            return;
        }
        appToast.success('Đã gửi webhook GHN');
    };

    const handleCancel = async () => {
        if (!selectedShipment?.shipmentId && !selectedShipment?.id) return;
        setActioningId(String(selectedShipment.shipmentId || selectedShipment.id));
        const res = await cancelShipment(selectedShipment.shipmentId || selectedShipment.id);
        setActioningId('');
        if (!res.success) {
            appToast.error('Huỷ vận đơn thất bại', res.error || 'Vui lòng thử lại');
            return;
        }
        appToast.success('Đã huỷ vận đơn');
        await loadShipments();
    };

    const orderDetail = detailOrder;
    const content = (
        <div className="artisan-shipment-page">
            <header className="shipment-page-header">
                <div>
                    <p className="page-kicker">Quản lý vận đơn</p>
                    <h1>Vận đơn của artisan</h1>
                    <p className="page-subtitle">Theo dõi các đơn đã sẵn sàng giao, tạo vận đơn và thao tác nhanh với GHN.</p>
                </div>
                <div className="shipment-header-actions">
                    <button type="button" className="btn btn-primary" onClick={() => navigate('/artisan/orders')}>
                        <FiPackage /> Xem đơn custom
                    </button>
                </div>
            </header>

            <section className="shipment-summary-grid">
                <article className="shipment-summary-card"><FiTruck /><div><span>Đơn chờ tạo</span><strong>{shipmentCandidates.filter((order) => !shipments[order.orderId || order.id]).length}</strong></div></article>
                <article className="shipment-summary-card"><FiCheckCircle /><div><span>Đã có vận đơn</span><strong>{Object.values(shipments).filter(Boolean).length}</strong></div></article>
                <article className="shipment-summary-card"><FiAlertCircle /><div><span>Cần kiểm tra</span><strong>{shipmentCandidates.length}</strong></div></article>
            </section>

            <section className="shipment-layout">
                <div className="shipment-list-panel">
                    <div className="shipment-panel-head shipment-panel-head--stacked">
                        <div className="shipment-panel-heading">
                            <h3>Danh sách đơn có thể tạo vận đơn</h3>
                            <p className="shipment-panel-description">Lọc nhanh theo đơn thường hoặc đơn custom đã hoàn thành, đồng thời sắp xếp theo thời gian tạo.</p>
                        </div>
                        <div className="shipment-filter-row">
                            <label className="shipment-filter-field">
                                <span>Loại đơn</span>
                                <select className="form-input" value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)}>
                                    <option value="ALL">Tất cả</option>
                                    <option value="PAID">Đơn thường</option>
                                    <option value="CUSTOM">Đơn custom hoàn thành</option>
                                </select>
                            </label>
                            <label className="shipment-filter-field">
                                <span>Sắp xếp</span>
                                <select className="form-input" value={orderSortDirection} onChange={(e) => setOrderSortDirection(e.target.value)}>
                                    <option value="DESC">Mới nhất trước</option>
                                    <option value="ASC">Cũ nhất trước</option>
                                </select>
                            </label>
                        </div>
                    </div>
                    {loading ? (
                        <p className="shipment-empty">Đang tải...</p>
                    ) : shipmentCandidates.length === 0 ? (
                        <p className="shipment-empty">Hiện chưa có đơn nào có thể tạo vận đơn.</p>
                    ) : (
                        <div className="shipment-list">
                            {shipmentCandidates.map((order) => {
                                const orderId = order?.orderId || order?.id || order?.customOrderId;
                                const shipment = shipments[orderId];
                                const displayLabel = String(order?.shipmentSource || '').toUpperCase() === 'CUSTOM' ? 'Đơn custom hoàn thành' : 'Đơn thường';
                                return (
                                    <button
                                        key={orderId}
                                        type="button"
                                        className={`shipment-list-item ${String(selectedOrderId) === String(orderId) ? 'active' : ''}`}
                                        onClick={() => setSelectedOrderId(String(orderId))}
                                    >
                                        <div className="shipment-item-top">
                                            <strong>#{String(orderId).slice(0, 8)}</strong>
                                            <span>{shipment ? 'Đã tạo' : 'Chưa tạo'}</span>
                                        </div>
                                        <p>{order?.fullName || order?.customerName || 'Khách hàng'} · {displayLabel}</p>
                                        <small>{formatDateTime(order?.createdAt || order?.createAt)}</small>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="shipment-detail-panel">
                    {!selectedOrder ? (
                        <div className="shipment-empty shipment-detail-empty">Chọn một đơn để xem chi tiết vận đơn.</div>
                    ) : (
                        <>
                            <div className="shipment-detail-head">
                                <div>
                                    <p className="page-kicker">Đơn hàng đã chọn</p>
                                    <h3>#{String(selectedOrder.orderId || selectedOrder.id).slice(0, 8)}</h3>
                                </div>
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleOpenOrderDetail(selectedOrder)}>
                                    <FiExternalLink /> Chi tiết đơn
                                </button>
                            </div>

                            <div className="shipment-info-card">
                                <p><span>Khách hàng</span><strong>{selectedProfile?.fullName || selectedOrder.fullName || selectedOrder.customerName || '—'}</strong></p>
                                <p><span>Điện thoại</span><strong>{selectedProfile?.phone || selectedOrder.phoneNumber || selectedOrder.phone || selectedOrder.customerPhone || '—'}</strong></p>
                                <p><span>Địa chỉ</span><strong>{selectedProfile?.address || selectedOrder.shippingAddress || selectedOrder.address || '—'}</strong></p>
                                <p><span>Vận đơn</span><strong>{selectedShipment?.trackingNumber || selectedShipment?.code || 'Chưa có'}</strong></p>
                                <p><span>Trạng thái</span><strong>{STATUS_LABELS[String(selectedShipment?.status || selectedShipment?.shipmentStatus || '').toUpperCase()] || String(selectedShipment?.status || selectedShipment?.shipmentStatus || '—')}</strong></p>
                            </div>

                            <div className={`shipment-form-card ${isShipmentLocked ? 'shipment-form-card-locked' : ''}`}>
                                <div className="shipment-form-title-row">
                                    <h3>Tạo vận đơn</h3>
                                </div>
                                <p className="muted">Điền thông tin người nhận và thông số kiện hàng để gửi sang hệ thống vận chuyển.</p>
                                <div className="shipment-form-grid">
                                    {!locationLoading.provinces && provinces.length === 0 && (
                                        <div className="shipment-hint shipment-span-2">Chưa tải được danh sách tỉnh/thành. Kiểm tra lại API `GET /api/shipments/address/provinces`.</div>
                                    )}
                                    <label className="shipment-field">
                                        <span>Tên người nhận</span>
                                        <input className="form-input" placeholder="Nhập tên người nhận" value={shipmentForm.recipientName} onChange={(e) => setShipmentForm((prev) => ({ ...prev, recipientName: e.target.value }))} readOnly={isShipmentLocked} disabled={isShipmentLocked} />
                                    </label>
                                    <label className="shipment-field">
                                        <span>Số điện thoại</span>
                                        <input className="form-input" placeholder="Nhập số điện thoại" value={shipmentForm.recipientPhone} onChange={(e) => setShipmentForm((prev) => ({ ...prev, recipientPhone: e.target.value }))} readOnly={isShipmentLocked} disabled={isShipmentLocked} />
                                    </label>
                                    <label className="shipment-field shipment-span-2">
                                        <span>Địa chỉ giao hàng</span>
                                        <input className="form-input" placeholder="Nhập địa chỉ giao hàng" value={shipmentForm.deliveryAddress} onChange={(e) => setShipmentForm((prev) => ({ ...prev, deliveryAddress: e.target.value }))} readOnly={isShipmentLocked} disabled={isShipmentLocked} />
                                    </label>
                                    <label className="shipment-field">
                                        <span>Tỉnh / thành phố</span>
                                        <select className="form-input" value={shipmentForm.provinceCode} onChange={(e) => setShipmentForm((prev) => ({ ...prev, provinceCode: e.target.value }))} disabled={locationLoading.provinces || isShipmentLocked}>
                                            <option value="">Chọn tỉnh/thành</option>
                                            {cityOptions.map((item) => (
                                                <option key={item.code} value={item.code}>{item.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="shipment-field">
                                        <span>Quận / huyện</span>
                                        <select className="form-input" value={shipmentForm.districtCode} onChange={(e) => setShipmentForm((prev) => {
                                            const selectedDistrict = availableDistricts.find((item) => item.code === e.target.value);
                                            return { ...prev, districtCode: e.target.value, districtName: selectedDistrict?.name || '', wardCode: '', wardName: '' };
                                        })} disabled={!shipmentForm.provinceCode || locationLoading.districts || isShipmentLocked}>
                                            <option value="">Chọn quận/huyện</option>
                                            {availableDistricts.map((item) => (
                                                <option key={item.code} value={item.code}>{item.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="shipment-field">
                                        <span>Phường / xã</span>
                                        <select className="form-input" value={shipmentForm.wardCode} onChange={(e) => setShipmentForm((prev) => {
                                            const selectedWard = availableWards.find((item) => item.code === e.target.value);
                                            return { ...prev, wardCode: e.target.value, wardName: selectedWard?.name || '' };
                                        })} disabled={!shipmentForm.districtCode || locationLoading.wards || isShipmentLocked}>
                                            <option value="">Chọn phường/xã</option>
                                            {availableWards.map((item) => (
                                                <option key={item.code} value={item.code}>{item.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="shipment-field">
                                        <span>Giá trị đơn hàng</span>
                                        <input
                                            className="form-input"
                                            placeholder="Nhập giá trị đơn hàng"
                                            value={shipmentForm.orderValue ? `${formatInputMoney(shipmentForm.orderValue)} đ` : ''}
                                            onChange={(e) => setShipmentForm((prev) => ({ ...prev, orderValue: parseInputMoney(e.target.value) }))}
                                            readOnly={isShipmentLocked}
                                            disabled={isShipmentLocked}
                                        />
                                    </label>
                                    <label className="shipment-field">
                                        <span>Cân nặng (gram)</span>
                                        <input className="form-input" placeholder="Nhập cân nặng" value={shipmentForm.weight} onChange={(e) => setShipmentForm((prev) => ({ ...prev, weight: e.target.value }))} readOnly={isShipmentLocked} disabled={isShipmentLocked} />
                                    </label>
                                    <label className="shipment-field">
                                        <span>Dài (cm)</span>
                                        <input className="form-input" placeholder="Nhập chiều dài" value={shipmentForm.length} onChange={(e) => setShipmentForm((prev) => ({ ...prev, length: e.target.value }))} readOnly={isShipmentLocked} disabled={isShipmentLocked} />
                                    </label>
                                    <label className="shipment-field">
                                        <span>Rộng (cm)</span>
                                        <input className="form-input" placeholder="Nhập chiều rộng" value={shipmentForm.width} onChange={(e) => setShipmentForm((prev) => ({ ...prev, width: e.target.value }))} readOnly={isShipmentLocked} disabled={isShipmentLocked} />
                                    </label>
                                    <label className="shipment-field">
                                        <span>Cao (cm)</span>
                                        <input className="form-input" placeholder="Nhập chiều cao" value={shipmentForm.height} onChange={(e) => setShipmentForm((prev) => ({ ...prev, height: e.target.value }))} readOnly={isShipmentLocked} disabled={isShipmentLocked} />
                                    </label>
                                    <label className="shipment-field shipment-span-2">
                                        <span>Ghi chú</span>
                                        <textarea className="form-input" rows="3" placeholder="Nhập ghi chú" value={shipmentForm.note} onChange={(e) => setShipmentForm((prev) => ({ ...prev, note: e.target.value }))} readOnly={isShipmentLocked} disabled={isShipmentLocked} />
                                    </label>
                                </div>
                                <div className="shipment-actions shipment-actions-right">
                                    <button type="button" className="btn btn-primary" onClick={handleCreateShipment} disabled={shippingSubmitting || isShipmentLocked}>
                                        {shippingSubmitting ? 'Đang tạo...' : 'Tạo vận đơn'}
                                    </button>
                                    <button type="button" className="btn btn-danger" onClick={handleCancel} disabled={actioningId !== '' || !selectedShipment}>
                                        {actioningId ? 'Đang xử lý...' : 'Huỷ vận đơn'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </section>
        </div>
    );

    const orderDetailsTotal = Array.isArray(orderDetail?.orderDetails) ? orderDetail.orderDetails.reduce((sum, item) => sum + Number(item?.subTotal || 0), 0) : 0;

    return (
        <>
            {content}

            <div className={`order-detail-side-panel ${detailModalOpen ? 'open' : ''}`} aria-hidden={!detailModalOpen}>
                <div className="order-detail-side-panel-header">
                    <div>
                        <p className="page-kicker">Chi tiết đơn hàng</p>
                        <h3 id="order-detail-title">{orderDetail?.orderId ? `#${String(orderDetail.orderId).slice(0, 8)}` : 'Đang tải...'}</h3>
                    </div>
                    <button type="button" className="btn btn-outline btn-sm" onClick={handleCloseOrderDetail}>Đóng</button>
                </div>

                {detailLoading ? (
                    <div className="order-detail-side-panel-body"><p className="shipment-empty">Đang tải thông tin đơn hàng...</p></div>
                ) : detailError ? (
                    <div className="order-detail-side-panel-body"><p className="shipment-empty">{detailError}</p></div>
                ) : orderDetail ? (
                    <div className="order-detail-side-panel-body">
                        <section className="order-detail-section">
                            <h4>Thông tin chung</h4>
                            <div className="order-detail-grid order-detail-grid-2">
                                <div className="order-detail-item"><span>Mã đơn</span><strong>{orderDetail.orderId || '—'}</strong></div>
                                <div className="order-detail-item"><span>Khách hàng</span><strong>{orderDetail.fullName || '—'}</strong></div>
                                <div className="order-detail-item"><span>Trạng thái</span><strong>{STATUS_LABELS[String(orderDetail.status || '').toUpperCase()] || orderDetail.status || '—'}</strong></div>
                                <div className="order-detail-item"><span>Thanh toán</span><strong>{PAYMENT_LABELS[String(orderDetail.paymentMethod || '').toUpperCase()] || orderDetail.paymentMethod || '—'}</strong></div>
                                <div className="order-detail-item"><span>Ngày tạo</span><strong>{formatDateTime(orderDetail.orderDate || orderDetail.createAt)}</strong></div>
                                <div className="order-detail-item"><span>Cập nhật</span><strong>{formatDateTime(orderDetail.updateAt)}</strong></div>
                            </div>
                        </section>

                        <section className="order-detail-section">
                            <h4>Thanh toán</h4>
                            <div className="order-detail-grid order-detail-grid-3">
                                <div className="order-detail-item"><span>Tổng tiền</span><strong>{formatCurrency(orderDetail.total)}</strong></div>
                                <div className="order-detail-item"><span>Tổng tính lại</span><strong>{formatCurrency(orderDetailsTotal)}</strong></div>
                                <div className="order-detail-item"><span>Khách hàng ID</span><strong>{orderDetail.customerId || '—'}</strong></div>
                            </div>
                        </section>

                        <section className="order-detail-section">
                            <h4>Sản phẩm trong đơn</h4>
                            {Array.isArray(orderDetail.orderDetails) && orderDetail.orderDetails.length > 0 ? (
                                <div className="order-detail-items-list">
                                    {orderDetail.orderDetails.map((item) => (
                                        <article key={item.id} className="order-detail-product-card">
                                            <img src={item.image || '/logo.png'} alt={item.productName || 'Sản phẩm'} />
                                            <div>
                                                <strong>{item.productName || '—'}</strong>
                                                <p>Số lượng: {item.quantity || 0}</p>
                                                <p>Đơn giá: {formatCurrency(item.unitPrice)}</p>
                                                <p>Giảm giá: {formatCurrency(item.discount)}</p>
                                                <p>Tạm tính: {formatCurrency(item.subTotal)}</p>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <p className="shipment-empty">Không có sản phẩm chi tiết.</p>
                            )}
                        </section>

                        <section className="order-detail-section">
                            <h4>Template details</h4>
                            {Array.isArray(orderDetail.templateDetails) && orderDetail.templateDetails.length > 0 ? (
                                <pre className="order-detail-json">{JSON.stringify(orderDetail.templateDetails, null, 2)}</pre>
                            ) : (
                                <p className="shipment-empty">Không có template details.</p>
                            )}
                        </section>
                    </div>
                ) : null}
            </div>
        </>
    );
};

export default ShipmentManagementPage;
