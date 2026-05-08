import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { appToast } from '../../lib/appToast';
import complaintService from '../../services/complaintService';
import './AdminRefundTransactionsPage.css';

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIALLY_REFUNDED'];
const STATUS_LABELS = {
  PENDING: 'Chờ xử lý',
  PROCESSING: 'Đang xử lý (3–7 ngày)',
  COMPLETED: 'Hoàn thành',
  FAILED: 'Thất bại',
  PARTIALLY_REFUNDED: 'Hoàn tiền một phần',
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—');
const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;
const translateStatus = (status) => STATUS_LABELS[String(status || '').toUpperCase()] || status || '—';

const AdminRefundTransactionsPage = () => {
  const { isAuthenticated, user } = useAuth();
  const role = String(user?.role || '').toUpperCase();
  const canView = role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [retryingId, setRetryingId] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const res = await complaintService.getAdminRefundTransactions({ status: statusFilter || undefined, page, size: PAGE_SIZE });
    if (!res.success) {
      appToast.error('Không tải được danh sách hoàn tiền', res.error || 'Vui lòng thử lại');
      setItems([]);
      setTotalPages(1);
    } else {
      const data = res.data || {};
      const rawItems = Array.isArray(data.content) ? data.content : complaintService.toArray(data);
      const sortedItems = [...rawItems].sort((a, b) => {
        const dateA = dayjs(a?.createdAt || 0).valueOf();
        const dateB = dayjs(b?.createdAt || 0).valueOf();
        return sortOrder === 'oldest' ? dateA - dateB : dateB - dateA;
      });
      setItems(sortedItems);
      setTotalPages(Number(data.totalPages || 1));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && canView) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, canView, page, statusFilter, sortOrder]);

  const stats = useMemo(() => {
    const failed = items.filter((i) => String(i.status).toUpperCase() === 'FAILED').length;
    const processing = items.filter((i) => String(i.status).toUpperCase() === 'PROCESSING').length;
    const completed = items.filter((i) => String(i.status).toUpperCase() === 'COMPLETED').length;
    return { total: items.length, failed, processing, completed };
  }, [items]);

  const handleRetry = async (id) => {
    setRetryingId(id);
    const res = await complaintService.retryAdminRefundTransaction(id);
    setRetryingId('');
    if (!res.success) return appToast.error('Thử lại thất bại', res.error || 'Vui lòng thử lại');
    appToast.success('Đã gửi yêu cầu thử lại hoàn tiền');
    await loadData();
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!canView) return <Navigate to="/" replace />;

  return (
    <div className="admin-refund-page">
      <header className="admin-refund-hero">
        <div>
          <p className="admin-refund-kicker">Dịch vụ & hỗ trợ</p>
          <h1>Giao dịch hoàn tiền</h1>
          <p className="admin-refund-description">Theo dõi các giao dịch hoàn tiền, lọc theo trạng thái và xử lý nhanh các giao dịch thất bại.</p>
        </div>

        <div className="admin-refund-stats">
          <div className="admin-refund-stat-card">
            <span>Tổng giao dịch</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="admin-refund-stat-card warning">
            <span>Thất bại</span>
            <strong>{stats.failed}</strong>
          </div>
          <div className="admin-refund-stat-card">
            <span>Đang xử lý</span>
            <strong>{stats.processing}</strong>
          </div>
          <div className="admin-refund-stat-card success">
            <span>Hoàn thành</span>
            <strong>{stats.completed}</strong>
          </div>
        </div>
      </header>

      <section className="admin-refund-toolbar">
        <div>
          <h2>Bộ lọc</h2>
          <p>Chọn trạng thái giao dịch để thu hẹp danh sách.</p>
        </div>
        <div className="admin-refund-toolbar-controls">
          <label className="admin-refund-control">
            <span>Sắp xếp</span>
            <select value={sortOrder} onChange={(e) => { setPage(0); setSortOrder(e.target.value); }}>
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
          </label>
          <label className="admin-refund-control">
            <span>Trạng thái</span>
            <select value={statusFilter} onChange={(e) => { setPage(0); setStatusFilter(e.target.value); }}>
              <option value="">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="admin-refund-list">
        {loading ? (
          <div className="admin-refund-empty">Đang tải...</div>
        ) : items.length === 0 ? (
          <div className="admin-refund-empty">Chưa có giao dịch nào</div>
        ) : items.map((item) => {
          const status = String(item.status || '').toUpperCase();
          return (
            <article key={item.refundTransactionId} className={`admin-refund-card ${status === 'FAILED' ? 'is-danger' : ''}`}>
              <div className="admin-refund-card-head">
                <div>
                  <p>Mã giao dịch</p>
                  <strong>{item.refundTransactionId || '—'}</strong>
                </div>
                <span className={`admin-refund-badge status-${status.toLowerCase() || 'unknown'}`}>{translateStatus(item.status)}</span>
              </div>

              <div className="admin-refund-card-body">
                <div>
                  <span>Số tiền</span>
                  <strong>{formatMoney(item.amount)}</strong>
                </div>
                <div>
                  <span>VNPay refund ID</span>
                  <strong>{item.vnpayRefundId || '—'}</strong>
                </div>
                <div>
                  <span>VNPay Txn No</span>
                  <strong>{item.vnpayTransactionNo || '—'}</strong>
                </div>
                <div>
                  <span>Ngày tạo</span>
                  <strong>{formatDateTime(item.createdAt)}</strong>
                </div>
                <div className="full-width">
                  <span>Lý do lỗi</span>
                  <strong>{item.failureReason || '—'}</strong>
                </div>
              </div>

              <div className="admin-refund-card-actions">
                <button type="button" className="admin-refund-btn ghost" onClick={() => setSelectedItem(item)}>Xem chi tiết</button>
                {status === 'FAILED' && (
                  <button
                    type="button"
                    className="admin-refund-btn danger"
                    onClick={() => handleRetry(item.refundTransactionId)}
                    disabled={retryingId === item.refundTransactionId}
                  >
                    {retryingId === item.refundTransactionId ? 'Đang gửi...' : 'Thử lại'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <footer className="admin-refund-pagination">
        <button type="button" disabled={page <= 0} onClick={() => setPage((v) => v - 1)}>Trước</button>
        <span>Trang {page + 1}/{totalPages}</span>
        <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((v) => v + 1)}>Sau</button>
      </footer>

      {selectedItem && (
        <div className="admin-refund-modal-backdrop" onClick={() => setSelectedItem(null)} role="presentation">
          <div className="admin-refund-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="refund-detail-title">
            <div className="admin-refund-modal-header">
              <div>
                <p className="admin-refund-kicker">Chi tiết giao dịch</p>
                <h2 id="refund-detail-title">{selectedItem.refundTransactionId || '—'}</h2>
              </div>
              <button type="button" className="admin-refund-close" onClick={() => setSelectedItem(null)} aria-label="Đóng">×</button>
            </div>

            <div className="admin-refund-modal-grid">
              <div><span>Trạng thái</span><strong>{translateStatus(selectedItem.status)}</strong></div>
              <div><span>Số tiền</span><strong>{formatMoney(selectedItem.amount)}</strong></div>
              <div><span>VNPay refund ID</span><strong>{selectedItem.vnpayRefundId || '—'}</strong></div>
              <div><span>VNPay Txn No</span><strong>{selectedItem.vnpayTransactionNo || '—'}</strong></div>
              <div><span>Ngày tạo</span><strong>{formatDateTime(selectedItem.createdAt)}</strong></div>
              <div className="full-width"><span>Lý do lỗi</span><strong>{selectedItem.failureReason || '—'}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRefundTransactionsPage;
