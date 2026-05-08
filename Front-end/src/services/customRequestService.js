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

export const getUserProfileById = async (accountId) => {
    if (!accountId) return { success: false, error: 'Thiếu accountId.' };

    try {
        const response = await api.get(`/profile/${accountId}`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được thông tin khách hàng.' };
        }

        return { success: true, data: normalized.data ?? null };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được thông tin khách hàng. Vui lòng thử lại.') };
    }
};

const toArray = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.content)) return payload.content;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
};

export const getCustomerCustomRequests = async ({ page = 0, size = 10 } = {}) => {
    try {
        const response = await api.get('/custom-requests', { params: { page, size } });
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return {
                success: false,
                error: normalized.message || 'Không tải được danh sách yêu cầu.',
                data: { content: [], totalPages: 0, number: page, size },
            };
        }

        const raw = normalized.data ?? {};
        const content = toArray(raw);

        return {
            success: true,
            data: {
                ...raw,
                content,
                totalPages: Number(raw?.totalPages ?? 0),
                number: Number(raw?.number ?? page),
                size: Number(raw?.size ?? size),
                totalElements: Number(raw?.totalElements ?? content.length),
            },
        };
    } catch (error) {
        return {
            success: false,
            error: mapError(error, 'Không tải được danh sách yêu cầu.'),
            data: { content: [], totalPages: 0, number: page, size },
        };
    }
};

export const getCustomRequestDetail = async (requestId) => {
    if (!requestId) return { success: false, error: 'Thiếu mã yêu cầu.' };

    try {
        const response = await api.get(`/custom-requests/${requestId}`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được chi tiết yêu cầu.' };
        }

        return { success: true, data: normalized.data || null };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được chi tiết yêu cầu.') };
    }
};

export const createCustomRequestV2 = async (payload) => {
    try {
        const body = {
            title: String(payload?.title || '').trim(),
            description: String(payload?.description || '').trim(),
            minBudget: Number(payload?.minBudget || 0),
            maxBudget: Number(payload?.maxBudget || 0),
            referenceImages: Array.isArray(payload?.referenceImages) ? payload.referenceImages.filter(Boolean) : [],
            aiConceptImageUrl: String(payload?.aiConceptImageUrl || '').trim(),
            aiImagePrompt: String(payload?.aiImagePrompt || '').trim(),
        };

        const response = await api.post('/custom-requests', body);

        const normalized = normalizeResponse(response);
        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Tạo yêu cầu thất bại.' };
        }

        return { success: true, data: normalized.data || {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Tạo yêu cầu thất bại.') };
    }
};

export const updateCustomRequest = async (requestId, payload) => {
    if (!requestId) return { success: false, error: 'Thiếu mã yêu cầu.' };

    try {
        const body = {
            title: String(payload?.title || '').trim(),
            description: String(payload?.description || '').trim(),
            minBudget: Number(payload?.minBudget || 0),
            maxBudget: Number(payload?.maxBudget || 0),
            referenceImages: Array.isArray(payload?.referenceImages) ? payload.referenceImages.filter(Boolean) : [],
            aiConceptImageUrl: String(payload?.aiConceptImageUrl || '').trim(),
            aiImagePrompt: String(payload?.aiImagePrompt || '').trim(),
        };

        const response = await api.put(`/custom-requests/${requestId}`, body);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Cập nhật yêu cầu thất bại.' };
        }

        return { success: true, data: normalized.data || {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Cập nhật yêu cầu thất bại.') };
    }
};

export const publishCustomRequest = async (requestId) => {
    if (!requestId) return { success: false, error: 'Thiếu mã yêu cầu.' };

    try {
        const response = await api.post(`/custom-requests/${requestId}/publish`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Publish yêu cầu thất bại.' };
        }

        return { success: true, data: normalized.data || {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Publish yêu cầu thất bại.') };
    }
};

export const regenerateCustomRequestImage = async (requestId) => {
    if (!requestId) return { success: false, error: 'Thiếu mã yêu cầu.' };

    try {
        const response = await api.post(`/custom-requests/${requestId}/regenerate-image`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Tạo lại ảnh AI thất bại.' };
        }

        return { success: true, data: normalized.data ?? '' };
    } catch (error) {
        return { success: false, error: mapError(error, 'Tạo lại ảnh AI thất bại.') };
    }
};

export const selectCustomRequestArtisan = async (requestId, artisanId) => {
    if (!requestId) return { success: false, error: 'Thiếu mã yêu cầu.' };

    try {
        const response = await api.post(`/custom-requests/${requestId}/select-artisan`, {
            artisanId,
        });
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Chọn nghệ nhân thất bại.' };
        }

        return { success: true, data: normalized.data || {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Chọn nghệ nhân thất bại.') };
    }
};

export const getCustomOrderStages = async (orderId) => {
    if (!orderId) return { success: false, error: 'Thiếu mã custom order.', data: [] };

    try {
        const response = await api.get(`/custom-orders/${orderId}/stages`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được stages.', data: [] };
        }

        return { success: true, data: toArray(normalized.data) };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được stages.'), data: [] };
    }
};

export const getStageDetail = async (stageId) => {
    if (!stageId) return { success: false, error: 'Thiếu mã stage.' };

    try {
        const response = await api.get(`/stages/${stageId}`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được thông tin stage.' };
        }

        return { success: true, data: normalized.data || null };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được thông tin stage.') };
    }
};

export const getStageCanPay = async (stageId) => {
    if (!stageId) return { success: false, error: 'Thiếu mã stage.' };

    try {
        const response = await api.get(`/stages/${stageId}/can-pay`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không kiểm tra được quyền thanh toán.', data: false };
        }

        return { success: true, data: Boolean(normalized.data) };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không kiểm tra được quyền thanh toán.'), data: false };
    }
};

export const initiateStagePayment = async (stageId, body) => {
    if (!stageId) return { success: false, error: 'Thiếu mã stage.' };

    try {
        const response = await api.post(`/stage-payments/${stageId}/initiate`, body);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Khởi tạo thanh toán thất bại.' };
        }

        return { success: true, data: normalized.data || {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Khởi tạo thanh toán thất bại.') };
    }
};

export const uploadReferenceImage = async (file) => {
    if (!(file instanceof File)) {
        return { success: false, error: 'File không hợp lệ.' };
    }

    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
    const bucket = String(import.meta.env.VITE_SUPABASE_BUCKET || '').trim();

    if (!supabaseUrl || !supabaseKey || !bucket) {
        return {
            success: false,
            error: 'Thiếu cấu hình Supabase. Vui lòng kiểm tra VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY và VITE_SUPABASE_BUCKET.',
        };
    }

    try {
        const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
        const safeName = String(file.name || 'proof').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 48) || 'proof';
        const path = `stage-proofs/${Date.now()}-${safeName}.${ext}`;

        const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${supabaseKey}`,
                apikey: supabaseKey,
                'Content-Type': file.type || 'application/octet-stream',
                'x-upsert': 'true',
            },
            body: file,
        });

        if (!uploadResponse.ok) {
            const text = await uploadResponse.text();
            return {
                success: false,
                error: text || 'Upload ảnh lên Supabase thất bại.',
            };
        }

        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
        return { success: true, data: publicUrl };
    } catch (error) {
        return {
            success: false,
            error: mapError(error, 'Upload ảnh lên Supabase thất bại.'),
        };
    }
};

export const getArtisanCustomRequests = async ({ status = 'ARTISAN_SELECTED', page = 0, size = 10 } = {}) => {
    try {
        const normalizedStatus = String(status || '').trim().toUpperCase();
        const endpoint = normalizedStatus === 'OPEN' ? '/custom-requests/open' : '/custom-requests/artisan';
        const params = { page, size };

        if (normalizedStatus && normalizedStatus !== 'OPEN' && normalizedStatus !== 'ALL') {
            params.status = normalizedStatus;
        }

        const response = await api.get(endpoint, { params });
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return {
                success: false,
                error: normalized.message || 'Không tải được danh sách yêu cầu.',
                data: { content: [], totalPages: 0, number: page, size },
            };
        }

        const raw = normalized.data ?? {};
        const content = toArray(raw);

        return {
            success: true,
            data: {
                ...raw,
                content,
                totalPages: Number(raw?.totalPages ?? 0),
                number: Number(raw?.number ?? page),
                size: Number(raw?.size ?? size),
            },
        };
    } catch (error) {
        return {
            success: false,
            error: mapError(error, 'Không tải được danh sách yêu cầu.'),
            data: { content: [], totalPages: 0, number: page, size },
        };
    }
};

export const getOpenCustomRequests = async ({ page = 0, size = 10 } = {}) => {
    return getArtisanCustomRequests({ status: 'OPEN', page, size });
};

export const createCustomOrder = async (payload) => {
    try {
        const response = await api.post('/custom-orders', {
            requestId: payload?.requestId,
            totalPrice: Number(payload?.totalPrice || 0),
            stages: Array.isArray(payload?.stages)
                ? payload.stages.map((stage) => ({
                    name: String(stage?.name || '').trim(),
                    description: String(stage?.description || '').trim(),
                    paymentPercentage: Number(stage?.paymentPercentage || 0),
                    estimatedDays: Number(stage?.estimatedDays || 0),
                }))
                : [],
        });
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Tạo custom order thất bại.' };
        }

        return { success: true, data: normalized.data || {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Tạo custom order thất bại.') };
    }
};

export const getCustomerCustomOrders = async ({ status = '', page = 0, size = 10 } = {}) => {
    try {
        const params = { page, size };

        if (String(status || '').trim()) {
            params.status = String(status).trim().toUpperCase();
        }

        const response = await api.get('/custom-orders', { params });
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return {
                success: false,
                error: normalized.message || 'Không tải được đơn tùy chỉnh.',
                data: { content: [], totalPages: 0, number: page, size },
            };
        }

        const raw = normalized.data ?? {};
        const content = toArray(raw);

        return {
            success: true,
            data: {
                ...raw,
                content,
                totalPages: Number(raw?.totalPages ?? 0),
                number: Number(raw?.number ?? page),
                size: Number(raw?.size ?? size),
            },
        };
    } catch (error) {
        return {
            success: false,
            error: mapError(error, 'Không tải được đơn tùy chỉnh.'),
            data: { content: [], totalPages: 0, number: page, size },
        };
    }
};

export const getArtisanCustomOrders = async ({ page = 0, size = 10 } = {}) => {
    try {
        const response = await api.get('/custom-orders', { params: { page, size } });
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return {
                success: false,
                error: normalized.message || 'Không tải được đơn tùy chỉnh.',
                data: { content: [], totalPages: 0, totalElements: 0, number: page, size },
            };
        }

        const raw = normalized.data ?? {};
        const content = toArray(raw);

        return {
            success: true,
            data: {
                ...raw,
                content,
                totalPages: Number(raw?.totalPages ?? 0),
                totalElements: Number(raw?.totalElements ?? content.length),
                number: Number(raw?.number ?? page),
                size: Number(raw?.size ?? size),
            },
        };
    } catch (error) {
        return {
            success: false,
            error: mapError(error, 'Không tải được đơn tùy chỉnh.'),
            data: { content: [], totalPages: 0, totalElements: 0, number: page, size },
        };
    }
};

export const getCustomOrderDetail = async (orderId) => {
    if (!orderId) return { success: false, error: 'Thiếu mã đơn.' };

    try {
        const response = await api.get(`/custom-orders/${orderId}`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được chi tiết đơn.' };
        }

        return { success: true, data: normalized.data || null };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được chi tiết đơn.') };
    }
};

export const getCustomOrderByRequest = async (requestId) => {
    if (!requestId) return { success: false, error: 'Thiếu mã yêu cầu.' };

    try {
        const response = await api.get(`/custom-orders/by-request/${requestId}`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không tải được đơn hàng theo yêu cầu.' };
        }

        return { success: true, data: normalized.data || null };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được đơn hàng theo yêu cầu.') };
    }
};

export const updateCustomOrderStatus = async (orderId, status) => {
    if (!orderId || !status) return { success: false, error: 'Thiếu thông tin cập nhật trạng thái.' };

    try {
        const response = await api.put(`/custom-orders/${orderId}/status`, null, {
            params: { status },
        });
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Cập nhật trạng thái thất bại.' };
        }

        return { success: true, data: normalized.data || {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Cập nhật trạng thái thất bại.') };
    }
};

export const confirmCustomOrder = async (orderId) => {
    if (!orderId) return { success: false, error: 'Thiếu mã đơn.' };

    try {
        const response = await api.post(`/custom-orders/${orderId}/confirm`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Xác nhận đơn thất bại.' };
        }

        return { success: true, data: normalized.data || {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Xác nhận đơn thất bại.') };
    }
};

export const getCustomOrderRefundEstimate = async (orderId) => {
    if (!orderId) return { success: false, error: 'Thiếu mã đơn.' };

    try {
        const response = await api.get(`/custom-orders/${orderId}/refund-estimate`);
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Không thể tính ước tính hoàn tiền.' };
        }

        return { success: true, data: normalized.data || null };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không thể tính ước tính hoàn tiền.') };
    }
};

export const cancelCustomOrder = async (orderId, reason = '') => {
    if (!orderId) return { success: false, error: 'Thiếu mã đơn.' };

    try {
        const response = await api.post(`/custom-orders/${orderId}/cancel`, {
            reason: String(reason || '').trim(),
        });
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Huỷ đơn thất bại.' };
        }

        return { success: true, data: normalized.data || {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Huỷ đơn thất bại.') };
    }
};

export const rejectCustomOrder = cancelCustomOrder;

export const uploadStageProof = async (stageId, payload = {}) => {
    if (!stageId) return { success: false, error: 'Thiếu mã stage.' };

    const completionImageUrl = String(payload?.completionImageUrl || payload?.imageUrl || '').trim();
    if (!completionImageUrl) return { success: false, error: 'Thiếu ảnh bằng chứng hoàn thành.' };

    try {
        const response = await api.post(`/stages/${stageId}/upload-proof`, {
            imageUrl: completionImageUrl,
            completionImageUrl,
            notes: String(payload?.notes || '').trim(),
        });
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Upload proof stage thất bại.' };
        }

        return { success: true, data: normalized.data || {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Upload proof stage thất bại.') };
    }
};

export const completeStage = async (stageId, payload = {}) => {
    if (!stageId) return { success: false, error: 'Thiếu mã stage.' };

    try {
        const response = await api.put(`/stages/${stageId}/complete`, {
            completionImageUrl: String(payload?.completionImageUrl || payload?.imageUrl || '').trim(),
            notes: String(payload?.notes || '').trim(),
        });
        const normalized = normalizeResponse(response);

        if (!isSuccessCode(normalized.code)) {
            return { success: false, error: normalized.message || 'Hoàn thành stage thất bại.' };
        }

        return { success: true, data: normalized.data || {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Hoàn thành stage thất bại.') };
    }
};

export default {
    getCustomerCustomRequests,
    getUserProfileById,
    getCustomRequestDetail,
    createCustomRequestV2,
    publishCustomRequest,
    regenerateCustomRequestImage,
    selectCustomRequestArtisan,
    getCustomOrderStages,
    getStageDetail,
    getStageCanPay,
    initiateStagePayment,
    uploadReferenceImage,
    getArtisanCustomRequests,
    createCustomOrder,
    getArtisanCustomOrders,
    getCustomOrderDetail,
    getCustomOrderByRequest,
    confirmCustomOrder,
    updateCustomOrderStatus,
    rejectCustomOrder,
    uploadStageProof,
    completeStage,
};
