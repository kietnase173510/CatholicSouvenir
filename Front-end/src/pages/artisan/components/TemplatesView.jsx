import React, { useCallback, useEffect, useMemo, useState } from 'react';
import templateService from '../../../services/templateService';
import categoryService from '../../../services/categoryService';
import { appToast } from '../../../lib/appToast';
import ImageUploadZone from '../../../components/ui/ImageUploadZone';
import './TemplatesView.css';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/120x90?text=No+Image';
const INPUT_TYPES = [
    { value: 'TEXT', label: 'Văn bản' },
    { value: 'IMAGE', label: 'Hình ảnh' },
    { value: 'COLOR', label: 'Màu sắc' },
    { value: 'NUMBER', label: 'Số' },
];

const formatVnd = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} ₫`;
const formatNumberInput = (value) => {
    const text = String(value ?? '').replace(/,/g, '').trim();
    if (!text) return '';
    const numeric = Number(text);
    if (Number.isNaN(numeric)) return text;
    return new Intl.NumberFormat('vi-VN').format(numeric);
};
const parseNumberInput = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits ? Number(digits) : NaN;
};
const isRawNumberInput = (value) => /^\d*$/.test(String(value ?? ''));
const safeText = (value) => {
    if (value == null) return '—';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed === '' ? '—' : trimmed;
    }
    return value;
};

const getTemplateId = (item) => item?.templateId || item?.id || item?.uuid || '';
const getZoneId = (zone) => zone?.zoneId || zone?.id || zone?.uuid || '';

const parseMaybeJson = (value, fallback) => {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const normalizeTemplate = (item) => {
    const customZones = Array.isArray(item?.customZones) ? item.customZones : [];
    const zones = Array.isArray(item?.zones) ? item.zones : [];
    return {
        templateId: getTemplateId(item),
        name: item?.name || '',
        description: item?.description || '',
        artisanId: item?.artisanId || '',
        artisanName: item?.artisanName || '',
        categoryId: item?.categoryId || '',
        categoryName: item?.categoryName || item?.category?.name || '',
        basePrice: Number(item?.basePrice ?? 0),
        material: item?.material || '',
        style: item?.style || '',
        baseImages: Array.isArray(item?.baseImages) ? item.baseImages.filter(Boolean) : [],
        isActive: item?.isActive !== false,
        zoneCount: Number(item?.zoneCount ?? customZones.length ?? zones.length ?? 0),
        customZones,
        zones,
        createdAt: item?.createdAt,
        updatedAt: item?.updatedAt,
    };
};

const normalizeZone = (zone) => ({
    zoneId: getZoneId(zone),
    zoneName: zone?.zoneName || zone?.name || '',
    zoneDescription: zone?.zoneDescription || zone?.description || '',
    inputType: zone?.inputType || 'TEXT',
    extraPrice: Number(zone?.extraPrice ?? 0),
    isRequired: Boolean(zone?.isRequired ?? false),
    sortOrder: Number(zone?.sortOrder ?? 0),
    inputConstraints: parseMaybeJson(zone?.inputConstraints, {}),
});

const createEmptyTemplateZone = () => ({
    zoneName: '',
    zoneDescription: '',
    inputType: 'TEXT',
    extraPrice: '0',
    isRequired: false,
    sortOrder: '0',
});

const defaultTemplateForm = {
    name: '',
    categoryId: '',
    description: '',
    basePrice: '',
    material: '',
    style: '',
    baseImages: [],
    isActive: true,
    customZones: [],
};

const defaultZoneForm = {
    zoneName: '',
    zoneDescription: '',
    inputType: 'TEXT',
    extraPrice: '0',
    isRequired: false,
    sortOrder: '0',
    inputConstraints: [{ key: '', value: '' }],
};

const TemplatesView = ({ user }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [templatesPage, setTemplatesPage] = useState({
        content: [], totalElements: 0, totalPages: 0, number: 0, size: 10,
    });

    const [filters, setFilters] = useState({ search: '', categoryId: '', status: 'all' });
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(10);

    const [categories, setCategories] = useState([]);
    const [expandedTemplateId, setExpandedTemplateId] = useState('');
    const [expandedTemplateDetail, setExpandedTemplateDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [templateModalMode, setTemplateModalMode] = useState('create');
    const [templateForm, setTemplateForm] = useState(defaultTemplateForm);
    const [templateFormDirty, setTemplateFormDirty] = useState(false);
    const [pendingCloseTemplateModal, setPendingCloseTemplateModal] = useState(false);
    const [uploadingTemplateImage, setUploadingTemplateImage] = useState(false);

    const [zoneModalOpen, setZoneModalOpen] = useState(false);
    const [zoneModalMode, setZoneModalMode] = useState('create');
    const [zoneForm, setZoneForm] = useState(defaultZoneForm);
    const [editingZoneId, setEditingZoneId] = useState('');
    const [pendingCloseZoneModal, setPendingCloseZoneModal] = useState(false);

    const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState('');
    const [confirmDeleteZoneId, setConfirmDeleteZoneId] = useState('');

    const artisanId = user?.id || user?.artisanId || user?.artisanUuid || user?.accountId || '';



    const fetchCategories = useCallback(async () => {
        try {
            const result = await categoryService.getCategories();
            if (!result.success) {
                setCategories([]);
                appToast.warning('Không tải được danh mục', result.error || 'Vui lòng thử lại');
                return;
            }

            const data = (result.data || [])
                .map((c) => ({
                    id: c?.id || c?.categoryId || c?.uuid || '',
                    name: c?.name || c?.categoryName || c?.title || '',
                    isActive: c?.isActive !== false,
                }))
                .filter((c) => c.id && (c.name || '').trim() && c.isActive);

            setCategories(data);
        } catch {
            setCategories([]);
            appToast.warning('Không tải được danh mục');
        }
    }, []);

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        const query = { page, size };
        const normalizedCategoryId = String(filters.categoryId || '').trim();
        if (normalizedCategoryId) {
            query.categoryId = normalizedCategoryId;
        }

        if (artisanId) {
            query.artisanId = artisanId;
        }

        const result = await templateService.getMyTemplates(query);
        if (result.success) {
            const pageData = result.data;
            const normalizedContent = (pageData.content || []).map(normalizeTemplate);
            pageData.content = normalizedContent;
            setTemplatesPage(pageData);
        } else {
            setTemplatesPage({ content: [], totalElements: 0, totalPages: 0, number: page, size });
            appToast.error('Không tải được danh sách mẫu', result.error || 'Vui lòng thử lại');
        }
        setLoading(false);
    }, [filters.categoryId, page, size, artisanId]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const categoryMap = useMemo(() => {
        const map = {};
        categories.forEach((c) => { map[c.id] = c.name; });
        return map;
    }, [categories]);

    const filteredTemplates = useMemo(() => {
        return (templatesPage.content || []).filter((item) => {
            const okSearch = !filters.search || (item.name || '').toLowerCase().includes(filters.search.toLowerCase());
            const okStatus = filters.status === 'all'
                || (filters.status === 'active' && item.isActive)
                || (filters.status === 'inactive' && !item.isActive);
            return okSearch && okStatus;
        });
    }, [templatesPage.content, filters]);

    const stats = useMemo(() => {
        const active = filteredTemplates.filter((t) => t.isActive).length;
        const zoneTotal = filteredTemplates.reduce((sum, t) => sum + Number(t.zoneCount || 0), 0);
        return {
            total: templatesPage.totalElements || filteredTemplates.length,
            active,
            zoneTotal,
        };
    }, [filteredTemplates, templatesPage.totalElements]);

    const openCreateTemplate = () => {
        setTemplateModalMode('create');
        setTemplateForm({ ...defaultTemplateForm, customZones: [createEmptyTemplateZone()] });
        setTemplateFormDirty(false);
        setPendingCloseTemplateModal(false);
        setTemplateModalOpen(true);
    };

    const openEditTemplate = async (item) => {
        const templateId = item?.templateId;
        if (!templateId) return;

        setTemplateModalMode('edit');
        setTemplateFormDirty(false);
        setPendingCloseTemplateModal(false);
        setTemplateModalOpen(true);

        const result = await templateService.getTemplateById(templateId);
        if (!result.success) {
            appToast.error('Không tải được chi tiết mẫu', result.error || 'Vui lòng thử lại');
            setTemplateModalOpen(false);
            return;
        }

        const detail = result.data || {};
        const rawZones = Array.isArray(detail.customZones)
            ? detail.customZones
            : Array.isArray(detail.zones)
                ? detail.zones
                : [];

        const mappedZones = rawZones.map((zone) => ({
            zoneName: zone?.zoneName || zone?.name || '',
            zoneDescription: zone?.zoneDescription || zone?.description || '',
            inputType: zone?.inputType || 'TEXT',
            extraPrice: String(Number(zone?.extraPrice ?? 0)),
            isRequired: Boolean(zone?.isRequired),
            sortOrder: String(Number(zone?.sortOrder ?? 0)),
        }));

        setTemplateForm({
            name: detail.name || item.name || '',
            categoryId: detail.categoryId || item.categoryId || '',
            description: detail.description || item.description || '',
            basePrice: detail.basePrice ?? item.basePrice ?? '',
            material: detail.material || item.material || '',
            style: detail.style || item.style || '',
            baseImages: Array.isArray(detail.baseImages || item.baseImages) ? (detail.baseImages || item.baseImages).filter(Boolean) : [],
            isActive: detail.isActive !== false,
            customZones: mappedZones,
            templateId,
        });
    };

    const makeZonePayload = (zone) => ({
        zoneName: (zone.zoneName || '').trim(),
        zoneDescription: (zone.zoneDescription || '').trim() || undefined,
        inputType: zone.inputType || 'TEXT',
        extraPrice: Number(zone.extraPrice || 0),
        isRequired: Boolean(zone.isRequired),
        sortOrder: Number(zone.sortOrder || 0),
        inputConstraints: (zone.inputConstraints || []).reduce((acc, row) => {
            const key = (row.key || '').trim();
            if (!key) return acc;
            acc[key] = row.value ?? '';
            return acc;
        }, {}),
    });

    const submitTemplate = async (e) => {
        e.preventDefault();
        const name = (templateForm.name || '').trim();
        const categoryId = (templateForm.categoryId || '').trim();
        const basePrice = parseNumberInput(templateForm.basePrice);

        if (!name || !categoryId || Number.isNaN(basePrice) || basePrice < 0.01) {
            appToast.warning('Thiếu thông tin bắt buộc', 'Tên, danh mục và giá gốc hợp lệ là bắt buộc.');
            return;
        }

        const mappedCustomZones = (templateForm.customZones || []).map((zone) => {
            const zoneName = (zone.zoneName || '').trim();
            return {
                zoneName,
                zoneDescription: (zone.zoneDescription || '').trim() || undefined,
                inputType: zone.inputType || 'TEXT',
                extraPrice: Number(zone.extraPrice || 0),
                isRequired: Boolean(zone.isRequired),
                sortOrder: Number(zone.sortOrder || 0),
            };
        }).filter((zone) => zone.zoneName);

        const body = {
            name,
            categoryId,
            description: (templateForm.description || '').trim() || undefined,
            basePrice,
            material: (templateForm.material || '').trim() || undefined,
            style: (templateForm.style || '').trim() || undefined,
            baseImages: (templateForm.baseImages || []).filter(Boolean),
            customZones: mappedCustomZones,
            isActive: Boolean(templateForm.isActive),
        };

        setSaving(true);
        const result = templateModalMode === 'create'
            ? await templateService.createTemplate(body)
            : await templateService.updateTemplate(templateForm.templateId, body);
        setSaving(false);

        if (!result.success) {
            appToast.error(
                templateModalMode === 'create' ? 'Tạo mẫu thất bại' : 'Cập nhật mẫu thất bại',
                result.error || 'Vui lòng thử lại',
            );
            return;
        }

        appToast.success(templateModalMode === 'create' ? 'Tạo mẫu thành công' : 'Cập nhật mẫu thành công');
        setTemplateFormDirty(false);
        setPendingCloseTemplateModal(false);
        setTemplateModalOpen(false);
        await fetchTemplates();
    };

    const openTemplateDetail = async (templateId) => {
        if (!templateId) return;
        if (expandedTemplateId === templateId) {
            setExpandedTemplateId('');
            setExpandedTemplateDetail(null);
            return;
        }
        setExpandedTemplateId(templateId);
        setDetailLoading(true);
        const result = await templateService.getTemplateById(templateId);
        setDetailLoading(false);
        if (!result.success) {
            appToast.error('Không tải được chi tiết mẫu', result.error || 'Vui lòng thử lại');
            return;
        }

        const detail = normalizeTemplate(result.data || {});
        const rawZones = Array.isArray(result?.data?.customZones)
            ? result.data.customZones
            : Array.isArray(result?.data?.zones)
                ? result.data.zones
                : [];
        detail.zones = rawZones.map(normalizeZone).sort((a, b) => a.sortOrder - b.sortOrder);
        detail.zoneCount = detail.zones.length;

        setExpandedTemplateDetail(detail);
    };

    const closeTemplateModal = () => {
        if (saving) return;
        if (templateFormDirty) {
            setPendingCloseTemplateModal(true);
            return;
        }
        setPendingCloseTemplateModal(false);
        setTemplateModalOpen(false);
    };

    const confirmCloseTemplateModal = () => {
        setPendingCloseTemplateModal(false);
        setTemplateModalOpen(false);
    };

    const closeZoneModal = () => {
        setPendingCloseZoneModal(true);
    };

    const markTemplateDirty = (updater) => {
        setTemplateFormDirty(true);
        setTemplateForm(updater);
    };

    const handleTemplatePriceChange = (value) => {
        const raw = String(value ?? '').replace(/[^0-9]/g, '');
        markTemplateDirty((prev) => ({ ...prev, basePrice: raw }));
    };

    const confirmCloseZoneModal = () => {
        setPendingCloseZoneModal(false);
        setZoneModalOpen(false);
    };

    const submitDeleteTemplate = async () => {
        if (!confirmDeleteTemplateId) return;
        const result = await templateService.deleteTemplate(confirmDeleteTemplateId);
        if (!result.success) {
            appToast.error('Xóa mẫu thất bại', result.error || 'Vui lòng thử lại');
            return;
        }
        appToast.success('Đã xóa mẫu thiết kế');
        setConfirmDeleteTemplateId('');
        if (expandedTemplateId === confirmDeleteTemplateId) {
            setExpandedTemplateId('');
            setExpandedTemplateDetail(null);
        }
        await fetchTemplates();
    };

    const openCreateZoneModal = () => {
        setZoneModalMode('create');
        setZoneForm(defaultZoneForm);
        setEditingZoneId('');
        setPendingCloseZoneModal(false);
        setZoneModalOpen(true);
    };

    const openEditZoneModal = (zone) => {
        setZoneModalMode('edit');
        setEditingZoneId(zone.zoneId);
        setPendingCloseZoneModal(false);
        const constraints = Object.entries(zone.inputConstraints || {});
        setZoneForm({
            zoneName: zone.zoneName || '',
            zoneDescription: zone.zoneDescription || '',
            inputType: zone.inputType || 'TEXT',
            extraPrice: String(zone.extraPrice ?? 0),
            isRequired: Boolean(zone.isRequired),
            sortOrder: String(zone.sortOrder ?? 0),
            inputConstraints: constraints.length > 0
                ? constraints.map(([key, value]) => ({ key, value: String(value ?? '') }))
                : [{ key: '', value: '' }],
        });
        setZoneModalOpen(true);
    };

    const submitZone = async (e) => {
        e.preventDefault();
        if (!expandedTemplateId) return;
        if (!(zoneForm.zoneName || '').trim()) {
            appToast.warning('Thiếu thông tin', 'Tên zone là bắt buộc.');
            return;
        }

        const payload = makeZonePayload(zoneForm);
        let result;
        if (zoneModalMode === 'create') {
            result = await templateService.createZone(expandedTemplateId, payload);
        } else {
            result = await templateService.updateZone(expandedTemplateId, editingZoneId, payload);
        }

        if (!result.success) {
            appToast.error(zoneModalMode === 'create' ? 'Thêm zone thất bại' : 'Cập nhật zone thất bại', result.error || 'Vui lòng thử lại');
            return;
        }

        appToast.success(zoneModalMode === 'create' ? 'Đã thêm zone' : 'Đã cập nhật zone');
        setZoneModalOpen(false);
        setExpandedTemplateId('');
        await openTemplateDetail(expandedTemplateId);
        await fetchTemplates();
    };

    const submitDeleteZone = async () => {
        if (!expandedTemplateId || !confirmDeleteZoneId) return;
        const result = await templateService.deleteZone(expandedTemplateId, confirmDeleteZoneId);
        if (!result.success) {
            appToast.error('Xóa zone thất bại', result.error || 'Vui lòng thử lại');
            return;
        }
        appToast.success('Đã xóa zone');
        setConfirmDeleteZoneId('');
        setExpandedTemplateId('');
        await openTemplateDetail(expandedTemplateId);
        await fetchTemplates();
    };


    const updateExpandedTemplateStatus = async (nextActive) => {
        if (!expandedTemplateDetail?.templateId) return;
        const payload = {
            name: expandedTemplateDetail.name,
            categoryId: expandedTemplateDetail.categoryId,
            description: expandedTemplateDetail.description || undefined,
            basePrice: expandedTemplateDetail.basePrice,
            material: expandedTemplateDetail.material || undefined,
            style: expandedTemplateDetail.style || undefined,
            baseImages: expandedTemplateDetail.baseImages || [],
            isActive: nextActive,
        };

        const result = await templateService.updateTemplate(expandedTemplateDetail.templateId, payload);
        if (!result.success) {
            appToast.error('Không cập nhật được trạng thái', result.error || 'Vui lòng thử lại');
            return;
        }
        appToast.success('Đã cập nhật trạng thái mẫu');
        setExpandedTemplateDetail((prev) => (prev ? { ...prev, isActive: nextActive } : prev));
        setTemplatesPage((prev) => ({
            ...prev,
            content: (prev.content || []).map((t) => (t.templateId === expandedTemplateDetail.templateId ? { ...t, isActive: nextActive } : t)),
        }));
    };

    return (
        <div className="templates-view">
            <header className="templates-header">
                <div>
                    <h1 className="templates-title">Mẫu thiết kế</h1>
                    <p className="templates-subtitle">Quản lý mẫu sản phẩm và các vùng tùy chỉnh</p>
                </div>
                <button type="button" className="btn-primary" onClick={openCreateTemplate}>+ Tạo mẫu mới</button>
            </header>

            <section className="template-stats-row">
                <StatCard label="Tổng mẫu" value={stats.total} />
                <StatCard label="Đang hoạt động" value={stats.active} />
                <StatCard label="Tổng zones" value={stats.zoneTotal} />
            </section>

            <section className="template-filters">
                <input
                    type="text"
                    className="filter-input"
                    placeholder="Tìm theo tên mẫu..."
                    value={filters.search}
                    onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                />

                <select
                    className="filter-input"
                    value={filters.categoryId}
                    onChange={(e) => {
                        setPage(0);
                        setFilters((p) => ({ ...p, categoryId: e.target.value }));
                    }}
                >
                    <option value="">Tất cả danh mục</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                <select
                    className="filter-input"
                    value={filters.status}
                    onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Tắt</option>
                </select>


            </section>

            <section className="templates-table-wrap">
                {loading ? (
                    <div className="template-skeleton-wrap">
                        {Array.from({ length: 6 }).map((_, idx) => <div key={idx} className="template-skeleton-row" />)}
                    </div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="template-empty">Chưa có mẫu thiết kế nào</div>
                ) : (
                    <table className="templates-table">
                        <thead>
                            <tr>
                                <th>MẪU THIẾT KẾ</th>
                                <th>DANH MỤC</th>
                                <th>CHẤT LIỆU / PHONG CÁCH</th>
                                <th>GIÁ GỐC</th>
                                <th>TRẠNG THÁI</th>
                                <th>HÀNH ĐỘNG</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTemplates.map((item) => (
                                <React.Fragment key={item.templateId}>
                                    <tr>
                                        <td>
                                            <div className="template-cell-product">
                                                <img src={item.baseImages?.[0] || PLACEHOLDER_IMAGE} alt={item.name || 'template'} />
                                                <div>
                                                    <div className="template-name">{safeText(item.name)}</div>
                                                    <div className="template-subtext">{safeText(item.artisanName)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="template-badge template-badge--green">{safeText(item.categoryName || categoryMap[String(item.categoryId || '').trim()] || item.categoryId || 'Chưa gán danh mục')}</span>
                                        </td>
                                        <td>
                                            <div>{safeText(item.material)}</div>
                                            <div className="template-subtext">{safeText(item.style)}</div>
                                        </td>
                                        <td>{formatVnd(item.basePrice)}</td>
                                        <td>
                                            <span className={`template-badge ${item.isActive ? 'template-badge--green-soft' : 'template-badge--gray'}`}>
                                                {item.isActive ? 'Hoạt động' : 'Tắt'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                <button type="button" className="action-btn" title="Zones" onClick={() => openTemplateDetail(item.templateId)}>≡</button>
                                                <button type="button" className="action-btn" title="Sửa" onClick={() => openEditTemplate(item)}>✏</button>
                                                <button type="button" className="action-btn danger" title="Xóa" onClick={() => setConfirmDeleteTemplateId(item.templateId)}>✕</button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedTemplateId === item.templateId && (
                                        <tr>
                                            <td colSpan={6}>
                                                {detailLoading || !expandedTemplateDetail ? (
                                                    <div className="template-detail-loading">Đang tải chi tiết...</div>
                                                ) : (
                                                    <TemplateDetailPanel
                                                        detail={expandedTemplateDetail}
                                                        onStatusChange={updateExpandedTemplateStatus}
                                                        onCreateZone={openCreateZoneModal}
                                                        onEditZone={openEditZoneModal}
                                                        onDeleteZone={(zoneId) => setConfirmDeleteZoneId(zoneId)}
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <section className="template-pagination-row">
                <div className="page-size-control">
                    <span>Kích thước trang</span>
                    <select value={size} onChange={(e) => { setPage(0); setSize(Number(e.target.value)); }}>
                        {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>
                <div className="page-nav">
                    <button type="button" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Trước</button>
                    <span>Trang {templatesPage.number + 1} / {Math.max(templatesPage.totalPages || 1, 1)}</span>
                    <button
                        type="button"
                        disabled={templatesPage.totalPages === 0 || page >= templatesPage.totalPages - 1}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Sau
                    </button>
                </div>
            </section>

            {templateModalOpen && (
                <div className="template-modal-overlay" onClick={closeTemplateModal}>
                    <div className="template-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="template-modal-header">
                            <h3>{templateModalMode === 'create' ? 'Tạo mẫu thiết kế' : 'Chỉnh sửa mẫu thiết kế'}</h3>
                            <button type="button" className="modal-close" onClick={closeTemplateModal}>×</button>
                        </div>
                        <form className="template-modal-body" onSubmit={submitTemplate}>
                            <div className="form-columns">
                                <div className="form-column-left">
                                    {(templateForm.baseImages || []).length > 0 && (
                                        <div className="template-base-images-preview">
                                            <div className="template-base-image-main">
                                                <img src={templateForm.baseImages[0]} alt="Base 1" />
                                                <button
                                                    type="button"
                                                    className="icon-button"
                                                    onClick={() => {
                                                        setTemplateFormDirty(true);
                                                        setTemplateForm((p) => ({
                                                            ...p,
                                                            baseImages: (p.baseImages || []).slice(1),
                                                        }));
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            {(templateForm.baseImages || []).length > 1 && (
                                                <div className="template-base-thumb-grid">
                                                    {(templateForm.baseImages || []).slice(1).map((imageUrl, index) => {
                                                        const removeIndex = index + 1;
                                                        return (
                                                            <div key={`template-base-preview-${removeIndex}`} className="template-base-thumb">
                                                                <img src={imageUrl} alt={`Base ${removeIndex + 1}`} />
                                                                <button
                                                                    type="button"
                                                                    className="icon-button"
                                                                    onClick={() => {
                                                                        setTemplateFormDirty(true);
                                                                        setTemplateForm((p) => ({
                                                                            ...p,
                                                                            baseImages: (p.baseImages || []).filter((_, idx) => idx !== removeIndex),
                                                                        }));
                                                                    }}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="form-field wide-field">
                                        <label>Ảnh mẫu</label>
                                        <ImageUploadZone
                                            multiple
                                            folder="templates"
                                            onUpload={(urls) => {
                                                setTemplateFormDirty(true);
                                                setTemplateForm((p) => ({ ...p, baseImages: urls }));
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="form-column-right">
                                    <div className="form-row">
                                        <div className="form-field">
                                            <label>Tên mẫu <span className="required-mark">*</span></label>
                                            <input value={templateForm.name} onChange={(e) => { setTemplateFormDirty(true); setTemplateForm((p) => ({ ...p, name: e.target.value })); }} />
                                        </div>
                                        <div className="form-field">
                                            <label>Danh mục <span className="required-mark">*</span></label>
                                            <select value={templateForm.categoryId} onChange={(e) => { setTemplateFormDirty(true); setTemplateForm((p) => ({ ...p, categoryId: e.target.value })); }}>
                                                <option value="">-- Chọn danh mục --</option>
                                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-field">
                                            <label>Giá gốc <span className="required-mark">*</span></label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete="off"
                                                value={templateForm.basePrice}
                                                onChange={(e) => handleTemplatePriceChange(e.target.value)}
                                            />
                                        </div>
                                        <div className="form-field">
                                            <label>Chất liệu</label>
                                            <input value={templateForm.material} onChange={(e) => { setTemplateFormDirty(true); setTemplateForm((p) => ({ ...p, material: e.target.value })); }} />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-field">
                                            <label>Phong cách</label>
                                            <input value={templateForm.style} onChange={(e) => { setTemplateFormDirty(true); setTemplateForm((p) => ({ ...p, style: e.target.value })); }} />
                                        </div>
                                        {/* <div className="form-field">
                                            <label>&nbsp;</label>
                                            <label className="checkbox-label"><input type="checkbox" checked={templateForm.isActive} onChange={(e) => { setTemplateFormDirty(true); setTemplateForm((p) => ({ ...p, isActive: e.target.checked })); }} /> Hoạt động</label>
                                        </div> */}
                                    </div>

                                    <div className="form-field wide-field">
                                        <label>Mô tả</label>
                                        <textarea rows={3} value={templateForm.description} onChange={(e) => { setTemplateFormDirty(true); setTemplateForm((p) => ({ ...p, description: e.target.value })); }} />
                                    </div>

                                </div>
                            </div>

                            <div className="constraints-wrap modal-zone-section">
                                <div className="zones-header-row">
                                    <h4>Vùng tùy chỉnh</h4>
                                    <button
                                        type="button"
                                        className="btn-outline"
                                        onClick={() => { setTemplateFormDirty(true); setTemplateForm((p) => ({
                                            ...p,
                                            customZones: [...(p.customZones || []), createEmptyTemplateZone()],
                                        })); }}
                                    >
                                        + Thêm vùng
                                    </button>
                                </div>

                                {(templateForm.customZones || []).length === 0 ? (
                                    <p className="template-subtext">Chưa có vùng nào. Bấm "Thêm vùng" để tạo.</p>
                                ) : (
                                    <div className="constraints-list">
                                        {(templateForm.customZones || []).map((zone, idx) => (
                                            <div className="zone-row" key={`template-zone-${idx}`}>
                                                <div className="zone-row-top">
                                                    <div className="form-field">
                                                        <label>Tên vùng <span className="required-mark">*</span></label>
                                                        <input value={zone.zoneName} onChange={(e) => setTemplateFormDirty(true) || setTemplateForm((p) => { const next = [...(p.customZones || [])]; next[idx] = { ...next[idx], zoneName: e.target.value }; return { ...p, customZones: next }; })} />
                                                    </div>
                                                    <div className="form-field">
                                                        <label>Kiểu đầu vào <span className="required-mark">*</span></label>
                                                        <select value={zone.inputType} onChange={(e) => setTemplateFormDirty(true) || setTemplateForm((p) => { const next = [...(p.customZones || [])]; next[idx] = { ...next[idx], inputType: e.target.value }; return { ...p, customZones: next }; })}>
                                                            {INPUT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="form-field">
                                                        <label>Phụ phí</label>
                                                        <input type="number" value={zone.extraPrice} onChange={(e) => setTemplateFormDirty(true) || setTemplateForm((p) => { const next = [...(p.customZones || [])]; next[idx] = { ...next[idx], extraPrice: e.target.value }; return { ...p, customZones: next }; })} />
                                                    </div>
                                                    <div className="form-field">
                                                        <label>Thứ tự sắp xếp</label>
                                                        <input type="number" value={zone.sortOrder} onChange={(e) => setTemplateFormDirty(true) || setTemplateForm((p) => { const next = [...(p.customZones || [])]; next[idx] = { ...next[idx], sortOrder: e.target.value }; return { ...p, customZones: next }; })} />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="action-btn danger zone-delete-btn"
                                                        onClick={() => setTemplateFormDirty(true) || setTemplateForm((p) => { const next = [...(p.customZones || [])]; next.splice(idx, 1); return { ...p, customZones: next }; })}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <div className="zone-row-bottom">
                                                    <div className="form-field">
                                                        <label>Mô tả vùng</label>
                                                        <input value={zone.zoneDescription} onChange={(e) => setTemplateFormDirty(true) || setTemplateForm((p) => { const next = [...(p.customZones || [])]; next[idx] = { ...next[idx], zoneDescription: e.target.value }; return { ...p, customZones: next }; })} />
                                                    </div>
                                                    <label className="checkbox-label"><input type="checkbox" checked={zone.isRequired} onChange={(e) => setTemplateFormDirty(true) || setTemplateForm((p) => { const next = [...(p.customZones || [])]; next[idx] = { ...next[idx], isRequired: e.target.checked }; return { ...p, customZones: next }; })} /> Bắt buộc</label>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="template-modal-actions template-modal-actions-footer">
                                <button type="button" className="btn-outline" onClick={closeTemplateModal} disabled={saving}>Hủy</button>
                                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {zoneModalOpen && (
                <div className="template-modal-overlay" onClick={closeZoneModal}>
                    <div className="template-modal zone-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="template-modal-header">
                            <h3>{zoneModalMode === 'create' ? 'Thêm vùng' : 'Chỉnh sửa vùng'}</h3>
                            <button type="button" className="modal-close" onClick={closeZoneModal}>×</button>
                        </div>
                        <form className="template-modal-body" onSubmit={submitZone}>
                            <div className="zone-form-grid">
                                <div className="form-field wide-field">
                                    <label>Tên vùng <span className="required-mark">*</span></label>
                                    <input value={zoneForm.zoneName} onChange={(e) => setZoneForm((p) => ({ ...p, zoneName: e.target.value }))} />
                                </div>
                                <div className="form-field">
                                    <label>Kiểu đầu vào <span className="required-mark">*</span></label>
                                    <select value={zoneForm.inputType} onChange={(e) => setZoneForm((p) => ({ ...p, inputType: e.target.value }))}>
                                        {INPUT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Phụ thu</label>
                                    <input type="number" value={zoneForm.extraPrice} onChange={(e) => setZoneForm((p) => ({ ...p, extraPrice: e.target.value }))} />
                                </div>
                                <div className="form-field">
                                    <label>Thứ tự hiển thị</label>
                                    <input type="number" value={zoneForm.sortOrder} onChange={(e) => setZoneForm((p) => ({ ...p, sortOrder: e.target.value }))} />
                                </div>
                                <div className="form-field wide-field">
                                    <label>Mô tả vùng</label>
                                    <input value={zoneForm.zoneDescription} onChange={(e) => setZoneForm((p) => ({ ...p, zoneDescription: e.target.value }))} />
                                </div>
                                <label className="checkbox-label wide-field"><input type="checkbox" checked={zoneForm.isRequired} onChange={(e) => setZoneForm((p) => ({ ...p, isRequired: e.target.checked }))} /> Bắt buộc</label>
                            </div>

                            <div className="constraints-wrap">
                                <div className="zones-header-row">
                                    <h4>Ràng buộc đầu vào</h4>
                                    <button type="button" className="btn-outline" onClick={() => setZoneForm((p) => ({ ...p, inputConstraints: [...(p.inputConstraints || []), { key: '', value: '' }] }))}>+ Thêm cặp</button>
                                </div>
                                <div className="constraints-list">
                                    {(zoneForm.inputConstraints || []).map((row, idx) => (
                                        <div className="constraint-row" key={`c-${idx}`}>
                                            <input placeholder="Khóa" value={row.key} onChange={(e) => setZoneForm((p) => {
                                                const next = [...(p.inputConstraints || [])];
                                                next[idx] = { ...next[idx], key: e.target.value };
                                                return { ...p, inputConstraints: next };
                                            })} />
                                            <input placeholder="Giá trị" value={row.value} onChange={(e) => setZoneForm((p) => {
                                                const next = [...(p.inputConstraints || [])];
                                                next[idx] = { ...next[idx], value: e.target.value };
                                                return { ...p, inputConstraints: next };
                                            })} />
                                            <button type="button" className="action-btn danger" onClick={() => setZoneForm((p) => {
                                                const next = [...(p.inputConstraints || [])];
                                                next.splice(idx, 1);
                                                return { ...p, inputConstraints: next.length > 0 ? next : [{ key: '', value: '' }] };
                                            })}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="template-modal-actions">
                                <button type="button" className="btn-outline" onClick={closeZoneModal}>Hủy</button>
                                <button type="submit" className="btn-primary">Lưu zone</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {Boolean(confirmDeleteTemplateId) && (
                <ConfirmDialog
                    title="Xác nhận xóa mẫu"
                    message="Bạn có chắc chắn muốn xóa mẫu thiết kế này?"
                    onCancel={() => setConfirmDeleteTemplateId('')}
                    onConfirm={submitDeleteTemplate}
                />
            )}

            {pendingCloseTemplateModal && (
                <ConfirmDialog
                    title="Hủy thay đổi?"
                    message="Bạn có thay đổi chưa lưu. Bạn có muốn đóng modal không?"
                    onCancel={() => setPendingCloseTemplateModal(false)}
                    onConfirm={confirmCloseTemplateModal}
                />
            )}

            {pendingCloseZoneModal && (
                <ConfirmDialog
                    title="Hủy thay đổi?"
                    message="Bạn có thay đổi chưa lưu. Bạn có muốn đóng modal zone không?"
                    onCancel={() => setPendingCloseZoneModal(false)}
                    onConfirm={confirmCloseZoneModal}
                />
            )}

            {Boolean(confirmDeleteZoneId) && (
                <ConfirmDialog
                    title="Xác nhận xóa zone"
                    message="Bạn có chắc chắn muốn xóa zone này?"
                    onCancel={() => setConfirmDeleteZoneId('')}
                    onConfirm={submitDeleteZone}
                />
            )}
        </div>
    );
};

const StatCard = ({ label, value }) => (
    <div className="template-stat-card">
        <p>{label}</p>
        <h3>{value}</h3>
    </div>
);

const TemplateDetailPanel = ({
    detail,
    onStatusChange,
    onCreateZone,
    onEditZone,
    onDeleteZone,
}) => {
    const zones = detail?.zones || [];

    return (
        <div className="template-detail-panel">
            <div className="template-detail-left">
                <img src={detail.baseImages?.[0] || PLACEHOLDER_IMAGE} alt={detail.name || 'template'} className="detail-thumb" />
                <h3>{safeText(detail.name)}</h3>
                <p className="template-subtext">{safeText(detail.material)} / {safeText(detail.style)}</p>
                <p><strong>Giá gốc:</strong> {formatVnd(detail.basePrice)}</p>
                <label className="checkbox-label"><input type="checkbox" checked={detail.isActive} onChange={(e) => onStatusChange(e.target.checked)} /> Hoạt động</label>
            </div>
            <div className="template-detail-right">
                <div className="zones-header-row">
                    <h4>Danh sách zones ({zones.length})</h4>
                    <button type="button" className="btn-outline" onClick={onCreateZone}>+ Thêm vùng</button>
                </div>

                {zones.length === 0 ? (
                    <p className="template-subtext">Chưa có vùng nào.</p>
                ) : (
                    <div className="zone-list">
                        {zones.map((zone) => (
                            <div className="zone-card" key={zone.zoneId}>
                                <div>
                                    <strong>{safeText(zone.zoneName)}</strong> {zone.isRequired && <span className="required-dot" title="Bắt buộc" />}
                                    <p className="template-subtext">{safeText(zone.zoneDescription)}</p>
                                    <div className="zone-meta-badges">
                                        <span className="badge">{zone.inputType}</span>
                                        <span className="badge">+ {formatVnd(zone.extraPrice)}</span>
                                        <span className="badge">Thứ tự: {zone.sortOrder}</span>
                                    </div>
                                </div>
                                <div className="table-actions">
                                    <button type="button" className="action-btn" onClick={() => onEditZone(zone)}>✏</button>
                                    <button type="button" className="action-btn danger" onClick={() => onDeleteZone(zone.zoneId)}>✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}


            </div>
        </div>
    );
};

const ConfirmDialog = ({ title, message, onCancel, onConfirm }) => (
    <div className="template-modal-overlay" onClick={onCancel}>
        <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{title}</h3>
            <p>{message}</p>
            <div className="template-modal-actions">
                <button type="button" className="btn-outline" onClick={onCancel}>Hủy</button>
                <button type="button" className="btn-danger" onClick={onConfirm}>Xóa</button>
            </div>
        </div>
    </div>
);

export default TemplatesView;
