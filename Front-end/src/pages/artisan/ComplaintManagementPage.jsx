import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiMessageSquare, FiRefreshCw, FiTruck, FiUser } from 'react-icons/fi';
import { appToast } from '../../lib/appToast';
import { confirmReturnShipment, getArtisanComplaintDetail, getArtisanComplaints, respondToComplaint } from '../../services/complaintService';
import './ComplaintManagementPage.css';

const PAGE_SIZE = 10;

const STATUS_META = {
    PENDING: { label: 'Chờ phản hồi', className: 'status-pending' },
    APPROVED: { label: 'Đã chấp nhận', className: 'status-approved' },
    REJECTED: { label: 'Đã từ chối', className: 'status-rejected' },
    RETURN_PENDING: { label: 'Chờ trả hàng', className: 'status-return' },
    REFUND_PROCESSING: { label: 'Đang hoàn tiền', className: 'status-refund' },
    REFUNDED: { label: 'Đã hoàn tiền', className: 'status-refunded' },
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—');

const ComplaintManagementPage = ({ embedded = false }) => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(0);
    const [pageInfo, setPageInfo] = useState({ totalPages: 0, totalElements: 0, number: 0 });
    const [sortOrder, setSortOrder] = useState('DESC');
    const [statusSort, setStatusSort] = useState('ALL');
    const [statusSortOrder, setStatusSortOrder] = useState('ASC');
    const [selected, setSelected] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [detailMode, setDetailMode] = useState('view');
    const [responseText, setResponseText] = useState('');
    const [requireReturn, setRequireReturn] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const loadData = async (nextPage = page) => {
        setLoading(true);
        const res = await getArtisanComplaints({ page: nextPage, size: PAGE_SIZE, sort: `createdAt,${sortOrder.toLowerCase()}`, status: statusSort === 'ALL' ? undefined : statusSort, statusSort: statusSort === 'ALL' ? undefined : `status,${statusSortOrder.toLowerCase()}` });
        if (!res.success) {
            appToast.error('Không tải được danh sách khiếu nại', res.error || 'Vui lòng thử lại');
            setItems([]);
            setPageInfo({ totalPages: 0, totalElements: 0, number: nextPage });
            setLoading(false);
            return;
        }

        const data = res.data || {};
        setItems(Array.isArray(data.content) ? data.content : []);
        setPageInfo({
            totalPages: Number(data.totalPages || 0),
            totalElements: Number(data.totalElements || 0),
            number: Number(data.number || nextPage),
        });
        setLoading(false);
    };

    useEffect(() => {
        loadData(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, sortOrder, statusSort]);

    const paginationText = useMemo(() => {
        if (!pageInfo.totalElements) return 'Hiển thị 0 khiếu nại';
        const from = pageInfo.number * PAGE_SIZE + 1;
        const to = Math.min((pageInfo.number + 1) * PAGE_SIZE, pageInfo.totalElements);
        return `Hiển thị ${from}–${to} trong tổng ${pageInfo.totalElements} khiếu nại`;
    }, [pageInfo]);

    const openDetail = async (item) => {
        setSelected(item);
        setDetailLoading(true);
        setPreviewImage('');
        setDetailMode('view');
        setResponseText(item?.artisanResponse || '');
        setRequireReturn(Boolean(item?.requireReturn));

        const res = await getArtisanComplaintDetail(item?.complaintId);
        if (res.success) {
            const detail = res.data || item;
            setSelected({ ...item, ...detail });
            setResponseText(detail?.artisanResponse || item?.artisanResponse || '');
            setRequireReturn(Boolean(detail?.requireReturn ?? item?.requireReturn));
        } else {
            appToast.error('Không tải được chi tiết khiếu nại', res.error || 'Vui lòng thử lại');
        }
        setDetailLoading(false);
    };

    const handleSubmitResponse = async () => {
        if (!selected?.complaintId) return;
        if (!responseText.trim()) {
            appToast.error('Thiếu nội dung phản hồi', 'Vui lòng nhập phản hồi cho khách hàng.');
            return;
        }

        setSubmitting(true);
        const res = await respondToComplaint(selected.complaintId, {
            response: responseText.trim(),
            requireReturn,
        });
        setSubmitting(false);

        if (!res.success) {
            appToast.error('Phản hồi thất bại', res.error || 'Vui lòng thử lại');
            return;
        }

        appToast.success('Đã gửi phản hồi khiếu nại');
        setSelected(res.data || selected);
        setDetailMode('view');
        loadData(page);
    };

    const handleConfirmReturnShipment = async (shipmentId) => {
        if (!shipmentId) return;
        setSubmitting(true);
        const res = await confirmReturnShipment(shipmentId);
        setSubmitting(false);
        if (!res.success) {
            appToast.error('Xác nhận vận đơn thất bại', res.error || 'Vui lòng thử lại');
            return;
        }
        appToast.success('Đã xác nhận vận đơn hoàn trả');
    };

    return (
        <div className={`artisan-complaint-page ${embedded ? 'artisan-complaint-page--embedded' : ''}`}>
            <div className="artisan-complaint-header">
                <div>
                    <p className="eyebrow">artisan-complaint-controller</p>
                    <h1>Quản lý khiếu nại</h1>
                    <p>Phản hồi khiếu nại từ khách hàng và xử lý yêu cầu hoàn trả.</p>
                </div>
                <button type="button" className="btn btn-outline" onClick={() => loadData(page)}>
                    <FiRefreshCw /> Làm mới
                </button>
            </div>

            <section className="artisan-complaint-summary">
                <div className="summary-card"><span>Tổng khiếu nại</span><strong>{pageInfo.totalElements}</strong></div>
                <div className="summary-card"><span>Trang hiện tại</span><strong>{pageInfo.number + 1}</strong></div>
                <div className="summary-card"><span>Chưa phản hồi</span><strong>{items.filter((i) => String(i.status || '').toUpperCase() === 'PENDING').length}</strong></div>
            </section>

            <section className="artisan-complaint-list-card">
                <div className="list-head">
                    <div>
                        <h2>Danh sách khiếu nại</h2>
                        <span>{paginationText}</span>
                    </div>
                    <div className="list-head__controls">
                        <select
                            className="artisan-complaint-sort"
                            value={sortOrder}
                            onChange={(e) => {
                                setPage(0);
                                setSortOrder(e.target.value);
                            }}
                        >
                            <option value="DESC">Mới nhất</option>
                            <option value="ASC">Cũ nhất</option>
                        </select>
                        <select
                            className="artisan-complaint-sort"
                            value={statusSort}
                            onChange={(e) => {
                                setPage(0);
                                setStatusSort(e.target.value);
                            }}
                        >
                            <option value="ALL">Tất cả trạng thái</option>
                            {Object.keys(STATUS_META).map((status) => (
                                <option key={status} value={status}>{STATUS_META[status].label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="empty-state">Đang tải dữ liệu...</div>
                ) : items.length === 0 ? (
                    <div className="empty-state">Chưa có khiếu nại nào.</div>
                ) : (
                    <div className="complaint-grid">
                        {items.map((item) => {
                            const status = String(item.status || 'PENDING').toUpperCase();
                            const meta = STATUS_META[status] || { label: status, className: 'status-default' };
                            return (
                                <button key={item.complaintId} type="button" className="complaint-card" onClick={() => openDetail(item)}>
                                    <div className="card-top">
                                        <strong>{item.customerName || 'Khách hàng'}</strong>
                                        <span className={meta.className}>{meta.label}</span>
                                    </div>
                                    <p className="reason">{item.reason || '—'}</p>
                                    <div className="meta-row">
                                        <span><FiUser /> {item.customerName || '—'}</span>
                                        <span><FiClock /> {formatDateTime(item.createdAt)}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="pagination-row">
                    <button type="button" className="btn btn-outline btn-sm" disabled={page <= 0 || loading} onClick={() => setPage((prev) => prev - 1)}>
                        <FiChevronLeft /> Trước
                    </button>
                    <span>Trang {pageInfo.number + 1}/{Math.max(pageInfo.totalPages, 1)}</span>
                    <button type="button" className="btn btn-outline btn-sm" disabled={loading || page + 1 >= pageInfo.totalPages} onClick={() => setPage((prev) => prev + 1)}>
                        Sau <FiChevronRight />
                    </button>
                </div>
            </section>

            {selected && (
                <div className="complaint-modal-overlay" onClick={() => setSelected(null)}>
                    <div className="complaint-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="complaint-modal-title">
                        <div className="modal-head">
                            <div>
                                <p className="eyebrow">Chi tiết khiếu nại</p>
                                <h2 id="complaint-modal-title">#{String(selected.complaintId || '').slice(0, 8)}</h2>
                            </div>
                            <button type="button" className="modal-close" onClick={() => setSelected(null)}>×</button>
                        </div>

                        <div className="modal-scroll">
                            {detailLoading ? (
                                <div className="empty-state">Đang tải chi tiết khiếu nại...</div>
                            ) : (
                                <>
                                    <div className="detail-grid">
                                        <div className="detail-box"><span>Khách hàng</span><strong>{selected.customerName || '—'}</strong><p>{selected.customerEmail || '—'}</p></div>
                                        <div className="detail-box"><span>Đơn hàng</span><strong>{selected.orderId || '—'}</strong><p>{selected.customOrderId || 'Không phải đơn tùy chỉnh'}</p></div>
                                        <div className="detail-box"><span>Trạng thái</span><strong>{STATUS_META[String(selected.status || '').toUpperCase()]?.label || selected.status || '—'}</strong></div>
                                        <div className="detail-box"><span>Số tiền hoàn</span><strong>{new Intl.NumberFormat('vi-VN').format(Number(selected.refundAmount || 0))} đ</strong></div>
                                        <div className="detail-box"><span>Thời gian</span><strong>{formatDateTime(selected.createdAt)}</strong><p>Cập nhật: {formatDateTime(selected.updatedAt)}</p></div>
                                        <div className="detail-box wide"><span>Lý do khiếu nại</span><p>{selected.reason || '—'}</p></div>
                                    </div>

                                    <section className="detail-panel">
                                        <div className="detail-panel__head">
                                            <h3>Ảnh bằng chứng</h3>
                                            <span>{Array.isArray(selected.evidenceImages) ? selected.evidenceImages.length : 0} ảnh</span>
                                        </div>
                                        {Array.isArray(selected.evidenceImages) && selected.evidenceImages.length > 0 ? (
                                            <div className="evidence-grid">
                                                {selected.evidenceImages.map((url, idx) => (
                                                    <button
                                                        key={`${url}-${idx}`}
                                                        type="button"
                                                        className="evidence-thumb"
                                                        onClick={() => setPreviewImage(url)}
                                                    >
                                                        <img src={url} alt={`Bằng chứng ${idx + 1}`} />
                                                        <span>Xem</span>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="detail-empty">Chưa có ảnh bằng chứng.</p>
                                        )}
                                    </section>

                                    <section className="detail-panel">
                                        <div className="detail-panel__head">
                                            <h3>Phản hồi artisan</h3>
                                        </div>
                                        {detailMode === 'edit' ? (
                                            <div className="response-box">
                                                <label>
                                                    <span>Nội dung phản hồi</span>
                                                    <textarea rows="5" value={responseText} onChange={(e) => setResponseText(e.target.value)} />
                                                </label>
                                                {/* <label className="checkbox-row">
                                                    <input type="checkbox" checked={requireReturn} onChange={(e) => setRequireReturn(e.target.checked)} />
                                                    <span>Yêu cầu khách trả hàng</span>
                                                </label> */}
                                            </div>
                                        ) : (
                                            <p className="detail-empty">{selected.artisanResponse || 'Chưa có phản hồi.'}</p>
                                        )}
                                    </section>
                                </>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setSelected(null)}>
                                Đóng
                            </button>
                            {detailMode === 'view' ? (
                                <button type="button" className="btn btn-primary" onClick={() => setDetailMode('edit')}>
                                    <FiMessageSquare /> Phản hồi
                                </button>
                            ) : (
                                <>
                                    <button type="button" className="btn btn-outline" onClick={() => setDetailMode('view')}>
                                        Huỷ chỉnh sửa
                                    </button>
                                    <button type="button" className="btn btn-primary" onClick={handleSubmitResponse} disabled={submitting}>
                                        <FiCheckCircle /> {submitting ? 'Đang gửi...' : 'Gửi phản hồi'}
                                    </button>
                                </>
                            )}
                            {selected.customOrderId && (
                                <button type="button" className="btn btn-outline" onClick={() => handleConfirmReturnShipment(selected.customOrderId)} disabled={submitting}>
                                    <FiTruck /> Xác nhận vận đơn hoàn trả
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {previewImage && (
                <div className="complaint-image-viewer" onClick={() => setPreviewImage('')}>
                    <div className="complaint-image-viewer__panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <button type="button" className="modal-close complaint-image-viewer__close" onClick={() => setPreviewImage('')}>×</button>
                        <img src={previewImage} alt="Ảnh bằng chứng phóng to" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComplaintManagementPage;
