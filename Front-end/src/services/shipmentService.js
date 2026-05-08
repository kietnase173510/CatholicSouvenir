import api from '../cofig/api';


const normalizeResponse = (response) => {
    if (response?.data?.code != null) {
        return {
            code: response.data.code,
            message: response.data.message,
            data: response.data.data,
        };
    }

    return {
        code: 200,
        message: 'OK',
        data: response?.data,
    };
};

const isSuccessCode = (code) => code === 0 || code === 200 || code === 201;

const mapError = (error, fallback) => {
    const message =
        error?.response?.data?.message ??
        error?.response?.data?.error ??
        error?.message ??
        fallback;
    return typeof message === 'string' ? message : fallback;
};

const handleResponse = (response, fallback) => {
    const normalized = normalizeResponse(response);
    if (!isSuccessCode(normalized.code)) {
        return { success: false, error: normalized.message || fallback };
    }

    return {
        success: true,
        data: normalized.data ?? {},
        message: normalized.message || fallback,
    };
};

export const getShipmentProvinces = async () => {
    try {
        const response = await api.get('/shipments/address/provinces');
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được danh sách tỉnh/thành phố.', data: [] };
        }

        const list = Array.isArray(normalized.data) ? normalized.data : [];
        return { success: true, data: list };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được danh sách tỉnh/thành phố.'), data: [] };
    }
};

export const getShipmentDistricts = async (provinceId) => {
    if (!provinceId) return { success: true, data: [] };
    try {
        const response = await api.get('/shipments/address/districts', {
            params: { provinceId: Number(provinceId) },
        });
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được danh sách quận/huyện.', data: [] };
        }

        const list = Array.isArray(normalized.data) ? normalized.data : [];
        return { success: true, data: list };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được danh sách quận/huyện.'), data: [] };
    }
};

export const getShipmentWardOptions = async (districtId) => {
    if (!districtId) return { success: true, data: [] };
    try {
        const response = await api.get('/shipments/address/wards', {
            params: { districtId: Number(districtId) },
        });
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được danh sách phường/xã.', data: [] };
        }

        const list = Array.isArray(normalized.data) ? normalized.data : [];
        return { success: true, data: list };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được danh sách phường/xã.'), data: [] };
    }
};

export const createShipment = async (payload) => {
    try {
        const response = await api.post('/shipments', {
            customOrderId: payload.customOrderId ?? null,
            orderId: payload.orderId ?? null,
            recipientName: payload.recipientName || '',
            recipientPhone: payload.recipientPhone || '',
            deliveryAddress: payload.deliveryAddress || '',
            toDistrictId: Number(payload.toDistrictId || 0),
            toWardCode: payload.toWardCode || '',
            orderValue: Number(payload.orderValue || 0),
            weight: Number(payload.weight || 0),
            length: Number(payload.length || 0),
            width: Number(payload.width || 0),
            height: Number(payload.height || 0),
            note: payload.note || '',
            serviceTypeId: Number(payload.serviceTypeId || 0),
            paymentTypeId: Number(payload.paymentTypeId || 0),
        });

        return handleResponse(response, 'Tạo vận đơn thành công.');
    } catch (error) {
        return { success: false, error: mapError(error, 'Không thể tạo vận đơn. Vui lòng thử lại.') };
    }
};

export const cancelShipment = async (shipmentId) => {
    if (!shipmentId) return { success: false, error: 'Thiếu mã vận đơn.' };
    try {
        const response = await api.post(`/shipments/${shipmentId}/cancel`);
        return handleResponse(response, 'Huỷ vận đơn thành công.');
    } catch (error) {
        return { success: false, error: mapError(error, 'Không thể huỷ vận đơn. Vui lòng thử lại.') };
    }
};

export const webhookGhn = async (payload = {}) => {
    try {
        const response = await api.post('/webhook/ghn', payload);
        return handleResponse(response, 'Webhook GHN đã được gửi.');
    } catch (error) {
        return { success: false, error: mapError(error, 'Không thể gọi webhook GHN.') };
    }
};

export const updateDemoShipmentStatus = async (payload = {}) => {
    try {
        const response = await api.post('/shipments/demo/update-status', payload);
        return handleResponse(response, 'Cập nhật trạng thái demo thành công.');
    } catch (error) {
        return { success: false, error: mapError(error, 'Không thể cập nhật trạng thái demo.') };
    }
};

export const getShipmentByOrderId = async (orderId) => {
    if (!orderId) return { success: false, error: 'Thiếu mã đơn hàng.' };

    try {
        const response = await api.get(`/shipments/order/${orderId}`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được thông tin vận chuyển.' };
        }

        return { success: true, data: normalized.data || null };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được thông tin vận chuyển.') };
    }
};

export const getTrackingByNumber = async (trackingNumber) => {
    if (!trackingNumber) return { success: false, error: 'Thiếu mã vận đơn.', data: [] };

    try {
        const response = await api.get(`/shipments/track/${trackingNumber}`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được lịch sử tracking.', data: [] };
        }

        const raw = normalized.data;
        const list = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.history)
                ? raw.history
                : Array.isArray(raw?.events)
                    ? raw.events
                    : [];

        return { success: true, data: list };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được lịch sử tracking.'), data: [] };
    }
};

export const getDemoShipmentStatuses = async () => {
    try {
        const response = await api.get('/shipments/demo/statuses');
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được danh sách trạng thái.', data: [] };
        }

        const list = Array.isArray(normalized.data)
            ? normalized.data
            : Array.isArray(normalized.data?.statuses)
                ? normalized.data.statuses
                : [];

        return { success: true, data: list };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được danh sách trạng thái.'), data: [] };
    }
};

export const getShipmentTimeline = async (shipmentId) => {
    if (!shipmentId) return { success: false, error: 'Thiếu shipmentId.', data: { timeline: [] } };

    try {
        const response = await api.get(`/shipments/${shipmentId}/timeline`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được timeline vận chuyển.', data: { timeline: [] } };
        }

        const timeline = Array.isArray(normalized.data)
            ? normalized.data
            : Array.isArray(normalized.data?.timeline)
                ? normalized.data.timeline
                : [];

        return {
            success: true,
            data: {
                ...(normalized.data && !Array.isArray(normalized.data) ? normalized.data : {}),
                timeline,
            },
        };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được timeline vận chuyển.'), data: { timeline: [] } };
    }
};

export default {
    createShipment,
    cancelShipment,
    webhookGhn,
    updateDemoShipmentStatus,
    getShipmentByOrderId,
    getTrackingByNumber,
    getDemoShipmentStatuses,
    getShipmentTimeline,
};
