import api from '../cofig/api';

const normalizePaged = (raw) => {
    const data = raw?.data ?? raw ?? {};
    return {
        content: Array.isArray(data.content) ? data.content : [],
        totalElements: Number(data.totalElements ?? 0),
        totalPages: Number(data.totalPages ?? 0),
        number: Number(data.number ?? 0),
        size: Number(data.size ?? 10),
        first: Boolean(data.first ?? false),
        last: Boolean(data.last ?? false),
        empty: Boolean(data.empty ?? false),
    };
};

const normalizeResponse = (res) => {
    if (res?.data?.code != null) {
        return { code: res.data.code, message: res.data.message, data: res.data.data };
    }
    return { code: 200, message: 'OK', data: res?.data };
};

const mapError = (error, fallback) => {
    const message = error?.response?.data?.message
        ?? error?.response?.data?.error
        ?? error?.message
        ?? fallback;
    return typeof message === 'string' ? message : fallback;
};

export const getPublicTemplates = async (params = {}) => {
    try {
        const response = await api.get('/templates', { params });
        const payload = normalizeResponse(response);
        if (payload.code !== 200) {
            return { success: false, error: payload.message || 'Không tải được danh sách mẫu.' };
        }
        return { success: true, data: normalizePaged({ data: payload.data }) };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được danh sách mẫu.') };
    }
};

export const getMyTemplates = async (params = {}) => {
    try {
        const response = await api.get('/templates/my-templates', { params });
        const payload = normalizeResponse(response);
        if (payload.code !== 200) {
            return { success: false, error: payload.message || 'Không tải được danh sách mẫu của bạn.' };
        }
        return { success: true, data: normalizePaged({ data: payload.data }) };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được danh sách mẫu của bạn.') };
    }
};

export const getArtisanTemplates = async ({ page = 0, size = 10 } = {}) => {
    try {
        const response = await api.get('/artisan/templates', { params: { page, size } });
        const payload = normalizeResponse(response);
        if (payload.code !== 200) {
            return {
                success: false,
                error: payload.message || 'Không tải được danh sách template artisan.',
                data: normalizePaged({ data: { content: [], totalElements: 0, totalPages: 0, number: page, size } }),
            };
        }
        return { success: true, data: normalizePaged({ data: payload.data }) };
    } catch (error) {
        return {
            success: false,
            error: mapError(error, 'Không tải được danh sách template artisan.'),
            data: normalizePaged({ data: { content: [], totalElements: 0, totalPages: 0, number: page, size } }),
        };
    }
};

export const getTemplateById = async (id) => {
    try {
        const response = await api.get(`/templates/${id}`);
        const payload = normalizeResponse(response);
        if (payload.code !== 200) {
            return { success: false, error: payload.message || 'Không tải được chi tiết mẫu.' };
        }
        return { success: true, data: payload.data ?? {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được chi tiết mẫu.') };
    }
};

export const createTemplate = async (body) => {
    try {
        const response = await api.post('/templates', body);
        const payload = normalizeResponse(response);
        if (payload.code !== 200 && payload.code !== 201) {
            return { success: false, error: payload.message || 'Tạo mẫu thất bại.' };
        }
        return { success: true, data: payload.data ?? {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Tạo mẫu thất bại.') };
    }
};

export const updateTemplate = async (id, body) => {
    try {
        const response = await api.put(`/templates/${id}`, body);
        const payload = normalizeResponse(response);
        if (payload.code !== 200) {
            return { success: false, error: payload.message || 'Cập nhật mẫu thất bại.' };
        }
        return { success: true, data: payload.data ?? {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Cập nhật mẫu thất bại.') };
    }
};

export const deleteTemplate = async (id) => {
    try {
        const response = await api.delete(`/templates/${id}`);
        const payload = normalizeResponse(response);
        if (response.status >= 200 && response.status < 300 && (payload.code == null || payload.code === 200)) {
            return { success: true };
        }
        return { success: false, error: payload.message || 'Xóa mẫu thất bại.' };
    } catch (error) {
        return { success: false, error: mapError(error, 'Xóa mẫu thất bại.') };
    }
};

export const createZone = async (templateId, body) => {
    try {
        const response = await api.post(`/templates/${templateId}/zones`, body);
        const payload = normalizeResponse(response);
        if (payload.code !== 200 && payload.code !== 201) {
            return { success: false, error: payload.message || 'Thêm zone thất bại.' };
        }
        return { success: true, data: payload.data ?? {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Thêm zone thất bại.') };
    }
};

export const updateZone = async (templateId, zoneId, body) => {
    try {
        const response = await api.put(`/templates/${templateId}/zones/${zoneId}`, body);
        const payload = normalizeResponse(response);
        if (payload.code !== 200) {
            return { success: false, error: payload.message || 'Cập nhật zone thất bại.' };
        }
        return { success: true, data: payload.data ?? {} };
    } catch (error) {
        return { success: false, error: mapError(error, 'Cập nhật zone thất bại.') };
    }
};

export const deleteZone = async (templateId, zoneId) => {
    try {
        const response = await api.delete(`/templates/${templateId}/zones/${zoneId}`);
        const payload = normalizeResponse(response);
        if (response.status >= 200 && response.status < 300 && (payload.code == null || payload.code === 200)) {
            return { success: true };
        }
        return { success: false, error: payload.message || 'Xóa zone thất bại.' };
    } catch (error) {
        return { success: false, error: mapError(error, 'Xóa zone thất bại.') };
    }
};

export const getPricePreview = async (templateId, zoneInputs) => {
    try {
        const response = await api.get(`/templates/${templateId}/price-preview`, {
            params: { zoneInputs: JSON.stringify(zoneInputs || {}) },
        });
        const payload = normalizeResponse(response);
        if (payload.code !== 200) {
            return { success: false, error: payload.message || 'Không tính được giá dự kiến.' };
        }
        return { success: true, data: payload.data };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tính được giá dự kiến.') };
    }
};

export const getPriceBreakdown = async (templateId, zoneInputs) => {
    try {
        const response = await api.get(`/templates/${templateId}/price-breakdown`, {
            params: { zoneInputs: JSON.stringify(zoneInputs || {}) },
        });
        const payload = normalizeResponse(response);
        if (payload.code !== 200) {
            return { success: false, error: payload.message || 'Không tải được chi tiết giá.' };
        }
        return { success: true, data: payload.data };
    } catch (error) {
        return { success: false, error: mapError(error, 'Không tải được chi tiết giá.') };
    }
};

export default {
    getPublicTemplates,
    getMyTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createZone,
    updateZone,
    deleteZone,
    getPricePreview,
    getPriceBreakdown,
};
