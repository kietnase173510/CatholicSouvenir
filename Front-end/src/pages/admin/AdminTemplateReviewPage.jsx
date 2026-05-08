import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Navigate } from 'react-router-dom';
import { FiAlertCircle, FiChevronLeft, FiChevronRight, FiRefreshCw, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { appToast } from '../../lib/appToast';
import adminTemplateReviewService from '../../services/adminTemplateReviewService';
import './admin-common.css';
import './AdminTemplateReviewPage.css';

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—');

const getTemplateLabel = (item) => item?.name || item?.templateName || item?.title || item?.categoryName || '—';

const getTemplateCreator = (item) => item?.artisanName || item?.ownerName || item?.createdByName || item?.createdBy || '—';

const AdminTemplateReviewPage = () => {
  const { user, isAuthenticated } = useAuth();
  const role = String(user?.role || user?.roleName || '').toUpperCase();
  const isAdmin = role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [filters, setFilters] = useState({ page: 0, size: 10 });
  const [pageData, setPageData] = useState({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, first: true, last: true });

  const loadData = async (nextFilters = filters) => {
    setLoading(true);
    const response = await adminTemplateReviewService.getPendingTemplatesApi(nextFilters);
    if (!response.success) {
      appToast.error(response.error || 'Không tải được danh sách chờ duyệt');
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

  const templates = useMemo(() => pageData.content || [], [pageData]);

  const handlePageChange = (delta) => {
    const nextPage = Math.max(0, (filters.page || 0) + delta);
    const next = { ...filters, page: nextPage };
    setFilters(next);
    loadData(next);
  };

  const reload = async () => {
    await loadData(filters);
  };

  const handleApprove = async (id) => {
    if (!id) return;
    setActionLoadingId(id);
    const response = await adminTemplateReviewService.approveTemplateApi(id);
    setActionLoadingId('');
    if (!response.success) {
      appToast.error(response.error || 'Phê duyệt thất bại');
      return;
    }
    appToast.success('Đã phê duyệt template');
    await loadData(filters);
  };

  const handleReject = async (id) => {
    if (!id) return;
    setActionLoadingId(id);
    const response = await adminTemplateReviewService.rejectTemplateApi(id);
    setActionLoadingId('');
    if (!response.success) {
      appToast.error(response.error || 'Từ chối thất bại');
      return;
    }
    appToast.success('Đã từ chối template');
    await loadData(filters);
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="admin-page admin-template-review-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Duyệt phân loại</h1>
          <p className="admin-page-subtitle">Xem các template đang chờ duyệt và thực hiện phê duyệt hoặc từ chối.</p>
        </div>
        <button type="button" className="btn-action btn-secondary" onClick={reload} disabled={loading}>
          <FiRefreshCw />
          <span>Làm mới</span>
        </button>
      </div>

      <section className="admin-card table-card">
        <div className="withdrawals-summary-row">
          <strong>{pageData.totalElements} mục</strong>
          <span>Trang {pageData.number + 1}/{Math.max(pageData.totalPages, 1)}</span>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>TÊN TEMPLATE</th>
                <th>NGƯỜI TẠO</th>
                <th>THỜI GIAN TẠO</th>
                <th>MÔ TẢ</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="empty-state">Đang tải dữ liệu...</td></tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    <div className="admin-empty-state">
                      <FiAlertCircle style={{ fontSize: '2rem' }} />
                      <p>Không có mục chờ duyệt</p>
                    </div>
                  </td>
                </tr>
              ) : templates.map((item) => {
                const id = item.templateId || item.id || item.uuid;
                const disabled = actionLoadingId === id;
                return (
                  <tr key={id || getTemplateLabel(item)}>
                    <td className="admin-table-center"><strong>{getTemplateLabel(item)}</strong></td>
                    <td className="admin-table-center">{getTemplateCreator(item)}</td>
                    <td className="admin-table-center">{formatDateTime(item.createdAt || item.created_at || item.createdDate)}</td>
                    <td className="admin-table-center">{item.description || item.note || '—'}</td>
                    <td className="admin-table-center">
                      <div className="admin-template-actions">
                        <button type="button" className="btn-action btn-approve" onClick={() => handleApprove(id)} disabled={disabled}>
                          <FiCheckCircle />
                          <span>Duyệt</span>
                        </button>
                        <button type="button" className="btn-action btn-reject" onClick={() => handleReject(id)} disabled={disabled}>
                          <FiXCircle />
                          <span>Từ chối</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pagination-bar">
          <button type="button" className="btn-action btn-secondary" disabled={loading || pageData.first} onClick={() => handlePageChange(-1)}>
            <FiChevronLeft /> Trước
          </button>
          <span className="admin-table-center">Trang {pageData.number + 1} / {Math.max(pageData.totalPages, 1)}</span>
          <button type="button" className="btn-action btn-secondary" disabled={loading || pageData.last} onClick={() => handlePageChange(1)}>
            Sau <FiChevronRight />
          </button>
        </div>
      </section>
    </div>
  );
};

export default AdminTemplateReviewPage;
