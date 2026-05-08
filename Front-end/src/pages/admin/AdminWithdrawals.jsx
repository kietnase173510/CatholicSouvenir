import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Navigate } from 'react-router-dom';
import { FiSearch, FiRefreshCw, FiFilter, FiChevronLeft, FiChevronRight, FiAlertCircle, FiX } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { appToast } from '../../lib/appToast';
import adminWithdrawalService from '../../services/adminWithdrawalService';
import './admin-common.css';
import './AdminWithdrawals.css';

const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'];

const formatCurrency = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} đ`;
const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—');

const getStatusLabel = (status) => {
  switch (String(status || '').toUpperCase()) {
    case 'PENDING': return 'Chờ duyệt';
    case 'APPROVED': return 'Đã duyệt';
    case 'REJECTED': return 'Từ chối';
    case 'PAID': return 'Đã chi trả';
    default: return status || '—';
  }
};

const AdminWithdrawals = () => {
  const { user, isAuthenticated } = useAuth();
  const role = String(user?.role || user?.roleName || '').toUpperCase();
  const isAdmin = role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState({ status: '', artisanName: '', fromDate: '', toDate: '', page: 0, size: 10 });
  const [pageData, setPageData] = useState({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, first: true, last: true });
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [approveNote, setApproveNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const loadData = async (nextFilters = filters) => {
    setLoading(true);
    const response = await adminWithdrawalService.getWithdrawalsApi(nextFilters);
    if (!response.success) {
      appToast.error(response.error || 'Không tải được danh sách rút tiền');
      setPageData({ content: [], totalElements: 0, totalPages: 0, number: nextFilters.page || 0, size: nextFilters.size || 10, first: true, last: true });
    } else {
      setPageData(response.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAdmin]);

  const withdrawals = useMemo(() => pageData.content || [], [pageData]);

  const applyFilters = (patch = {}) => {
    const next = { ...filters, ...patch, page: 0 };
    setFilters(next);
    loadData(next);
  };

  const handlePageChange = (delta) => {
    const nextPage = Math.max(0, (filters.page || 0) + delta);
    const next = { ...filters, page: nextPage };
    setFilters(next);
    loadData(next);
  };

  const resetFilters = () => {
    const next = { status: '', artisanName: '', fromDate: '', toDate: '', page: 0, size: 10 };
    setSearchDraft('');
    setFilters(next);
    loadData(next);
  };

  const openDetail = async (withdrawalId) => {
    if (!withdrawalId) return;
    setDetailLoading(true);
    const response = await adminWithdrawalService.getWithdrawalDetailApi(withdrawalId);
    setDetailLoading(false);

    if (!response.success) {
      appToast.error(response.error || 'Không tải được chi tiết rút tiền');
      return;
    }

    setSelectedWithdrawal(response.data);
    setApproveNote('');
    setRejectReason('');
  };

  const refreshDetail = async () => {
    if (!selectedWithdrawal?.withdrawalId) return;
    await openDetail(selectedWithdrawal.withdrawalId);
  };

  const submitApprove = async () => {
    if (!selectedWithdrawal?.withdrawalId) return;
    setActionLoading(true);
    const response = await adminWithdrawalService.approveWithdrawalApi(selectedWithdrawal.withdrawalId, { note: approveNote.trim() });
    setActionLoading(false);

    if (!response.success) {
      appToast.error(response.error || 'Phê duyệt thất bại');
      return;
    }

    appToast.success('Đã phê duyệt yêu cầu rút tiền');
    setSelectedWithdrawal(response.data || null);
    await loadData(filters);
  };

  const submitReject = async () => {
    if (!selectedWithdrawal?.withdrawalId) return;
    if (!rejectReason.trim()) {
      appToast.error('Vui lòng nhập lý do từ chối');
      return;
    }

    setActionLoading(true);
    const response = await adminWithdrawalService.rejectWithdrawalApi(selectedWithdrawal.withdrawalId, { rejectionReason: rejectReason.trim() });
    setActionLoading(false);

    if (!response.success) {
      appToast.error(response.error || 'Từ chối thất bại');
      return;
    }

    appToast.success('Đã từ chối yêu cầu rút tiền');
    setSelectedWithdrawal(response.data || null);
    await loadData(filters);
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="admin-page admin-withdrawals-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Rút tiền nghệ nhân</h1>
          <p className="admin-page-subtitle">Theo dõi và lọc các yêu cầu rút tiền trong hệ thống</p>
        </div>
      </div>

      <section className="admin-card withdrawals-filter-card">
        <div className="withdrawals-filter-grid">
          <div className="withdrawals-filter-field">
            <label>Trạng thái</label>
            <select value={filters.status} onChange={(e) => applyFilters({ status: e.target.value })}>
              <option value="">Tất cả</option>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{getStatusLabel(status)}</option>)}
            </select>
          </div>
          <div className="withdrawals-filter-field">
            <label>Tên nghệ nhân</label>
            <div className="withdrawals-search-box">
              <FiSearch className="control-icon" />
              <input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Nhập tên nghệ nhân" />
            </div>
          </div>
          <div className="withdrawals-filter-field">
            <label>Từ ngày</label>
            <input type="date" value={filters.fromDate} onChange={(e) => applyFilters({ fromDate: e.target.value })} />
          </div>
          <div className="withdrawals-filter-field">
            <label>Đến ngày</label>
            <input type="date" value={filters.toDate} onChange={(e) => applyFilters({ toDate: e.target.value })} />
          </div>
        </div>

        <div className="withdrawals-filter-actions">
          <button type="button" className="btn-action btn-primary" onClick={() => applyFilters({ artisanName: searchDraft.trim() })}>
            <FiFilter />
            <span>Lọc dữ liệu</span>
          </button>
          <button type="button" className="btn-action btn-secondary" onClick={resetFilters}>
            <FiRefreshCw />
            <span>Đặt lại</span>
          </button>
        </div>
      </section>

      <section className="admin-card table-card">
        <div className="withdrawals-summary-row">
          <strong>{pageData.totalElements} yêu cầu</strong>
          <span>Trang {pageData.number + 1}/{Math.max(pageData.totalPages, 1)}</span>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>NGHỆ NHÂN</th>
                <th>SỐ TIỀN</th>
                <th>TRẠNG THÁI</th>
                <th>NGÂN HÀNG</th>
                <th>THỜI GIAN TẠO</th>
                <th>XỬ LÝ</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="empty-state">Đang tải dữ liệu...</td></tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    <div className="admin-empty-state">
                      <FiAlertCircle style={{ fontSize: '2rem' }} />
                      <p>Không có yêu cầu rút tiền phù hợp</p>
                    </div>
                  </td>
                </tr>
              ) : withdrawals.map((item) => (
                <tr key={item.withdrawalId}>
                  <td>
                    <div className="withdrawals-artisan-cell">
                      <strong>{item.artisanName || '—'}</strong>
                      <span>{item.artisanEmail || '—'}</span>
                    </div>
                  </td>
                  <td><strong>{formatCurrency(item.amount)}</strong></td>
                  <td><span className={`status-badge status-${String(item.status || '').toLowerCase()}`}>{getStatusLabel(item.status)}</span></td>
                  <td>
                    <div className="withdrawals-bank-cell">
                      <strong>{item.bankName || '—'}</strong>
                      <span>{item.bankAccountNumber || '—'}</span>
                      <small>{item.bankAccountName || '—'}</small>
                    </div>
                  </td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>{item.processedAt ? `${formatDateTime(item.processedAt)}${item.processedByName ? ` • ${item.processedByName}` : ''}` : 'Chưa xử lý'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-action btn-secondary"
                      onClick={() => openDetail(item.withdrawalId)}
                      disabled={detailLoading}
                    >
                      <span>Xem chi tiết</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-bar">
          <button type="button" className="btn-action btn-secondary" disabled={loading || pageData.first} onClick={() => handlePageChange(-1)}>
            <FiChevronLeft /> Trước
          </button>
          <span>Trang {pageData.number + 1} / {Math.max(pageData.totalPages, 1)}</span>
          <button type="button" className="btn-action btn-secondary" disabled={loading || pageData.last} onClick={() => handlePageChange(1)}>
            Sau <FiChevronRight />
          </button>
        </div>
      </section>

      {selectedWithdrawal && (
        <div className="detail-overlay" onClick={() => setSelectedWithdrawal(null)} role="presentation">
          <div className="detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="detail-modal-header">
              <h3>Chi tiết yêu cầu rút tiền</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" className="btn-action btn-secondary" onClick={refreshDetail} disabled={detailLoading || actionLoading}>
                  {detailLoading ? 'Đang tải...' : 'Làm mới'}
                </button>
                <button type="button" className="detail-close" onClick={() => setSelectedWithdrawal(null)}>
                  <FiX />
                </button>
              </div>
            </div>

            <div className="detail-modal-body">
              <div className="detail-row">
                <span className="detail-label">Mã yêu cầu</span>
                <span className="detail-value mono">{selectedWithdrawal.withdrawalId || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Nghệ nhân</span>
                <span className="detail-value">{selectedWithdrawal.artisanName || '—'} {selectedWithdrawal.artisanEmail ? `(${selectedWithdrawal.artisanEmail})` : ''}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Số tiền</span>
                <span className="detail-value"><strong>{formatCurrency(selectedWithdrawal.amount)}</strong></span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Trạng thái</span>
                <span className={`status-badge status-${String(selectedWithdrawal.status || '').toLowerCase()}`}>{getStatusLabel(selectedWithdrawal.status)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Ngân hàng</span>
                <span className="detail-value">{selectedWithdrawal.bankName || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Số tài khoản</span>
                <span className="detail-value mono">{selectedWithdrawal.fullBankAccountNumber || selectedWithdrawal.bankAccountNumber || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Tên tài khoản</span>
                <span className="detail-value">{selectedWithdrawal.bankAccountName || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Ngày tạo</span>
                <span className="detail-value">{formatDateTime(selectedWithdrawal.createdAt)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Xử lý lúc</span>
                <span className="detail-value">{formatDateTime(selectedWithdrawal.processedAt)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Xử lý bởi</span>
                <span className="detail-value">{selectedWithdrawal.processedByName || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Lý do rút tiền</span>
                <span className="detail-value">{selectedWithdrawal.reason || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Lý do từ chối</span>
                <span className="detail-value">{selectedWithdrawal.rejectionReason || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Hủy lúc</span>
                <span className="detail-value">{formatDateTime(selectedWithdrawal.cancelledAt)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Wallet Transaction ID</span>
                <span className="detail-value mono">{selectedWithdrawal.walletTransactionId || '—'}</span>
              </div>

              <div className="withdrawals-filter-field" style={{ marginTop: 16 }}>
                <label>Ghi chú phê duyệt</label>
                <input value={approveNote} onChange={(e) => setApproveNote(e.target.value)} placeholder="Ví dụ: Đã kiểm tra thông tin thanh toán" />
              </div>
              <div className="withdrawals-filter-field" style={{ marginTop: 12 }}>
                <label>Lý do từ chối</label>
                <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Nhập lý do từ chối" />
              </div>

              <div className="withdrawals-filter-actions" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-action btn-primary"
                  onClick={submitApprove}
                  disabled={actionLoading}
                >
                  Phê duyệt
                </button>
                <button
                  type="button"
                  className="btn-action btn-secondary"
                  onClick={submitReject}
                  disabled={actionLoading}
                >
                  Từ chối
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWithdrawals;
