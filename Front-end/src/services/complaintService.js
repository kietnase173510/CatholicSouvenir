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
    const message = error?.response?.data?.message ?? error?.response?.data?.error ?? error?.message ?? fallback;
    return typeof message === 'string' ? message : fallback;
};

export const toArray = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.content)) return payload.content;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
};

export const getMyComplaints = async ({ page = 0, size = 10 } = {}) => {
    const endpointsToTry = ['/complaints', '/complaints/customer/my-complaints', '/complaints/my-complaints'];

    for (const endpoint of endpointsToTry) {
        try {
            const response = await api.get(endpoint, { params: { page, size } });
            const normalized = normalizeResponse(response);
            if (!isSuccessCode(normalized.code)) continue;
            const raw = normalized.data ?? {};
            return { success: true, data: { ...raw, content: toArray(raw) } };
        } catch (error) {
            if (endpoint !== endpointsToTry[endpointsToTry.length - 1]) continue;
            return {
                success: false,
                error: mapError(error, 'Không tải được lịch sử khiếu nại. Vui lòng thử lại.'),
                data: { content: [], totalElements: 0, totalPages: 0, number: page, size },
            };
        }
    }

    return { success: false, error: 'Không tải được lịch sử khiếu nại.', data: { content: [], totalElements: 0, totalPages: 0, number: page, size } };
};

export const getComplaintDetail = async (complaintId) => {
    if (!complaintId) return { success: false, error: 'Thiếu mã khiếu nại.' };

    const endpointsToTry = [`/complaints/${complaintId}`, `/complaints/detail/${complaintId}`, `/artisan/complaints/${complaintId}`];

    for (const endpoint of endpointsToTry) {
        try {
            const response = await api.get(endpoint);
            const normalized = normalizeResponse(response);
            if (!isSuccessCode(normalized.code)) continue;
            return { success: true, data: normalized.data ?? null };
        } catch (error) {
            if (endpoint !== endpointsToTry[endpointsToTry.length - 1]) continue;
            return { success: false, error: mapError(error, 'Không tải được chi tiết khiếu nại. Vui lòng thử lại.') };
        }
    }

    return { success: false, error: 'Không tải được chi tiết khiếu nại.' };
};

export const createComplaint = async (payload) => {
    try {
        const response = await api.post('/complaints', {
            orderId: payload.orderId,
            customOrderId: payload.customOrderId,
            productId: payload.productId,
            reason: payload.reason,
            evidenceImages: Array.isArray(payload.evidenceImages) ? payload.evidenceImages : [],
        });

        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) return { success: false, error: normalized.message || 'Gửi khiếu nại thất bại.' };
        return { success: true, data: normalized.data ?? {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Gửi khiếu nại thất bại. Vui lòng thử lại.') };
    }
};

export const getArtisanComplaints = async ({ page = 0, size = 10, sort } = {}) => {
    try {
        const params = { page, size };
        if (Array.isArray(sort)) params.sort = sort;
        else if (sort) params.sort = sort;
        const response = await api.get('/artisan/complaints', { params });
        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được danh sách khiếu nại.', data: { content: [], totalElements: 0, totalPages: 0, number: page, size } };
        }
        const raw = normalized.data ?? {};
        return { success: true, data: { ...raw, content: toArray(raw) } };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được danh sách khiếu nại. Vui lòng thử lại.'), data: { content: [], totalElements: 0, totalPages: 0, number: page, size } };
    }
};

export const getArtisanComplaintDetail = async (id) => {
    if (!id) return { success: false, error: 'Thiếu mã khiếu nại.' };
    try {
        const response = await api.get(`/artisan/complaints/${id}`);
        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được chi tiết khiếu nại artisan.' };
        }
        return { success: true, data: normalized.data ?? null };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được chi tiết khiếu nại artisan. Vui lòng thử lại.') };
    }
};

export const respondToComplaint = async (id, body) => {
    if (!id) return { success: false, error: 'Thiếu mã khiếu nại.' };
    try {
        const response = await api.post(`/artisan/complaints/${id}/respond`, {
            response: body?.response || '',
            requireReturn: Boolean(body?.requireReturn),
        });
        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) return { success: false, error: normalized.message || 'Phản hồi khiếu nại thất bại.' };
        return { success: true, data: normalized.data ?? {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Phản hồi khiếu nại thất bại. Vui lòng thử lại.') };
    }
};

export const confirmReturnShipment = async (id) => {
    if (!id) return { success: false, error: 'Thiếu mã vận đơn.' };
    try {
        const response = await api.post(`/artisan/complaints/return-shipments/${id}/confirm`);
        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) return { success: false, error: normalized.message || 'Xác nhận vận đơn thất bại.' };
        return { success: true, data: normalized.data ?? {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Xác nhận vận đơn thất bại. Vui lòng thử lại.') };
    }
};

export const getAdminComplaints = async ({ status, page = 0, size = 10 } = {}) => {
    try {
        const response = await api.get('/admin/complaints', { params: { status, page, size } });
        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) {
            return {
                success: false,
                error: normalized.message || 'Không tải được danh sách khiếu nại admin.',
                data: { content: [], totalElements: 0, totalPages: 0, number: page, size },
            };
        }

        const raw = normalized.data ?? {};
        return { success: true, data: { ...raw, content: toArray(raw) } };
    } catch (error) {
        return {
            success: false,
            error: mapError(error, 'Không tải được danh sách khiếu nại admin. Vui lòng thử lại.'),
            data: { content: [], totalElements: 0, totalPages: 0, number: page, size },
        };
    }
};

export const getAdminComplaintDetail = async (id) => {
    if (!id) return { success: false, error: 'Thiếu mã khiếu nại.' };
    try {
        const response = await api.get(`/admin/complaints/${id}`);
        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được chi tiết khiếu nại admin.' };
        }
        return { success: true, data: normalized.data ?? null };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được chi tiết khiếu nại admin. Vui lòng thử lại.') };
    }
};

export const getOrderById = async (orderId) => {
    if (!orderId) return { success: false, error: 'Thiếu mã đơn hàng.' };
    try {
        const response = await api.get(`/order/${orderId}`);
        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được thông tin đơn hàng.' };
        }
        return { success: true, data: normalized.data ?? null };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được thông tin đơn hàng. Vui lòng thử lại.') };
    }
};

export const getCommissionRate = async () => {
    try {
        const response = await api.get('/commission/rate');
        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được commission rate.' };
        }
        return { success: true, data: normalized.data ?? null };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được commission rate. Vui lòng thử lại.') };
    }
};

export const approveAdminComplaint = async (id, body) => {
    if (!id) return { success: false, error: 'Thiếu mã khiếu nại.' };
    try {
        const response = await api.post(`/admin/complaints/${id}/approve`, {
            refundAmount: Number(body?.refundAmount ?? 0),
            adminNote: body?.adminNote || '',
        });
        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Phê duyệt khiếu nại thất bại.' };
        }
        return { success: true, data: normalized.data ?? {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Phê duyệt khiếu nại thất bại. Vui lòng thử lại.') };
    }
};

export const rejectAdminComplaint = async (id, body) => {
    if (!id) return { success: false, error: 'Thiếu mã khiếu nại.' };
    try {
        const response = await api.post(`/admin/complaints/${id}/reject`, {
            rejectionReason: body?.rejectionReason || '',
        });
        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Từ chối khiếu nại thất bại.' };
        }
        return { success: true, data: normalized.data ?? {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Từ chối khiếu nại thất bại. Vui lòng thử lại.') };
    }
};

const REFUND_ERROR_MAP = {
    '05': 'Giao dịch đã được hoàn trước đó.',
    '06': 'Giao dịch hoàn tiền không hợp lệ.',
    '07': 'Giao dịch gốc không tồn tại.',
    '97': 'Hệ thống VNPay đang bận, vui lòng thử lại sau.',
};

export const mapRefundError = (code, fallback = 'Đã có lỗi xảy ra, vui lòng thử lại hoặc liên hệ hỗ trợ') => {
    const normalizedCode = String(code || '').trim();
    return REFUND_ERROR_MAP[normalizedCode] || fallback;
};

export const retryAdminRefundTransaction = async (id) => {
    if (!id) return { success: false, error: 'Thiếu mã giao dịch hoàn tiền.' };
    try {
        const response = await api.post(`/admin/complaints/refund-transactions/${id}/retry`);
        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Thử lại hoàn tiền thất bại.' };
        }
        return { success: true, data: normalized.data ?? {} };
    } catch (error) {
        const code = error?.response?.data?.errorCode || error?.response?.data?.code;
        return { success: false, error: mapRefundError(code, mapError(error, 'Đã có lỗi xảy ra, vui lòng thử lại hoặc liên hệ hỗ trợ')) };
    }
};

export const getAdminRefundTransactions = async ({ status, page = 0, size = 10 } = {}) => {
    try {
        const response = await api.get('/admin/complaints/refund-transactions', { params: { status, page, size } });
        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) {
            return {
                success: false,
                error: normalized.message || 'Không tải được danh sách hoàn tiền admin.',
                data: { content: [], totalElements: 0, totalPages: 0, number: page, size },
            };
        }
        const raw = normalized.data ?? {};
        return { success: true, data: { ...raw, content: toArray(raw) } };
    } catch (error) {
        return {
            success: false,
            error: mapError(error, 'Không tải được danh sách hoàn tiền admin. Vui lòng thử lại.'),
            data: { content: [], totalElements: 0, totalPages: 0, number: page, size },
        };
    }
};
export default {
    toArray,
    getMyComplaints,
    getComplaintDetail,
    createComplaint,
    getArtisanComplaints,
    getArtisanComplaintDetail,
    respondToComplaint,
    confirmReturnShipment,
    getAdminComplaints,
    getAdminComplaintDetail,
    getOrderById,
    getCommissionRate,
    approveAdminComplaint,
    rejectAdminComplaint,
    retryAdminRefundTransaction,
    getAdminRefundTransactions,
};
