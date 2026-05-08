import api from '../cofig/api';

const BASE_PATH = '/templates/admin';

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

const normalizePage = (payload) => {
  if (!payload) {
    return {
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 0,
      first: true,
      last: true,
    };
  }

  if (Array.isArray(payload)) {
    return {
      content: payload,
      totalElements: payload.length,
      totalPages: 1,
      number: 0,
      size: payload.length,
      first: true,
      last: true,
    };
  }

  return {
    content: Array.isArray(payload.content) ? payload.content : [],
    totalElements: Number(payload.totalElements || 0),
    totalPages: Number(payload.totalPages || 0),
    number: Number(payload.number || 0),
    size: Number(payload.size || 0),
    first: Boolean(payload.first),
    last: Boolean(payload.last),
  };
};

export const getPendingTemplatesApi = async ({ page = 0, size = 10 } = {}) => {
  try {
    const response = await api.get(`${BASE_PATH}/pending`, { params: { page, size } });
    const normalized = normalizeResponse(response);

    if (!isSuccessCode(normalized.code)) {
      return { success: false, error: normalized.message || 'Không tải được danh sách chờ duyệt.', data: normalizePage() };
    }

    return { success: true, data: normalizePage(normalized.data) };
  } catch (error) {
    return { success: false, error: mapError(error, 'Không tải được danh sách chờ duyệt.'), data: normalizePage() };
  }
};

export const approveTemplateApi = async (id) => {
  if (!id) return { success: false, error: 'Thiếu mã template.', data: null };

  try {
    const response = await api.put(`${BASE_PATH}/${id}/approve`);
    const normalized = normalizeResponse(response);

    if (!isSuccessCode(normalized.code)) {
      return { success: false, error: normalized.message || 'Phê duyệt thất bại.', data: null };
    }

    return { success: true, data: normalized.data || null };
  } catch (error) {
    return { success: false, error: mapError(error, 'Phê duyệt thất bại.'), data: null };
  }
};

export const rejectTemplateApi = async (id) => {
  if (!id) return { success: false, error: 'Thiếu mã template.', data: null };

  try {
    const response = await api.put(`${BASE_PATH}/${id}/reject`);
    const normalized = normalizeResponse(response);

    if (!isSuccessCode(normalized.code)) {
      return { success: false, error: normalized.message || 'Từ chối thất bại.', data: null };
    }

    return { success: true, data: normalized.data || null };
  } catch (error) {
    return { success: false, error: mapError(error, 'Từ chối thất bại.'), data: null };
  }
};

export default {
  getPendingTemplatesApi,
  approveTemplateApi,
  rejectTemplateApi,
};
