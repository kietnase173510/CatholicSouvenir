import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    FiSearch,
    FiRefreshCw,
    FiPackage,
    FiCheck,
    FiX,
    FiTrash2,
    FiAlertTriangle,
    FiEye,
    FiMoreVertical,
    FiChevronDown,
    FiSliders,
} from 'react-icons/fi';
import productService from '../../services/productService';
import { appToast } from '../../lib/appToast';
import './admin-common.css';
import './ProductManager.css';

const ProductManager = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const [statusModal, setStatusModal] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [statusLoading, setStatusLoading] = useState(false);

    const [deleteModal, setDeleteModal] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [detailProduct, setDetailProduct] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [openActionMenuId, setOpenActionMenuId] = useState(null);
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [actionMenuPlacement, setActionMenuPlacement] = useState({ align: 'right', direction: 'down' });
    const actionMenuRef = useRef(null);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const result = await productService.getProducts();
            if (result.success && Array.isArray(result.data)) {
                setProducts(result.data);
            } else {
                setProducts([]);
                if (result.error) {
                    const msg = typeof result.error === 'string' ? result.error : 'Kiểm tra kết nối mạng';
                    appToast.error('Không tải được', msg);
                }
            }
        } catch (err) {
            const msg = err.message || 'Kiểm tra kết nối mạng';
            appToast.error('Không tải được', msg);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.action-dropdown') && !event.target.closest('.action-menu-portal')) {
                setOpenActionMenuId(null);
                setActionMenuAnchor(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setOpenActionMenuId(null);
                setActionMenuAnchor(null);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const filteredProducts = products.filter((p) => {
        const query = searchTerm.toLowerCase();
        const nameMatch = (p.productName || '').toLowerCase().includes(query);
        const artisanMatch = (p.artisanName || '').toLowerCase().includes(query);
        const matchesSearch = nameMatch || artisanMatch;
        const matchesStatus = statusFilter === 'All' || (p.status || '').toUpperCase() === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const formatPrice = (val) => {
        if (val == null) return '—';
        return typeof val === 'number' ? `${val.toLocaleString('vi-VN')} VNĐ` : `${String(val)} VNĐ`;
    };

    const formatDate = (val) => {
        if (val == null || val === '') return '—';
        try {
            return new Date(val).toLocaleString('vi-VN');
        } catch {
            return String(val);
        }
    };

    const getStatusBadgeClass = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'approved') return 'badge-success';
        if (s === 'rejected') return 'badge-danger';
        return 'badge-warning';
    };

    const statusOptions = ['All', 'PENDING', 'APPROVED', 'REJECTED'];
    const isPending = (p) => (p.status || '').toUpperCase() === 'PENDING';

    const openApproveModal = (p) => {
        setStatusModal({ product: p, action: 'approve' });
        setRejectionReason('');
    };

    const openRejectModal = (p) => {
        setStatusModal({ product: p, action: 'reject' });
        setRejectionReason('');
    };

    const closeStatusModal = () => {
        setStatusModal(null);
        setRejectionReason('');
    };

    const handleStatusSubmit = async () => {
        if (!statusModal?.product?.productId) return;
        if (statusModal.action === 'reject' && !rejectionReason.trim()) {
            appToast.warning('Thiếu thông tin', 'Vui lòng nhập lý do từ chối.');
            return;
        }

        setStatusLoading(true);
        try {
            const payload =
                statusModal.action === 'approve'
                    ? { status: 'APPROVED' }
                    : { status: 'REJECTED', rejectionReason: rejectionReason.trim() };
            const result = await productService.updateProductStatus(statusModal.product.productId, payload);
            if (result.success) {
                setProducts((prev) =>
                    prev.map((p) =>
                        p.productId === statusModal.product.productId ? { ...p, status: payload.status } : p,
                    ),
                );
                appToast.success('Đã cập nhật', statusModal.action === 'approve' ? 'Sản phẩm đã được duyệt' : 'Sản phẩm đã bị từ chối');
                closeStatusModal();
            } else {
                const msg = result.error != null ? String(result.error) : 'Vui lòng thử lại';
                appToast.error('Có lỗi xảy ra', msg);
            }
        } catch (err) {
            const msg = err.message ?? 'Vui lòng thử lại';
            appToast.error('Có lỗi xảy ra', msg);
        } finally {
            setStatusLoading(false);
        }
    };

    const openDetailDrawer = async (product) => {
        if (!product?.productId) return;
        setDetailProduct(null);
        setDetailError('');
        setDetailLoading(true);
        try {
            const result = await productService.getProductById(product.productId);
            if (result.success) {
                setDetailProduct(result.data || product);
            } else {
                setDetailError(result.error || 'Không tải được thông tin sản phẩm.');
                appToast.error('Không tải được', result.error || 'Không tải được thông tin sản phẩm.');
            }
        } catch (err) {
            const msg = err.message || 'Không tải được thông tin sản phẩm.';
            setDetailError(msg);
            appToast.error('Không tải được', msg);
        } finally {
            setDetailLoading(false);
        }
    };

    const closeDetailDrawer = () => {
        if (!detailProduct && !detailLoading && !detailError) return;
        setDetailProduct(null);
        setDetailError('');
        setDetailLoading(false);
    };

    const openDeleteModal = (p) => {
        setDeleteModal(p);
    };

    const openActionMenu = (productId, target) => {
        const rect = target?.getBoundingClientRect?.();
        setOpenActionMenuId(productId);
        if (rect) {
            setActionMenuAnchor({ top: rect.bottom + 8, left: rect.left, width: rect.width });
        } else {
            setActionMenuAnchor(null);
        }
    };

    const closeActionMenu = () => {
        setOpenActionMenuId(null);
        setActionMenuAnchor(null);
        setActionMenuPlacement({ align: 'right', direction: 'down' });
    };


    useEffect(() => {
        if (!actionMenuAnchor || !openActionMenuId) return undefined;
        const menu = actionMenuRef.current;
        if (!menu) return undefined;

        const rect = menu.getBoundingClientRect();
        const margin = 8;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const fitsRight = actionMenuAnchor.left + rect.width <= viewportWidth - margin;
        const fitsLeft = actionMenuAnchor.left + actionMenuAnchor.width - rect.width >= margin;
        const align = fitsRight ? 'right' : fitsLeft ? 'left' : 'right';

        const spaceBelow = viewportHeight - actionMenuAnchor.top;
        const spaceAbove = actionMenuAnchor.top;
        const direction = spaceBelow >= rect.height + margin || spaceBelow >= spaceAbove ? 'down' : 'up';

        setActionMenuPlacement((prev) => (prev.align === align && prev.direction === direction ? prev : { align, direction }));
        if (menu.style.visibility !== 'visible') {
            menu.style.visibility = 'visible';
        }
        return undefined;
    }, [actionMenuAnchor, openActionMenuId]);

    const closeDeleteModal = () => {
        setDeleteModal(null);
    };

    const handleDelete = async () => {
        if (!deleteModal?.productId) return;
        const productName = deleteModal.productName || 'Sản phẩm';
        setDeleteLoading(true);
        try {
            const result = await productService.deleteProduct(deleteModal.productId);
            if (result.success) {
                appToast.success('Đã xóa', `${productName} đã được xóa`);
                setProducts((prev) => prev.filter((p) => p.productId !== deleteModal.productId));
                closeDeleteModal();
            } else {
                const msg = result.error != null ? String(result.error) : 'Vui lòng thử lại';
                appToast.error('Có lỗi xảy ra', msg);
            }
        } catch (err) {
            const msg = err.message ?? 'Vui lòng thử lại';
            appToast.error('Có lỗi xảy ra', msg);
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="admin-page product-manager-page">
            <section className="pm-hero admin-page-header">
                <div className="pm-hero-copy">
                    <div className="pm-breadcrumb">Admin / Product Manager</div>
                    <h1 className="admin-page-title">Quản lý sản phẩm</h1>
                    <p className="admin-page-subtitle">Theo dõi, duyệt và xử lý toàn bộ sản phẩm từ artisan trong một giao diện trực quan hơn.</p>
                </div>
                <div className="pm-hero-actions">
                    <button type="button" className="btn btn-outline btn-icon pm-refresh-btn" onClick={fetchProducts} disabled={loading}>
                        <FiRefreshCw className={loading ? 'spin' : ''} />
                        {loading ? 'Đang tải...' : 'Làm mới'}
                    </button>
                </div>
            </section>

            <section className="pm-toolbar admin-card">
                <div className="pm-search-group">
                    <span className="pm-input-icon"><FiSearch /></span>
                    <input
                        type="text"
                        className="pm-search-input"
                        placeholder="Tìm theo tên sản phẩm hoặc artisan..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="pm-filter-group">
                    <span className="pm-chip-icon"><FiSliders /></span>
                    <select className="pm-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        {statusOptions.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt === 'All' ? 'Tất cả trạng thái' : opt}
                            </option>
                        ))}
                    </select>
                    <FiChevronDown className="pm-select-caret" />
                </div>
            </section>

            <section className="pm-summary-row">
                <div className="pm-summary-card">
                    <span>Tổng sản phẩm</span>
                    <strong>{products.length}</strong>
                </div>
                <div className="pm-summary-card">
                    <span>Đang hiển thị</span>
                    <strong>{filteredProducts.length}</strong>
                </div>
                <div className="pm-summary-card">
                    <span>Chờ duyệt</span>
                    <strong>{products.filter((p) => (p.status || '').toUpperCase() === 'PENDING').length}</strong>
                </div>
            </section>

            <div className="admin-card pm-table-card">
                <div className="table-responsive pm-table-wrap">
                    <table className="admin-table pm-table">
                        <thead>
                            <tr>
                                <th width="56">#</th>
                                <th width="120">Ảnh</th>
                                <th>Sản phẩm</th>
                                <th width="160">Artisan</th>
                                <th width="140">Giá</th>
                                <th width="120">Trạng thái</th>
                                <th width="120" className="text-center">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="empty-state">
                                        <div className="admin-empty-state">
                                            <FiRefreshCw className="spin pm-empty-icon" />
                                            <p>Đang tải...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="empty-state">
                                        <div className="admin-empty-state">
                                            <FiPackage className="pm-empty-icon" />
                                            <h4>Không có sản phẩm</h4>
                                            <p>Thử thay đổi từ khóa hoặc bộ lọc.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((p, index) => (
                                    <tr key={p.productId} className="pm-row">
                                        <td className="text-muted">{index + 1}</td>
                                        <td>
                                            <div className="pm-thumb-cell">
                                                {p.images && p.images.length > 0 ? (
                                                    <img
                                                        src={p.images[0].image_url || p.images[0].imageUrl}
                                                        alt={p.productName || ''}
                                                        className="pm-thumb"
                                                    />
                                                ) : (
                                                    <div className="pm-thumb-placeholder">—</div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="pm-product-cell">
                                                <span className="pm-product-name">{p.productName || '—'}</span>
                                                <span className="pm-product-meta">ID: {p.productId}</span>
                                            </div>
                                        </td>
                                        <td><span className="pm-pill">{p.artisanName || '—'}</span></td>
                                        <td className="pm-price-cell">{formatPrice(p.productPrice)}</td>
                                        <td>
                                            <span className={`status-badge ${getStatusBadgeClass(p.status)}`}>
                                                {p.status || '—'}
                                            </span>
                                        </td>
                                        <td className="text-center action-cell">
                                            <div className="action-dropdown">
                                                <button
                                                    type="button"
                                                    className="btn-action action-trigger"
                                                    title="Mở menu hành động"
                                                    aria-expanded={openActionMenuId === p.productId}
                                                    aria-haspopup="menu"
                                                    onClick={(e) => {
                                                        if (openActionMenuId === p.productId) {
                                                            closeActionMenu();
                                                            return;
                                                        }
                                                        openActionMenu(p.productId, e.currentTarget);
                                                    }}
                                                >
                                                    <FiMoreVertical />
                                                </button>
                                                {openActionMenuId === p.productId && actionMenuAnchor && createPortal(
                                                    <div
                                                        ref={actionMenuRef}
                                                        className="action-menu action-menu-portal"
                                                        role="menu"
                                                        data-align={actionMenuPlacement.align}
                                                        data-direction={actionMenuPlacement.direction}
                                                        style={{
                                                            top: actionMenuPlacement.direction === 'up'
                                                                ? Math.max(8, actionMenuAnchor.top - 8 - 1)
                                                                : actionMenuAnchor.top,
                                                            left: actionMenuPlacement.align === 'left'
                                                                ? Math.max(8, actionMenuAnchor.left + actionMenuAnchor.width - 208)
                                                                : actionMenuAnchor.left,
                                                            visibility: actionMenuPlacement.align && actionMenuPlacement.direction ? 'visible' : 'hidden',
                                                        }}
                                                    >
                                                        <button type="button" className="action-menu-item" onClick={() => { closeActionMenu(); void openDetailDrawer(p); }}>
                                                            <FiEye />
                                                            <span>Xem chi tiết</span>
                                                        </button>
                                                        {isPending(p) && (
                                                            <>
                                                                <button type="button" className="action-menu-item" onClick={() => { openApproveModal(p); closeActionMenu(); }}>
                                                                    <FiCheck />
                                                                    <span>Duyệt</span>
                                                                </button>
                                                                <button type="button" className="action-menu-item" onClick={() => { openRejectModal(p); closeActionMenu(); }}>
                                                                    <FiX />
                                                                    <span>Từ chối</span>
                                                                </button>
                                                            </>
                                                        )}
                                                        <button type="button" className="action-menu-item danger" onClick={() => { openDeleteModal(p); closeActionMenu(); }}>
                                                            <FiTrash2 />
                                                            <span>Xóa</span>
                                                        </button>
                                                    </div>,
                                                    document.body,
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && filteredProducts.length > 0 && (
                    <div className="table-footer pm-table-footer">
                        <span className="showing-text">Hiển thị {filteredProducts.length} / {products.length} sản phẩm</span>
                    </div>
                )}
            </div>

            {(detailLoading || detailProduct || detailError) && (
                <div className="pm-detail-drawer-shell" role="presentation">
                    <div className="pm-detail-drawer-backdrop" onClick={() => { setDetailProduct(null); setDetailError(''); setDetailLoading(false); }} />
                    <aside className="pm-detail-drawer" onClick={(e) => e.stopPropagation()} aria-label="Chi tiết sản phẩm">
                        <div className="pm-detail-drawer-header">
                            <div className="pm-detail-drawer-title-group">
                                <span className="pm-detail-drawer-eyebrow">Admin • Chi tiết sản phẩm</span>
                                <h3>{detailProduct?.productName || 'Chi tiết sản phẩm'}</h3>
                                <p>Xem nhanh thông tin, ảnh, mô tả và tag mà không cần mở modal.</p>
                            </div>
                            <button type="button" className="detail-close" onClick={() => { setDetailProduct(null); setDetailError(''); setDetailLoading(false); }} aria-label="Đóng">
                                &times;
                            </button>
                        </div>

                        <div className="pm-detail-drawer-body">
                            {detailLoading ? (
                                <div className="detail-loading-state">
                                    <div className="detail-loading-spinner"><FiRefreshCw className="spin" /></div>
                                    <div>
                                        <h4>Đang tải thông tin sản phẩm</h4>
                                        <p>Vui lòng chờ trong giây lát.</p>
                                    </div>
                                </div>
                            ) : detailError ? (
                                <div className="detail-error-state">
                                    <FiAlertTriangle />
                                    <h4>Không thể tải chi tiết sản phẩm</h4>
                                    <p>{detailError}</p>
                                </div>
                            ) : detailProduct ? (
                                <>
                                    <div className="pm-detail-preview-panel">
                                        <div className="create-preview-card">
                                            <div className="create-preview-cover">
                                                {detailProduct.images && detailProduct.images.length > 0 ? (
                                                    <img
                                                        src={detailProduct.images[0].image_url || detailProduct.images[0].imageUrl}
                                                        alt={detailProduct.productName || 'Ảnh sản phẩm'}
                                                    />
                                                ) : (
                                                    <div className="create-preview-empty">
                                                        <span>Chưa có ảnh</span>
                                                        <small>Sản phẩm chưa có ảnh đại diện</small>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="create-preview-content">
                                                <div className="create-preview-line create-preview-line--name">{detailProduct.productName || '—'}</div>
                                                <div className="create-preview-line create-preview-line--price">{formatPrice(detailProduct.productPrice)}</div>
                                                <div className="create-preview-meta">
                                                    <span>{detailProduct.size || 'Kích thước'}</span>
                                                    <span>{detailProduct.quantity ?? '—'} tồn kho</span>
                                                    <span>{detailProduct.status || '—'}</span>
                                                </div>
                                                <div className="create-preview-tags">
                                                    {Array.isArray(detailProduct.tags) && detailProduct.tags.length > 0
                                                        ? detailProduct.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)
                                                        : <span>Chưa có tag</span>}
                                                </div>
                                            </div>
                                        </div>
                                        {detailProduct.images && detailProduct.images.length > 1 && (
                                            <div className="pm-detail-thumbs">
                                                {detailProduct.images.map((img, i) => (
                                                    <button key={img.id || i} type="button" className={`pm-detail-thumb ${i === 0 ? 'active' : ''}`}>
                                                        <img src={img.image_url || img.imageUrl} alt={`${detailProduct.productName || 'Ảnh sản phẩm'} ${i + 1}`} />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pm-detail-info-panel">
                                        <div className="detail-summary-grid pm-summary-grid">
                                            <div className="detail-summary-card">
                                                <span className="detail-label">Giá</span>
                                                <strong>{formatPrice(detailProduct.productPrice)}</strong>
                                            </div>
                                            <div className="detail-summary-card">
                                                <span className="detail-label">Trạng thái</span>
                                                <span className={`status-badge ${getStatusBadgeClass(detailProduct.status)}`}>
                                                    {detailProduct.status || '—'}
                                                </span>
                                            </div>
                                            <div className="detail-summary-card">
                                                <span className="detail-label">Số lượng</span>
                                                <strong>{detailProduct.quantity ?? '—'}</strong>
                                            </div>
                                            <div className="detail-summary-card">
                                                <span className="detail-label">Kích thước</span>
                                                <strong>{detailProduct.size || '—'}</strong>
                                            </div>
                                        </div>

                                        <div className="detail-section pm-detail-section">
                                            <div className="detail-section-title">Thông tin cơ bản</div>
                                            <div className="detail-fields-grid pm-detail-grid">
                                                <div className="detail-row">
                                                    <span className="detail-label">Mã sản phẩm</span>
                                                    <span className="detail-value detail-code">{detailProduct.productId || '—'}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">Danh mục</span>
                                                    <span className="detail-value">{detailProduct.categoryName || '—'}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">Tên sản phẩm</span>
                                                    <span className="detail-value">{detailProduct.productName || '—'}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">Artisan</span>
                                                    <span className="detail-value">{detailProduct.artisanName || '—'}</span>
                                                </div>
                                                <div className="detail-row detail-row-full">
                                                    <span className="detail-label">Mô tả</span>
                                                    <span className="detail-value detail-description">{detailProduct.productDescription || '—'}</span>
                                                </div>
                                                <div className="detail-row detail-row-full">
                                                    <span className="detail-label">Tags</span>
                                                    <span className="detail-value detail-tags">
                                                        {Array.isArray(detailProduct.tags) && detailProduct.tags.length > 0
                                                            ? detailProduct.tags.map((tag) => <span key={tag} className="detail-tag">{tag}</span>)
                                                            : '—'}
                                                    </span>
                                                </div>
                                                <div className="detail-row detail-row-full">
                                                    <span className="detail-label">Ngày tạo</span>
                                                    <span className="detail-value">{formatDate(detailProduct.createdAt)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </aside>
                </div>
            )}

            {statusModal && (
                <div className="detail-overlay pm-overlay" onClick={closeStatusModal} role="presentation">
                    <div className="detail-modal pm-confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="detail-modal-header">
                            <h3>{statusModal.action === 'approve' ? 'Duyệt sản phẩm' : 'Từ chối sản phẩm'}</h3>
                            <button type="button" className="detail-close" onClick={closeStatusModal} aria-label="Đóng">&times;</button>
                        </div>
                        <div className="detail-modal-body">
                            <p className="pm-confirm-text">
                                Sản phẩm: <strong>{statusModal.product.productName}</strong>
                            </p>
                            {statusModal.action === 'reject' && (
                                <div className="detail-row">
                                    <label className="detail-label">Lý do từ chối <span className="required">*</span></label>
                                    <textarea
                                        className="detail-edit-input"
                                        rows={4}
                                        placeholder="Nhập lý do từ chối..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="detail-modal-footer">
                            <button type="button" className="btn btn-outline" onClick={closeStatusModal} disabled={statusLoading}>Hủy</button>
                            <button
                                type="button"
                                className={`btn ${statusModal.action === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                                onClick={handleStatusSubmit}
                                disabled={statusLoading || (statusModal.action === 'reject' && !rejectionReason.trim())}
                            >
                                {statusLoading ? 'Đang xử lý...' : statusModal.action === 'approve' ? 'Duyệt' : 'Từ chối'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteModal && (
                <div className="detail-overlay pm-overlay" style={{ zIndex: 1100 }} role="presentation">
                    <div className="detail-modal pm-delete-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="detail-modal-header">
                            <h3 className="pm-danger-title"><FiAlertTriangle /> Xác nhận xóa</h3>
                            <button type="button" className="detail-close" onClick={closeDeleteModal} disabled={deleteLoading} aria-label="Đóng">&times;</button>
                        </div>
                        <div className="detail-modal-body">
                            <p className="pm-confirm-text">
                                Bạn có chắc chắn muốn xóa sản phẩm <strong>{deleteModal.productName}</strong>?
                                <br />
                                Hành động này <strong>không thể hoàn tác</strong>.
                            </p>
                        </div>
                        <div className="detail-modal-footer">
                            <button type="button" className="btn btn-outline" onClick={closeDeleteModal} disabled={deleteLoading}>Hủy</button>
                            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleteLoading}>
                                <FiTrash2 style={{ marginRight: 4 }} />
                                {deleteLoading ? 'Đang xóa...' : 'Xóa sản phẩm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductManager;
