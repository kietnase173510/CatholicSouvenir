import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Navigate } from 'react-router-dom';
import { FiAlertTriangle, FiCheckCircle, FiEye, FiRefreshCw, FiSearch, FiSlash, FiX } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { appToast } from '../../lib/appToast';
import { blacklistArtisanApi, getRecoveryTasksApi, markRecoveryTaskRecoveredApi } from '../../services/recoveryService';
import './admin-common.css';
import './AdminRecoveryManagementPage.css';

const formatCurrency = (value) => {
    const numericValue = Number(value || 0);
    return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(numericValue)} đ`;
};
const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—');
const formatDetailValue = (value) => (value === null || value === undefined || value === '' ? '—' : value);

const formatRawNumber = (value) => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return formatDetailValue(value);
    return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(numericValue);
};

const translateRecoveryReason = (value) => {
    const text = String(value || '').trim();
    if (!text) return '—';

    const lower = text.toLowerCase();
    const availableMatch = text.match(/Available:\s*([+-]?[\d,.]+)\s*VND/i);
    const requiredMatch = text.match(/Required:\s*([+-]?[\d,.]+)\s*VND/i);

    if (lower.startsWith('cancel order - insufficient balance')) {
        const available = formatRawNumber(availableMatch?.[1] || '0');
        const required = formatRawNumber(requiredMatch?.[1] || '0');
        return `Hủy đơn hàng - Số dư không đủ. Số dư hiện có: ${available} đ, Số tiền cần thu hồi: ${required} đ`;
    }

    return text
        .replace(/cancel order/gi, 'Hủy đơn hàng')
        .replace(/insufficient balance/gi, 'Số dư không đủ')
        .replace(/available/gi, 'Số dư hiện có')
        .replace(/required/gi, 'Số tiền cần thu hồi')
        .replace(/([+-]?[\d,.]+)\s*VND/gi, (_, amount) => `${formatRawNumber(amount)} đ`);
};

const AdminRecoveryManagementPage = () => {
    const { user, isAuthenticated } = useAuth();
    const role = String(user?.role || user?.roleName || '').toUpperCase();
    const isAdmin = role === 'ADMIN';

    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState('');
    const [tasks, setTasks] = useState([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedTask, setSelectedTask] = useState(null);

    const loadTasks = async () => {
        setLoading(true);
        const res = await getRecoveryTasksApi();
        if (!res.success) {
            appToast.error('Không tải được recovery tasks', res.error || 'Vui lòng thử lại');
            setTasks([]);
        } else {
            setTasks(Array.isArray(res.data) ? res.data : []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!isAuthenticated || !isAdmin) return;

        void (async () => {
            await loadTasks();
        })();
    }, [isAuthenticated, isAdmin]);

    const filteredTasks = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return [...tasks]
            .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
            .filter((task) => {
                const matchesStatus = statusFilter === 'ALL' || String(task?.status || '').toUpperCase() === statusFilter;
                const text = [task?.artisanName, task?.customerName, task?.orderId, task?.reason]
                    .map((item) => String(item || '').toLowerCase())
                    .join(' ');
                const matchesKeyword = !keyword || text.includes(keyword);
                return matchesStatus && matchesKeyword;
            });
    }, [tasks, search, statusFilter]);

    const stats = useMemo(() => ({
        totalTasks: tasks.length,
        pendingTasks: tasks.filter((task) => String(task?.status || '').toUpperCase() === 'PENDING').length,
        recoveredTasks: tasks.filter((task) => String(task?.status || '').toUpperCase() === 'RECOVERED').length,
        totalAmount: tasks.reduce((sum, task) => sum + Number(task?.refundAmount || 0), 0),
        pendingAmount: tasks.filter((task) => String(task?.status || '').toUpperCase() === 'PENDING')
            .reduce((sum, task) => sum + Number(task?.refundAmount || 0), 0),
    }), [tasks]);

    const handleMarkRecovered = async (task) => {
        if (!task?.taskId) return;
        if (!window.confirm('Xác nhận bạn đã thu hồi được tiền từ nghệ nhân?')) return;

        setSubmittingId(String(task.taskId));
        const res = await markRecoveryTaskRecoveredApi(task.taskId);
        setSubmittingId('');

        if (!res.success) {
            appToast.error('Không thể đánh dấu đã xử lý', res.error || 'Vui lòng thử lại');
            return;
        }

        appToast.success('Đã đánh dấu recovery task là hoàn thành');
        await loadTasks();
        setSelectedTask((prev) => (prev?.taskId === task.taskId ? { ...prev, status: 'RECOVERED', actionCompleted: true } : prev));
    };

    const handleBlacklist = async (task) => {
        if (!task?.artisanId) return;
        if (!window.confirm('Xác nhận blacklist nghệ nhân? Họ sẽ không thể nhận đơn mới.')) return;

        setSubmittingId(String(task.artisanId));
        const res = await blacklistArtisanApi(task.artisanId);
        setSubmittingId('');

        if (!res.success) {
            appToast.error('Không thể blacklist artisan', res.error || 'Vui lòng thử lại');
            return;
        }

        appToast.success('Đã blacklist nghệ nhân');
        await loadTasks();
    };

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!isAdmin) return <Navigate to="/" replace />;

    return (
        <div className="admin-page admin-recovery-page">
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">Quản lý thu hồi tiền</h1>
                    <p className="admin-page-subtitle">Theo dõi và xử lý các khoản tiền cần thu hồi từ nghệ nhân để đảm bảo dòng tiền hệ thống.</p>
                </div>
                <button type="button" className="btn btn-outline" onClick={loadTasks} disabled={loading}>
                    <FiRefreshCw /> Làm mới
                </button>
            </div>

            {loading ? (
                <div className="admin-recovery-skeleton-grid">
                    <div className="admin-recovery-skeleton" />
                    <div className="admin-recovery-skeleton" />
                    <div className="admin-recovery-skeleton" />
                    <div className="admin-recovery-skeleton" />
                </div>
            ) : (
                <>
                    <section className="admin-recovery-stats-grid">
                        <article className="admin-recovery-stat">
                            <p>Tổng tasks</p>
                            <h3>{stats.totalTasks}</h3>
                        </article>
                        <article className="admin-recovery-stat warning">
                            <p>Đang chờ xử lý</p>
                            <h3>{stats.pendingTasks}</h3>
                            <span>{formatCurrency(stats.pendingAmount)}</span>
                        </article>
                        <article className="admin-recovery-stat success">
                            <p>Đã thu hồi</p>
                            <h3>{stats.recoveredTasks}</h3>
                        </article>
                        <article className="admin-recovery-stat">
                            <p>Tổng số tiền</p>
                            <h3>{formatCurrency(stats.totalAmount)}</h3>
                        </article>
                    </section>

                    <section className="admin-card table-card admin-recovery-table-card">
                        <div className="admin-recovery-toolbar">
                            <div className="admin-recovery-search">
                                <FiSearch className="control-icon" />
                                <input
                                    type="text"
                                    placeholder="Tìm theo nghệ nhân, khách hàng, email, phone, order ID..."
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </div>

                            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                                <option value="ALL">Tất cả trạng thái</option>
                                <option value="PENDING">Chưa xử lý</option>
                                <option value="RECOVERED">Đã thu hồi</option>
                            </select>
                        </div>

                        <div className="table-responsive">
                            <table className="admin-table admin-recovery-table">
                                <thead>
                                    <tr>
                                        <th>NGHỆ NHÂN</th>
                                        <th>KHÁCH HÀNG</th>
                                        <th>SỐ TIỀN</th>
                                        <th>NGÀY TẠO</th>
                                        <th>TRẠNG THÁI</th>
                                        <th>HÀNH ĐỘNG</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTasks.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="empty-state">
                                                <div className="admin-empty-state">
                                                    <FiAlertTriangle style={{ fontSize: '2rem' }} />
                                                    <p>Không có recovery task nào</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTasks.map((task) => {
                                            const status = String(task?.status || 'PENDING').toUpperCase();
                                            const isPending = status === 'PENDING';

                                            return (
                                                <tr key={task?.taskId} className={status === 'RECOVERED' ? 'recovered-row' : 'pending-row'}>
                                                    <td>
                                                        <div className="admin-recovery-artisan-cell">
                                                            <div>
                                                                <p className="admin-recovery-name">{task?.artisanName || '—'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="admin-recovery-contact">
                                                            <span className="admin-recovery-name">{task?.customerName || '—'}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <strong className="admin-recovery-amount">{formatCurrency(task?.refundAmount || 0)}</strong>
                                                    </td>
                                                    <td>{formatDateTime(task?.createdAt)}</td>
                                                    <td>
                                                        <span className={`admin-recovery-badge ${isPending ? 'pending' : 'recovered'}`}>
                                                            {isPending ? 'Chưa xử lý' : 'Đã thu hồi'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="admin-recovery-actions">
                                                            <button
                                                                type="button"
                                                                className="btn-action btn-outline"
                                                                onClick={() => setSelectedTask(task)}
                                                            >
                                                                <FiEye /> Chi tiết
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}

            {selectedTask ? (
                <div className="admin-recovery-modal-backdrop" role="presentation" onClick={() => setSelectedTask(null)}>
                    <aside
                        className="admin-recovery-drawer"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="recovery-detail-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="admin-recovery-modal-header">
                            <div>
                                <p className="admin-recovery-modal-eyebrow">Chi tiết recovery task</p>
                                <h2 id="recovery-detail-title">{selectedTask?.artisanName || '—'} → {selectedTask?.customerName || '—'}</h2>
                            </div>
                            <button type="button" className="admin-recovery-modal-close" onClick={() => setSelectedTask(null)} aria-label="Đóng drawer">
                                <FiX />
                            </button>
                        </div>

                        <div className="admin-recovery-modal-grid">
                            <div className="admin-recovery-modal-card admin-recovery-modal-full">
                                <h3>Thông tin chung</h3>
                                <dl className="admin-recovery-general-grid">
                                    <div><dt>Task ID</dt><dd className="mono">{formatDetailValue(selectedTask?.taskId)}</dd></div>
                                    <div><dt>Order ID</dt><dd className="mono">{formatDetailValue(selectedTask?.orderId)}</dd></div>
                                    <div><dt>Số tiền hoàn</dt><dd>{formatCurrency(selectedTask?.refundAmount || 0)}</dd></div>
                                    <div><dt>Trạng thái</dt><dd>{formatDetailValue(selectedTask?.status)}</dd></div>
                                    <div><dt>Ngày tạo</dt><dd>{formatDateTime(selectedTask?.createdAt)}</dd></div>
                                    <div><dt>Đã xử lý</dt><dd>{selectedTask?.actionCompleted ? 'Có' : 'Không'}</dd></div>
                                </dl>
                            </div>

                            <div className="admin-recovery-modal-card">
                                <h3>Thông tin nghệ nhân</h3>
                                <dl>
                                    <div><dt>ID</dt><dd className="mono">{formatDetailValue(selectedTask?.artisanId)}</dd></div>
                                    <div><dt>Tên</dt><dd>{formatDetailValue(selectedTask?.artisanName)}</dd></div>
                                    <div><dt>Email</dt><dd>{formatDetailValue(selectedTask?.email)}</dd></div>
                                    <div><dt>Số điện thoại</dt><dd>{formatDetailValue(selectedTask?.phone)}</dd></div>
                                    <div><dt>Số dư khả dụng</dt><dd>{selectedTask?.artisanAvailableBalance === null || selectedTask?.artisanAvailableBalance === undefined ? '—' : formatCurrency(selectedTask?.artisanAvailableBalance)}</dd></div>
                                    <div><dt>Số dư bị khóa</dt><dd>{selectedTask?.artisanLockedBalance === null || selectedTask?.artisanLockedBalance === undefined ? '—' : formatCurrency(selectedTask?.artisanLockedBalance)}</dd></div>
                                </dl>
                            </div>

                            <div className="admin-recovery-modal-card">
                                <h3>Thông tin khách hàng</h3>
                                <dl>
                                    <div><dt>ID</dt><dd className="mono">{formatDetailValue(selectedTask?.customerId)}</dd></div>
                                    <div><dt>Tên</dt><dd>{formatDetailValue(selectedTask?.customerName)}</dd></div>
                                    <div><dt>Email</dt><dd>{formatDetailValue(selectedTask?.customerEmail)}</dd></div>
                                    <div><dt>Số điện thoại</dt><dd>{formatDetailValue(selectedTask?.customerPhone)}</dd></div>
                                </dl>
                            </div>

                            <div className="admin-recovery-modal-card admin-recovery-modal-full">
                                <h3>Lý do thu hồi</h3>
                                <p>{translateRecoveryReason(selectedTask?.reason)}</p>
                            </div>
                        </div>

                        <div className="admin-recovery-drawer-actions">
                            <button
                                type="button"
                                className="btn-action btn-success"
                                disabled={Boolean(submittingId) || String(selectedTask?.status || '').toUpperCase() !== 'PENDING'}
                                onClick={() => handleMarkRecovered(selectedTask)}
                            >
                                <FiCheckCircle /> Đánh dấu đã thu hồi
                            </button>
                            <button
                                type="button"
                                className="btn-action btn-danger"
                                disabled={Boolean(submittingId) || !selectedTask?.artisanId}
                                onClick={() => handleBlacklist(selectedTask)}
                            >
                                <FiSlash /> Blacklist
                            </button>
                        </div>
                    </aside>
                </div>
            ) : null}
        </div>
    );
};

export default AdminRecoveryManagementPage;
