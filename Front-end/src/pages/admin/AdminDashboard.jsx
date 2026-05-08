import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiBell,
    FiCheckCircle,
    FiClipboard,
    FiEdit3,
    FiMail,
    FiSearch,
    FiSettings,
    FiTrendingUp,
    FiTruck,
    FiUsers,
    FiExternalLink,
} from 'react-icons/fi';
import api from '../../cofig/api';
import './admin-common.css';
import './AdminDashboard.css';

const DASHBOARD_PRESETS = [
    { id: 7, label: 'Tuần này' },
    { id: 30, label: 'Tháng này' },
    { id: 90, label: 'Quý này' },
    { id: 365, label: 'Năm này' },
];

const formatCurrency = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} `;
const formatNumber = (value) => new Intl.NumberFormat('vi-VN').format(Number(value || 0));

const emptyDashboard = {
    summary: { totalOrders: 0, totalRevenue: 0 },
    customerStats: { activeCustomers: 0, newCustomers: 0, totalCustomers: 0 },
    artisanStats: { activeArtisans: 0, pendingArtisans: 0, totalArtisans: 0 },
    customOrderStats: { averageOrderValue: 0, conversionRate: 0, totalOrders: 0, totalRequests: 0 },
    complaintStats: { approvedComplaints: 0, pendingComplaints: 0, rejectedComplaints: 0, totalComplaints: 0, totalRefundAmount: 0 },
    revenueBreakdown: { productRevenue: 0, templateRevenue: 0, customRevenue: 0, totalCommission: 0 },
    platformFinancials: { totalCommissionEarned: 0, totalLockedBalance: 0, totalAvailableBalance: 0, totalPlatformRevenue: 0 },
    refundStats: { totalRefunds: 0, totalRefundAmount: 0, totalCancellations: 0, totalCancellationAmount: 0, refundRate: 0 },
    withdrawalStats: { totalRequests: 0, pendingRequests: 0, approvedRequests: 0, rejectedRequests: 0, totalWithdrawnAmount: 0, pendingWithdrawalAmount: 0 },
    productAnalytics: { approvedProducts: 0, averagePrice: 0, pendingProducts: 0, totalProducts: 0 },
    orderStatus: {},
    topArtisans: [],
    topCustomers: [],
    topProducts: [],
    topTemplates: [],
    revenueChart: [],
};

const toPercent = (value) => `${Math.max(0, Math.min(100, Number(value) || 0)).toFixed(0)}%`;

const toRate = (part, total) => `${Number(total) > 0 ? ((Number(part) / Number(total)) * 100).toFixed(1) : '0.0'}%`;

const buildRevenueBars = (items) => {
    const list = Array.isArray(items) ? items : [];
    const peak = Math.max(...list.map((item) => Number(item?.revenue || 0)), 1);
    return list.map((item) => ({
        ...item,
        height: Math.max(12, Math.round((Number(item?.revenue || 0) / peak) * 100)),
    }));
};

const buildCategoryBars = (items, valueKey = 'revenue') => {
    const list = Array.isArray(items) ? items : [];
    const peak = Math.max(...list.map((item) => Number(item?.[valueKey] || 0)), 1);
    return list.map((item, index) => ({
        ...item,
        id: item?.id || item?.productId || item?.customerId || item?.artisanId || item?.templateId || `${valueKey}-${index}`,
        height: Math.max(12, Math.round((Number(item?.[valueKey] || 0) / peak) * 100)),
    }));
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState(emptyDashboard);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedDays, setSelectedDays] = useState(30);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationsError, setNotificationsError] = useState('');
    const [notificationsOpen, setNotificationsOpen] = useState(false);

    const fetchDashboard = async (days = selectedDays) => {
        setLoading(true);
        setError('');

        try {
            const response = await api.get('/admin/dashboard', { params: { days } });
            const payload = response?.data?.data ?? response?.data ?? {};
            const merged = {
                ...emptyDashboard,
                ...payload,
                summary: { ...emptyDashboard.summary, ...(payload.summary || {}) },
                customerStats: { ...emptyDashboard.customerStats, ...(payload.customerStats || {}) },
                artisanStats: { ...emptyDashboard.artisanStats, ...(payload.artisanStats || {}) },
                customOrderStats: { ...emptyDashboard.customOrderStats, ...(payload.customOrderStats || {}) },
                complaintStats: { ...emptyDashboard.complaintStats, ...(payload.complaintStats || {}) },
                revenueBreakdown: { ...emptyDashboard.revenueBreakdown, ...(payload.revenueBreakdown || {}) },
                platformFinancials: { ...emptyDashboard.platformFinancials, ...(payload.platformFinancials || {}) },
                refundStats: { ...emptyDashboard.refundStats, ...(payload.refundStats || {}) },
                withdrawalStats: { ...emptyDashboard.withdrawalStats, ...(payload.withdrawalStats || {}) },
                productAnalytics: { ...emptyDashboard.productAnalytics, ...(payload.productAnalytics || {}) },
                orderStatus: payload.orderStatus || {},
                topArtisans: Array.isArray(payload.topArtisans) ? payload.topArtisans : [],
                topCustomers: Array.isArray(payload.topCustomers) ? payload.topCustomers : [],
                topProducts: Array.isArray(payload.topProducts) ? payload.topProducts : [],
                topTemplates: Array.isArray(payload.topTemplates) ? payload.topTemplates : [],
                revenueChart: Array.isArray(payload.revenueChart) ? payload.revenueChart : [],
            };

            setDashboard(merged);
            setSelectedDays(days);
            console.info('[AdminDashboard] Loaded dashboard data', {
                days,
                summary: merged.summary,
                artisanStats: merged.artisanStats,
                customerStats: merged.customerStats,
                productAnalytics: merged.productAnalytics,
                topArtisans: merged.topArtisans.length,
                topCustomers: merged.topCustomers.length,
                topProducts: merged.topProducts.length,
                topTemplates: merged.topTemplates.length,
                revenueChartPoints: merged.revenueChart.length,
            });
        } catch (err) {
            const message = err?.response?.data?.message || err?.message || 'Không tải được dashboard.';
            setError(message);
            console.error('[AdminDashboard] Failed to load dashboard data', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUnreadCount = async () => {
        try {
            const response = await api.get('/notifications/unread-count');
            const payload = response?.data?.data ?? response?.data ?? 0;
            setUnreadCount(Number(payload) || 0);
        } catch (err) {
            console.error('[AdminDashboard] Failed to load unread notification count', err);
        }
    };

    const fetchNotifications = async () => {
        setNotificationsLoading(true);
        setNotificationsError('');

        try {
            const [allResponse, unreadResponse] = await Promise.all([
                api.get('/notifications', { params: { page: 0, size: 20 } }),
                api.get('/notifications/unread-count'),
            ]);

            const allPayload = allResponse?.data?.data ?? allResponse?.data ?? {};
            const unreadPayload = unreadResponse?.data?.data ?? unreadResponse?.data ?? 0;
            setNotifications(Array.isArray(allPayload.content) ? allPayload.content : []);
            setUnreadCount(Number(unreadPayload) || 0);
        } catch (err) {
            setNotificationsError(err?.response?.data?.message || err?.message || 'Không tải được thông báo.');
        } finally {
            setNotificationsLoading(false);
        }
    };

    const markNotificationAsRead = async (notificationId, redirectPath) => {
        try {
            await api.post(`/notifications/${notificationId}/read`);
            setNotifications((prev) => prev.map((item) => (item.notificationId === notificationId ? { ...item, isRead: true } : item)));
            fetchUnreadCount();
            if (redirectPath) {
                navigate(redirectPath);
            }
        } catch (err) {
            setNotificationsError(err?.response?.data?.message || err?.message || 'Không đánh dấu đã đọc được.');
        }
    };

    const markAllNotificationsAsRead = async () => {
        try {
            await api.post('/notifications/read-all');
            setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            setNotificationsError(err?.response?.data?.message || err?.message || 'Không đánh dấu tất cả đã đọc được.');
        }
    };

    useEffect(() => {
        fetchDashboard(30);
        fetchUnreadCount();
    }, []);

    useEffect(() => {
        if (notificationsOpen && notifications.length === 0 && !notificationsLoading) {
            fetchNotifications();
        }
    }, [notificationsOpen]);

    const kpis = useMemo(() => ([
        {
            id: 'revenue',
            title: 'Tổng doanh thu',
            value: formatCurrency(dashboard.summary.totalRevenue),
            trend: `Trong ${selectedDays} ngày gần nhất`,
            trendClass: 'up',
            icon: <FiTrendingUp />,
            iconClass: 'orange',
        },
        {
            id: 'orders',
            title: 'Đơn hàng',
            value: formatNumber(dashboard.summary.totalOrders),
            trend: `Custom: ${formatNumber(dashboard.customOrderStats.totalOrders)} | Requests: ${formatNumber(dashboard.customOrderStats.totalRequests)}`,
            trendClass: 'flat',
            icon: <FiTruck />,
            iconClass: 'blue',
        },
        {
            id: 'customers',
            title: 'Khách hàng',
            value: formatNumber(dashboard.customerStats.totalCustomers),
            trend: `${formatNumber(dashboard.customerStats.activeCustomers)} active • ${formatNumber(dashboard.customerStats.newCustomers)} mới`,
            trendClass: 'up',
            icon: <FiUsers />,
            iconClass: 'amber',
        },
        {
            id: 'complaints',
            title: 'Khiếu nại',
            value: formatNumber(dashboard.complaintStats.totalComplaints),
            trend: `${formatNumber(dashboard.complaintStats.pendingComplaints)} chờ xử lý`,
            trendClass: 'down',
            icon: <FiCheckCircle />,
            iconClass: 'red',
        },
    ]), [dashboard, selectedDays]);

    const revenueTrend = useMemo(() => buildRevenueBars(dashboard.revenueChart), [dashboard.revenueChart]);
    const topCustomerBars = useMemo(() => buildCategoryBars(dashboard.topCustomers.slice(0, 5), 'totalSpent'), [dashboard.topCustomers]);
    const topProductBars = useMemo(() => buildCategoryBars(dashboard.topProducts.slice(0, 5), 'revenue'), [dashboard.topProducts]);
    const topArtisanBars = useMemo(() => buildCategoryBars(dashboard.topArtisans.slice(0, 5), 'totalRevenue'), [dashboard.topArtisans]);

    const recentActivities = useMemo(() => {
        const topCustomers = dashboard.topCustomers.slice(0, 4).map((customer, index) => ({
            id: `customer-${customer.customerId || index}`,
            icon: <FiUsers />,
            iconClass: 'green',
            title: `Khách hàng ${customer.customerName}`,
            description: `${customer.email} • ${formatNumber(customer.totalOrders)} đơn • ${formatCurrency(customer.totalSpent)}`,
            time: `Top #${index + 1}`,
        }));

        const topProducts = dashboard.topProducts.slice(0, 4).map((product, index) => ({
            id: `product-${product.productId || index}`,
            icon: <FiClipboard />,
            iconClass: 'blue',
            title: `Sản phẩm ${product.productName}`,
            description: `${formatNumber(product.sold)} đã bán • ${formatCurrency(product.revenue)}`,
            time: `Top #${index + 1}`,
        }));

        return [...topCustomers, ...topProducts].slice(0, 4);
    }, [dashboard.topCustomers, dashboard.topProducts]);

    const quickActions = useMemo(() => [
        { id: 1, label: `Duyệt ${formatNumber(dashboard.artisanStats.pendingArtisans)} đơn đăng ký`, icon: <FiCheckCircle />, onClick: () => navigate('/admin/artisan-applications') },
        { id: 2, label: `Sản phẩm chờ duyệt: ${formatNumber(dashboard.productAnalytics.pendingProducts)}`, icon: <FiEdit3 />, onClick: () => navigate('/admin/products') },
        { id: 3, label: `Khiếu nại chờ xử lý: ${formatNumber(dashboard.complaintStats.pendingComplaints)}`, icon: <FiMail />, onClick: () => navigate('/admin/complaints') },
        { id: 4, label: `Yêu cầu rút tiền: ${formatNumber(dashboard.withdrawalStats.pendingRequests)}`, icon: <FiClipboard />, onClick: () => navigate('/admin/withdrawals') },
    ], [dashboard.artisanStats.pendingArtisans, dashboard.complaintStats.pendingComplaints, dashboard.productAnalytics.pendingProducts, dashboard.withdrawalStats.pendingRequests, navigate]);

    return (
        <div className="admin-dashboard-page">
            <header className="dashboard-topbar">
                <div className="dashboard-search">
                    <FiSearch className="dashboard-search-icon" />
                    <input
                        type="text"
                        placeholder="Tìm đơn hàng, nghệ nhân hoặc sản phẩm..."
                        aria-label="Tìm kiếm quản trị"
                    />
                </div>

                <div className="dashboard-topbar-actions">
                    <label className="dashboard-range-picker" aria-label="Chọn mốc thời gian dashboard">
                        <span>Xem nhanh</span>
                        <select
                            value={selectedDays}
                            onChange={(e) => fetchDashboard(Number(e.target.value))}
                        >
                            {DASHBOARD_PRESETS.map((preset) => (
                                <option key={preset.id} value={preset.id}>{preset.label}</option>
                            ))}
                        </select>
                    </label>
                    <div className="dashboard-notification-wrap">
                        <button
                            type="button"
                            className="dashboard-icon-btn"
                            aria-label="Thông báo"
                            onClick={() => setNotificationsOpen((value) => !value)}
                        >
                            <FiBell />
                            {unreadCount > 0 && <span className="dashboard-notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                        </button>
                        {notificationsOpen && (
                            <div className="dashboard-notification-dropdown">
                                <div className="dashboard-notification-header">
                                    <div>
                                        <strong>Thông báo</strong>
                                        <span>{unreadCount} chưa đọc</span>
                                    </div>
                                    <div className="dashboard-notification-actions">
                                        <button type="button" className="activity-link" onClick={fetchNotifications}>
                                            Làm mới
                                        </button>
                                        <button type="button" className="activity-link" onClick={markAllNotificationsAsRead} disabled={notificationsLoading || unreadCount === 0}>
                                            Đọc tất cả
                                        </button>
                                    </div>
                                </div>
                                <div className="dashboard-notification-list">
                                    {notificationsLoading ? (
                                        <p className="chart-empty">Đang tải thông báo...</p>
                                    ) : notificationsError ? (
                                        <p className="dashboard-error">{notificationsError}</p>
                                    ) : notifications.length > 0 ? notifications.map((item) => (
                                        <button
                                            type="button"
                                            className={`dashboard-notification-item ${item.isRead ? 'read' : 'unread'}`}
                                            key={item.notificationId}
                                            onClick={() => markNotificationAsRead(
                                                item.notificationId,
                                                item.type === 'WITHDRAWAL_REQUESTED'
                                                    ? '/admin/withdrawals'
                                                    : item.type === 'OFFLINE_RECOVERY_REQUIRED'
                                                        ? '/admin/recovery-management'
                                                        : '/admin/complaints'
                                            )}
                                        >
                                            <div className="dashboard-notification-dot" />
                                            <div className="dashboard-notification-content">
                                                <strong>{item.title}</strong>
                                                <p>{item.message}</p>
                                                <span>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''}</span>
                                            </div>
                                            <FiExternalLink className="dashboard-notification-link" />
                                        </button>
                                    )) : <p className="chart-empty">Chưa có thông báo.</p>}
                                </div>
                            </div>
                        )}
                    </div>
                    <button type="button" className="dashboard-icon-btn" aria-label="Cài đặt">
                        <FiSettings />
                    </button>
                </div>
            </header>

            <div className="dashboard-body admin-page">
                <section className="dashboard-heading">
                    <h1>Tổng quan Thị trường</h1>
                    <p>Trạng thái và hiệu suất của Thị trường Quà tặng Công giáo trong {selectedDays} ngày gần nhất.</p>
                    {error && <p className="dashboard-error">{error}</p>}
                </section>

                <section className="dashboard-kpis">
                    {kpis.map((item) => (
                        <article className="dashboard-kpi-card" key={item.id}>
                            <div className="dashboard-kpi-top">
                                <div className={`kpi-icon ${item.iconClass}`}>{item.icon}</div>
                                <span className={`kpi-trend ${item.trendClass}`}>{item.trend}</span>
                            </div>
                            <p className="kpi-title">{item.title}</p>
                            <h3 className="kpi-value">{loading ? 'Đang tải...' : item.value}</h3>
                        </article>
                    ))}
                </section>

                <section className="dashboard-grid dashboard-grid--charts">
                    <article className="admin-card chart-card chart-card--wide">
                        <header className="activity-header">
                            <div>
                                <h3>Doanh thu theo ngày</h3>
   
                            </div>
                            <button type="button" className="activity-link" onClick={() => fetchDashboard(selectedDays)}>Làm mới</button>
                        </header>
                        <div className="chart-bars chart-bars--revenue">
                            {revenueTrend.length > 0 ? revenueTrend.map((item) => (
                                <div className="chart-bar-item" key={item.date}>
                                    <div className="chart-bar-track">
                                        <div className="chart-bar-fill" style={{ height: `${item.height}%` }} />
                                    </div>
                                    <strong>{formatCurrency(item.revenue)}</strong>
                                    <span>{item.orderNumber} đơn</span>
                                    <p>{item.date}</p>
                                </div>
                            )) : <p className="chart-empty">Chưa có dữ liệu doanh thu.</p>}
                        </div>
                    </article>

                    <article className="admin-card chart-card chart-card--financial">
                        <header className="activity-header">
                            <div>
                                <h3>Chỉ số tài chính</h3>
                                <p>Doanh thu nền tảng, hoa hồng và hoàn tiền</p>
                            </div>
                        </header>
                        <div className="status-chart-list">
                            <div className="status-chart-row status-chart-row--meta">
                                <span>Doanh thu nền tảng</span>
                                <strong>{formatCurrency(dashboard.platformFinancials.totalPlatformRevenue)}</strong>
                            </div>
                            {/* <div className="status-chart-row status-chart-row--meta">
                                <span>Hoa hồng đã kiếm</span>
                                <strong>{formatCurrency(dashboard.platformFinancials.totalCommissionEarned)}</strong>
                            </div>
                            <div className="status-chart-row status-chart-row--meta">
                                <span>Số dư khả dụng</span>
                                <strong>{formatCurrency(dashboard.platformFinancials.totalAvailableBalance)}</strong>
                            </div>
                            <div className="status-chart-row status-chart-row--meta">
                                <span>Số dư bị khóa</span>
                                <strong>{formatCurrency(dashboard.platformFinancials.totalLockedBalance)}</strong>
                            </div> */}
                            <div className="status-chart-row status-chart-row--meta">
                                <span>Tổng hoàn tiền</span>
                                <strong>{formatCurrency(dashboard.refundStats.totalRefundAmount)}</strong>
                            </div>
                            <div className="status-chart-row status-chart-row--meta">
                                <span>Rút tiền đã duyệt</span>
                                <strong>{formatCurrency(dashboard.withdrawalStats.totalWithdrawnAmount)}</strong>
                            </div>
                        </div>
                    </article>

                    <article className="admin-card chart-card">
                        <header className="activity-header">
                            <div>
                                <h3>Top khách hàng</h3>
                                <p>Khách có tổng chi tiêu cao nhất</p>
                            </div>
                            <button type="button" className="activity-link">Xem thêm</button>
                        </header>
                        <div className="category-chart-list">
                            {topCustomerBars.length > 0 ? topCustomerBars.map((item, index) => (
                                <div className="category-chart-row" key={item.customerId || index}>
                                    <div className="category-chart-labels">
                                        <strong>{item.customerName || 'Khách hàng'}</strong>
                                        <span>{item.email || '—'}</span>
                                    </div>
                                    <div className="category-chart-track">
                                        <div className="category-chart-fill category-chart-fill--green" style={{ width: `${item.height}%` }} />
                                    </div>
                                    <strong>{formatCurrency(item.totalSpent)}</strong>
                                </div>
                            )) : <p className="chart-empty">Chưa có dữ liệu khách hàng.</p>}
                        </div>
                    </article>

                    <article className="admin-card chart-card">
                        <header className="activity-header">
                            <div>
                                <h3>Top nghệ nhân</h3>
                                <p>Theo tổng doanh thu và đánh giá</p>
                            </div>
                        </header>
                        <div className="category-chart-list">
                            {topArtisanBars.length > 0 ? topArtisanBars.map((item, index) => (
                                <div className="category-chart-row" key={item.artisanId || index}>
                                    <div className="category-chart-labels">
                                        <strong>{item.artisanName || 'Nghệ nhân'}</strong>
                                        <span>{formatNumber(item.totalOrders)} đơn • ⭐ {Number(item.averageRating || 0).toFixed(1)}</span>
                                    </div>
                                    <div className="category-chart-track">
                                        <div className="category-chart-fill category-chart-fill--purple" style={{ width: `${item.height}%` }} />
                                    </div>
                                    <strong>{formatCurrency(item.totalRevenue)}</strong>
                                </div>
                            )) : <p className="chart-empty">Chưa có dữ liệu nghệ nhân.</p>}
                        </div>
                    </article>

                    <article className="admin-card chart-card">
                        <header className="activity-header">
                            <div>
                                <h3>Top sản phẩm</h3>
                                <p>Sản phẩm bán chạy nhất</p>
                            </div>
                            <button type="button" className="activity-link">Xem thêm</button>
                        </header>
                        <div className="category-chart-list">
                            {topProductBars.length > 0 ? topProductBars.map((item, index) => (
                                <div className="category-chart-row" key={item.productId || index}>
                                    <div className="category-chart-labels">
                                        <strong>{item.productName || 'Sản phẩm'}</strong>
                                        <span>{item.sold || 0} đã bán</span>
                                    </div>
                                    <div className="category-chart-track">
                                        <div className="category-chart-fill category-chart-fill--blue" style={{ width: `${item.height}%` }} />
                                    </div>
                                    <strong>{formatCurrency(item.revenue)}</strong>
                                </div>
                            )) : <p className="chart-empty">Chưa có dữ liệu sản phẩm.</p>}
                        </div>
                    </article>

                    <aside className="dashboard-side-column">
                        <article className="admin-card quick-actions-card">
                            <h3>THAO TÁC NHANH</h3>
                            <div className="quick-actions-list">
                                {quickActions.map((action) => (
                                    <button
                                        type="button"
                                        className="quick-action-item"
                                        key={action.id}
                                        onClick={action.onClick}
                                    >
                                        <span className="quick-action-icon">{action.icon}</span>
                                        <span>{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </article>

                        <article className="admin-card system-status-card">
                            <h3>THÔNG TIN MỚI</h3>
                            <div className="status-row">
                                <span>Đơn sản phẩm</span>
                                <strong>{formatNumber(dashboard.productAnalytics.totalProducts)}</strong>
                            </div>
                            <div className="status-row">
                                <span>Đơn khiếu nại</span>
                                <strong>{formatNumber(dashboard.complaintStats.totalComplaints)}</strong>
                            </div>
                            <div className="status-row">
                                <span>Yêu cầu rút tiền</span>
                                <strong>{formatNumber(dashboard.withdrawalStats.totalRequests)}</strong>
                            </div>
                            <div className="status-row">
                                <span>Tổng hoàn tiền</span>
                                <strong>{formatCurrency(dashboard.refundStats.totalRefundAmount)}</strong>
                            </div>
                            <div className="status-progress">
                                <span style={{ width: `${Math.min(100, dashboard.customerStats.totalCustomers ? (dashboard.customerStats.activeCustomers / dashboard.customerStats.totalCustomers) * 100 : 0)}%` }} />
                            </div>
                            <p>{loading ? 'Đang tải dữ liệu dashboard...' : `Tỷ lệ khách hàng active: ${dashboard.customerStats.totalCustomers ? ((dashboard.customerStats.activeCustomers / dashboard.customerStats.totalCustomers) * 100).toFixed(1) : '0.0'}%`}</p>
                        </article>
                    </aside>
                </section>
            </div>
        </div>
    );
};

export default AdminDashboard;