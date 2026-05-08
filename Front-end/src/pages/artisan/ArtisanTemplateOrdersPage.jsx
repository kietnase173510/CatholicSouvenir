import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiGrid, FiLayers, FiPackage, FiTag, FiUser } from 'react-icons/fi';
import { appToast } from '../../lib/appToast';
import { getArtisanTemplates } from '../../services/templateService';
import './ArtisanOrdersPage.css';

const PAGE_SIZE = 10;

const formatCurrency = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} đ`;
const formatDate = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString('vi-VN');
    } catch {
        return value;
    }
};

const ArtisanTemplateOrdersPage = () => {
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState([]);
    const [page, setPage] = useState(0);
    const [pageInfo, setPageInfo] = useState({ totalPages: 0, totalElements: 0, number: 0 });

    const fetchTemplates = useCallback(async (nextPage = page) => {
        setLoading(true);
        const res = await getArtisanTemplates({ page: nextPage, size: PAGE_SIZE });
        setLoading(false);

        if (!res.success) {
            setTemplates([]);
            setPageInfo({ totalPages: 0, totalElements: 0, number: nextPage });
            appToast.error('Không tải được danh sách template', res.error || 'Vui lòng thử lại');
            return;
        }

        const data = res.data || {};
        setTemplates(Array.isArray(data.content) ? data.content : []);
        setPageInfo({
            totalPages: Number(data.totalPages || 0),
            totalElements: Number(data.totalElements || 0),
            number: Number(data.number || nextPage),
        });
    }, [page]);

    useEffect(() => {
        const timer = setTimeout(() => fetchTemplates(page), 0);
        return () => clearTimeout(timer);
    }, [fetchTemplates, page]);

    const summaryText = useMemo(() => {
        if (!pageInfo.totalElements) return 'Hiển thị 0 template';
        const from = pageInfo.number * PAGE_SIZE + 1;
        const to = Math.min((pageInfo.number + 1) * PAGE_SIZE, pageInfo.totalElements);
        return `Hiển thị ${from}–${to} trong tổng ${pageInfo.totalElements} template`;
    }, [pageInfo]);

    return (
        <div className="artisan-orders-page modern-artisan-orders">
            <header className="artisan-orders-header">
                <div>
                    <p className="page-kicker">Quản lý đơn hàng Template</p>
                    <h1>Đơn hàng Template</h1>
                    <p className="page-subtitle">Theo dõi danh sách mẫu do artisan tạo ra, trạng thái, giá cơ bản và thông tin template.</p>
                </div>
            </header>

            <section className="orders-summary-grid">
                <article className="summary-card">
                    <span className="summary-icon"><FiGrid /></span>
                    <div>
                        <p>Tổng template</p>
                        <strong>{pageInfo.totalElements}</strong>
                    </div>
                </article>
                <article className="summary-card">
                    <span className="summary-icon summary-icon-progress"><FiPackage /></span>
                    <div>
                        <p>Trang hiện tại</p>
                        <strong>{pageInfo.number + 1}</strong>
                    </div>
                </article>
                <article className="summary-card">
                    <span className="summary-icon summary-icon-completed"><FiTag /></span>
                    <div>
                        <p>Đang hiển thị</p>
                        <strong>{templates.length}</strong>
                    </div>
                </article>
                <article className="summary-card">
                    <span className="summary-icon summary-icon-cancelled"><FiLayers /></span>
                    <div>
                        <p>Phân trang</p>
                        <strong>{pageInfo.totalPages || 1}</strong>
                    </div>
                </article>
            </section>

            <div className="orders-pagination-summary">
                <span>{summaryText}</span>
                <div className="orders-pagination-actions">
                    <button type="button" className="btn btn-outline btn-sm" disabled={page <= 0 || loading} onClick={() => setPage((prev) => prev - 1)}>
                        <FiChevronLeft /> Trước
                    </button>
                    <span>Trang {pageInfo.number + 1}/{Math.max(pageInfo.totalPages, 1)}</span>
                    <button type="button" className="btn btn-outline btn-sm" disabled={loading || page + 1 >= pageInfo.totalPages} onClick={() => setPage((prev) => prev + 1)}>
                        Sau <FiChevronRight />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="list-grid">{[1, 2, 3].map((item) => <div key={item} className="artisan-skeleton-card" />)}</div>
            ) : templates.length === 0 ? (
                <div className="artisan-empty">Chưa có template nào.</div>
            ) : (
                <div className="list-grid">
                    {templates.map((template) => {
                        const id = template?.templateId ?? template?.id;
                        return (
                            <article key={String(id)} className="order-card unified-card">
                                <header className="card-header-block">
                                    <div className="card-title-row">
                                        <h3 title={template?.name || 'Template'}>{template?.name || 'Template'}</h3>
                                        <span className={`status-badge ${template?.isActive ? 'completed' : 'cancelled'}`}>{template?.isActive ? 'Đang hoạt động' : 'Tạm ẩn'}</span>
                                    </div>
                                    <div className="card-meta-row">
                                        <span><FiCalendar /> {formatDate(template?.createdAt)}</span>
                                        <span><FiUser /> {template?.artisanName || 'Nghệ nhân'}</span>
                                        <strong>{formatCurrency(template?.basePrice)}</strong>
                                    </div>
                                </header>

                                <div className="card-body-block">
                                    <p className="card-description">{template?.description || '—'}</p>
                                    <div className="card-compact-stat">
                                        {template?.zoneCount || 0} zone • {template?.material || '—'}
                                    </div>
                                    <div className="card-avatar-row">
                                        <div className="card-avatar">{String(template?.name || 'TM').trim().slice(0, 2).toUpperCase()}</div>
                                        <div>
                                            <strong>{template?.style || '—'}</strong>
                                            <p>{template?.categoryId || '—'}</p>
                                        </div>
                                    </div>
                                </div>

                                <footer className="card-footer-block">
                                    <div className="card-footer-meta">
                                        <span>ID: {String(id || '').slice(0, 8)}</span>
                                    </div>
                                </footer>
                            </article>
                        );
                    })}
                </div>
            )}

            <div className="orders-pagination-summary orders-pagination-summary--bottom">
                <span>{summaryText}</span>
                <div className="orders-pagination-actions">
                    <button type="button" className="btn btn-outline btn-sm" disabled={page <= 0 || loading} onClick={() => setPage((prev) => prev - 1)}>
                        <FiChevronLeft /> Trước
                    </button>
                    <span>Trang {pageInfo.number + 1}/{Math.max(pageInfo.totalPages, 1)}</span>
                    <button type="button" className="btn btn-outline btn-sm" disabled={loading || page + 1 >= pageInfo.totalPages} onClick={() => setPage((prev) => prev + 1)}>
                        Sau <FiChevronRight />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ArtisanTemplateOrdersPage;
