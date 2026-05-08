import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBarChart2, FiClock, FiMessageCircle, FiPackage, FiPieChart, FiTrendingUp, FiTruck } from 'react-icons/fi';
import { getOrdersByArtisan } from '../../../services/orderService';
import { getMyWallet, getWalletTransactions } from '../../../services/walletService';
import { getOpenCustomRequests, getArtisanCustomOrders, getCustomOrderStages } from '../../../services/customRequestService';
import { getMyConversations } from '../../../services/chatService';
import { getNotifications, getUnreadNotificationCount, markAllNotificationsAsRead, markNotificationAsRead } from '../../../services/notificationService';
import { appToast } from '../../../lib/appToast';
import api from '../../../cofig/api';
import './Workbench.css';

const formatCurrencyVnd = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))}`;
const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('vi-VN');
};

const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('vi-VN');
};

const normalizeStatus = (status) => String(status || '').toUpperCase();

const getOrderStatusLabel = (status) => {
    const key = normalizeStatus(status);
    const map = {
        PENDING: 'Chờ xử lý',
        PAID: 'Đã thanh toán',
        SHIPPING: 'Đang giao',
        DELIVERED: 'Đã giao',
        COMPLETED: 'Hoàn thành',
        CANCELLED: 'Đã hủy',
        DELETED: 'Đã xoá',
        CONFIRMED: 'Đã xác nhận',
    };
    return map[key] || status || '—';
};

const getStatusClass = (status) => {
    const key = normalizeStatus(status);
    if (['PENDING', 'PAID'].includes(key)) return 'wb-badge--amber';
    if (['SHIPPING', 'IN_PROGRESS', 'CONFIRMED'].includes(key)) return 'wb-badge--blue';
    if (['COMPLETED'].includes(key)) return 'wb-badge--green';
    if (['CANCELLED'].includes(key)) return 'wb-badge--gray';
    return 'wb-badge--gray';
};

const getPaymentMethodLabel = (method) => {
    const key = String(method || '').toUpperCase();
    const map = {
        COD: 'COD',
        CARD: 'Thẻ',
        PAYPAL: 'PayPal',
        BANK: 'Chuyển khoản',
    };
    return map[key] || method || '—';
};

const shortId = (id) => {
    const text = String(id || '');
    if (!text) return '—';
    return text.length > 14 ? `${text.slice(0, 14)}...` : text;
};

const getConversationName = (conv) => conv?.otherUserName || conv?.customerName || conv?.name || 'Khách hàng';

const getInitials = (name) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'KH';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

const getRelative = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const diff = Date.now() - date.getTime();
    const minute = Math.max(1, Math.floor(diff / 60000));
    if (minute < 60) return `${minute} phút trước`;
    const hour = Math.floor(minute / 60);
    if (hour < 24) return `${hour} giờ trước`;
    const day = Math.floor(hour / 24);
    if (day < 7) return `${day} ngày trước`;
    return formatDate(date);
};

const getTransactionAmount = (tx) => Number(tx?.amount ?? tx?.value ?? tx?.money ?? 0);
const isDepositTransaction = (tx) => String(tx?.type || tx?.transactionType || '').toUpperCase().includes('DEPOSIT');
const isCurrentMonth = (value) => {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
};

const getDueDate = (stage) => stage?.dueDate || stage?.estimatedDueDate || stage?.deadline || stage?.expectedAt || null;

const pickFirstNumber = (...values) => {
    for (const value of values) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return numeric;
    }
    return 0;
};

const pickFirstDate = (...values) => {
    for (const value of values) {
        if (!value) continue;
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return date;
    }
    return null;
};

const toPercent = (value) => `${Math.max(0, Math.min(100, Number(value) || 0)).toFixed(0)}%`;

const buildDashboardModel = (payload) => {
    const data = payload?.data ?? payload ?? {};
    const customOrderStats = data?.artisanCustomOrderStats || {};
    const financialDetails = data?.financialDetails || {};
    const customerAnalytics = data?.customerAnalytics || {};
    const performanceMetrics = data?.performanceMetrics || {};
    const summary = data?.summary || {};
    const templatePerformance = data?.templatePerformance || {};
    const orderStatus = data?.orderStatus || {};

    const totalOrders = pickFirstNumber(summary?.totalOrders, customOrderStats?.totalOrders, orderStatus?.PAID, orderStatus?.PENDING);
    const totalRequests = pickFirstNumber(customOrderStats?.totalRequests, data?.openRequests, data?.requestStats?.totalRequests);
    const avgOrderValue = pickFirstNumber(customOrderStats?.avgOrderValue, financialDetails?.avgOrderValue);
    const conversionRate = pickFirstNumber(customOrderStats?.conversionRate, templatePerformance?.templateConversionRate);
    const pendingRequests = pickFirstNumber(customOrderStats?.pendingRequests);
    const avgCompletionDays = pickFirstNumber(customOrderStats?.avgCompletionDays);
    const grossEarnings = pickFirstNumber(financialDetails?.grossEarnings);
    const totalCommission = pickFirstNumber(financialDetails?.totalCommission);
    const pendingWithdrawal = pickFirstNumber(financialDetails?.pendingWithdrawal);
    const currentBalance = pickFirstNumber(financialDetails?.currentBalance);
    const netEarnings = pickFirstNumber(financialDetails?.netEarnings);
    const totalCustomers = pickFirstNumber(customerAnalytics?.totalCustomers);
    const repeatCustomerRate = pickFirstNumber(customerAnalytics?.repeatCustomerRate);
    const totalTemplates = pickFirstNumber(templatePerformance?.totalTemplates);
    const templateConversionRate = pickFirstNumber(templatePerformance?.templateConversionRate);
    const orderFulfillmentRate = pickFirstNumber(performanceMetrics?.orderFulfillmentRate);
    const complaintRate = pickFirstNumber(performanceMetrics?.complaintRate);
    const avgResponseTimeHours = pickFirstNumber(performanceMetrics?.avgResponseTimeHours);
    const avgRating = performanceMetrics?.avgRating ?? null;
    const totalReviews = pickFirstNumber(performanceMetrics?.totalReviews);
    const revenueChart = Array.isArray(data?.revenueChart) ? data.revenueChart : [];
    const topCustomers = Array.isArray(data?.artisanTopCustomers) ? data.artisanTopCustomers : [];
    const topProducts = Array.isArray(data?.topProducts) ? data.topProducts : [];
    const topTemplates = Array.isArray(data?.topTemplates) ? data.topTemplates : [];
    const lowStockProducts = Array.isArray(data?.lowStockProducts) ? data.lowStockProducts : [];
    const revenueBreakdown = Array.isArray(data?.revenueBreakdown) ? data.revenueBreakdown : [];
    const statusEntries = Object.entries(orderStatus || {}).map(([status, value]) => ({ status, value: Number(value) || 0 }));

    return {
        summary: {
            totalOrders,
            totalRequests,
            avgOrderValue,
            conversionRate,
            pendingRequests,
            avgCompletionDays,
        },
        financialDetails: {
            grossEarnings,
            totalCommission,
            pendingWithdrawal,
            currentBalance,
            netEarnings,
        },
        customerAnalytics: {
            totalCustomers,
            repeatCustomerRate,
        },
        performanceMetrics: {
            orderFulfillmentRate,
            complaintRate,
            avgResponseTimeHours,
            avgRating,
            totalReviews,
        },
        templatePerformance: {
            totalTemplates,
            templateConversionRate,
        },
        statusEntries,
        revenueChart,
        revenueBreakdown,
        topCustomers,
        topProducts,
        topTemplates,
        lowStockProducts,
        fetchedAt: new Date().toLocaleString('vi-VN'),
    };
};

const resolveNotificationTarget = (notification) => {
    const type = String(notification?.type || '').toUpperCase();
    const relatedEntityId = notification?.relatedEntityId;
    const actionType = String(notification?.actionType || '').toUpperCase();

    const typeMap = {
        WITHDRAWAL_REQUESTED: '/artisan/wallet',
        ARTISAN_RESPONDED: '/artisan/complaints',
        OFFLINE_RECOVERY_REQUIRED: relatedEntityId ? `/artisan/orders/${relatedEntityId}` : '/artisan/orders',
        ORDER_CREATED: '/artisan/orders',
        ORDER_PAID: '/artisan/orders',
        ORDER_UPDATED: '/artisan/orders',
        CUSTOM_ORDER_CREATED: '/artisan/requests',
        CUSTOM_ORDER_UPDATED: '/artisan/requests',
        CUSTOM_REQUEST_CREATED: '/artisan/requests',
        CUSTOM_REQUEST_UPDATED: '/artisan/requests',
        MESSAGE_RECEIVED: '/artisan/messages',
        CHAT_MESSAGE: '/artisan/messages',
        REVIEW_REQUESTED: '/artisan/complaints',
        TEMPLATE_REVIEW_REQUIRED: '/artisan/templates',
        TEMPLATE_REVIEW_APPROVED: '/artisan/templates',
        TEMPLATE_REVIEW_REJECTED: '/artisan/templates',
    };

    if (actionType === 'VIEW_REQUEST' && relatedEntityId) {
        return '/artisan/wallet';
    }

    if (actionType === 'REVIEW_RECOVERY' && relatedEntityId) {
        return `/artisan/orders/${relatedEntityId}`;
    }

    const candidate = notification?.targetUrl || notification?.url || notification?.link || notification?.actionUrl || notification?.data?.url || notification?.data?.targetUrl;
    if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.startsWith('/') ? candidate : `/${candidate.replace(/^\/+/, '')}`;
    }

    return typeMap[type] || null;
};

const getNotificationIconClass = (notification) => {
    const type = String(notification?.type || '').toUpperCase();
    if (type.includes('WITHDRAWAL')) return 'wb-notification-icon--amber';
    if (type.includes('RECOVERY')) return 'wb-notification-icon--red';
    if (type.includes('MESSAGE') || type.includes('CHAT')) return 'wb-notification-icon--blue';
    if (type.includes('COMPLAINT') || type.includes('RESPONDED') || type.includes('REVIEW')) return 'wb-notification-icon--purple';
    return 'wb-notification-icon--green';
};

const Workbench = ({ user }) => {
    const navigate = useNavigate();
    const artisanId = user?.id || user?.artisanId || user?.artisanUuid;

    const [orders, setOrders] = useState([]);
    const [latestOrders, setLatestOrders] = useState([]);
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [customOrdersWithStage, setCustomOrdersWithStage] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [openRequests, setOpenRequests] = useState([]);
    const [openRequestTotal, setOpenRequestTotal] = useState(0);
    const [actionableCount, setActionableCount] = useState(0);
    const [shipmentCandidates, setShipmentCandidates] = useState([]);
    const [notificationCount, setNotificationCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationsError, setNotificationsError] = useState('');
    const [dashboard, setDashboard] = useState(null);
    const [loadingDashboard, setLoadingDashboard] = useState(true);
    const [dashboardError, setDashboardError] = useState('');
    const [revenueChartMode, setRevenueChartMode] = useState('day');
    const [revenueChartMonth, setRevenueChartMonth] = useState(() => new Date().toISOString().slice(0, 7));

    const [loadingOrders, setLoadingOrders] = useState(true);
    const [loadingWallet, setLoadingWallet] = useState(true);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [loadingCustomOrders, setLoadingCustomOrders] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(true);

    useEffect(() => {
        if (!artisanId) return;

        let active = true;

        const ordersTask = getOrdersByArtisan(artisanId)
            .then((res) => {
                if (!active) return;
                if (res.success) {
                    const list = Array.isArray(res.data) ? res.data : [];
                    setOrders(list);
                } else {
                    setOrders([]);
                    appToast.error('Không tải được đơn hàng', res.error || 'Vui lòng thử lại.');
                }
            })
            .catch(() => {
                if (!active) return;
                appToast.error('Không tải được đơn hàng', 'Vui lòng thử lại.');
                setOrders([]);
            })
            .finally(() => {
                if (active) setLoadingOrders(false);
            });

        const latestOrdersTask = api.get(`/order/artisan/${artisanId}`, {
            params: { page: 0, size: 3, sortBy: 'createAt', sortDirection: 'DESC' },
        })
            .then((res) => {
                if (!active) return;
                const payload = res?.data?.data ?? res?.data ?? {};
                const list = Array.isArray(payload)
                    ? payload
                    : Array.isArray(payload?.content)
                        ? payload.content
                        : [];
                setLatestOrders(list);
            })
            .catch(() => {
                if (!active) return;
                setLatestOrders([]);
            });

        const walletTask = Promise.all([getMyWallet(), getWalletTransactions()])
            .then(([walletRes, txRes]) => {
                if (!active) return;
                if (walletRes.success) setWallet(walletRes.data);
                else {
                    setWallet(null);
                    appToast.error('Không tải được ví', walletRes.error || 'Vui lòng thử lại.');
                }

                if (txRes.success) setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
                else {
                    setTransactions([]);
                    appToast.error('Không tải được lịch sử ví', txRes.error || 'Vui lòng thử lại.');
                }
            })
            .catch(() => {
                if (!active) return;
                setWallet(null);
                setTransactions([]);
                appToast.error('Không tải được dữ liệu ví', 'Vui lòng thử lại.');
            })
            .finally(() => {
                if (active) setLoadingWallet(false);
            });

        const requestsTask = getOpenCustomRequests({ page: 0, size: 3 })
            .then((res) => {
                if (!active) return;
                if (res.success) {
                    const content = Array.isArray(res.data?.content) ? res.data.content : [];
                    setOpenRequests(content);
                    setOpenRequestTotal(Number(res.data?.totalElements ?? content.length ?? 0));
                } else {
                    setOpenRequests([]);
                    setOpenRequestTotal(0);
                    appToast.error('Không tải được yêu cầu mở', res.error || 'Vui lòng thử lại.');
                }
            })
            .catch(() => {
                if (!active) return;
                setOpenRequests([]);
                setOpenRequestTotal(0);
                appToast.error('Không tải được yêu cầu mở', 'Vui lòng thử lại.');
            })
            .finally(() => {
                if (active) setLoadingRequests(false);
            });

        const customOrdersTask = getArtisanCustomOrders()
            .then(async (res) => {
                if (!active) return;
                if (!res.success) {
                    setCustomOrdersWithStage([]);
                    appToast.error('Không tải được đơn tùy chỉnh', res.error || 'Vui lòng thử lại.');
                    return;
                }

                const list = Array.isArray(res.data) ? res.data : [];

                const inProgress = list.filter((item) => normalizeStatus(item?.status) === 'IN_PROGRESS');
                const stages = await Promise.all(inProgress.map(async (order) => {
                    const id = order?.id || order?.orderId || order?.customOrderId;
                    if (!id) return { order, stage: null };
                    const stageRes = await getCustomOrderStages(id);
                    if (!stageRes.success) return { order, stage: null };

                    const arr = Array.isArray(stageRes.data) ? stageRes.data : [];
                    const target = arr.find((s) => s?.canComplete === true)
                        || arr.find((s) => normalizeStatus(s?.status) === 'PAID')
                        || arr[0]
                        || null;
                    return { order, stage: target };
                }));

                if (active) setCustomOrdersWithStage(stages);
            })
            .catch(() => {
                if (!active) return;
                setCustomOrdersWithStage([]);
                appToast.error('Không tải được đơn tùy chỉnh', 'Vui lòng thử lại.');
            })
            .finally(() => {
                if (active) setLoadingCustomOrders(false);
            });

        const messagesTask = getMyConversations()
            .then((res) => {
                if (!active) return;
                if (res.success) {
                    setConversations(Array.isArray(res.data) ? res.data : []);
                } else {
                    setConversations([]);
                    appToast.error('Không tải được tin nhắn', res.error || 'Vui lòng thử lại.');
                }
            })
            .catch(() => {
                if (!active) return;
                setConversations([]);
                appToast.error('Không tải được tin nhắn', 'Vui lòng thử lại.');
            })
            .finally(() => {
                if (active) setLoadingMessages(false);
            });

        const notificationTask = Promise.all([
            getUnreadNotificationCount(),
            getNotifications({ page: 0, size: 20 }),
        ])
            .then(([countRes, listRes]) => {
                if (!active) return;
                if (countRes.success) setNotificationCount(countRes.data || 0);
                else setNotificationCount(0);

                if (listRes.success) {
                    const list = Array.isArray(listRes.data?.content) ? listRes.data.content : [];
                    setNotifications(list);
                } else {
                    setNotifications([]);
                }
            })
            .catch(() => {
                if (!active) return;
                setNotificationCount(0);
                setNotifications([]);
            });

        void Promise.all([
            ordersTask,
            latestOrdersTask,
            walletTask,
            requestsTask,
            customOrdersTask,
            messagesTask,
            notificationTask,
        ]);

        return () => {
            active = false;
        };
    }, [artisanId]);

    useEffect(() => {
        let active = true;

        const loadDashboard = async () => {
            setLoadingDashboard(true);
            setDashboardError('');
            try {
                const response = await api.get('/artisan/dashboard', {
                    params: { days: 32 },
                });
                if (!active) return;

                const payload = response?.data;
                const parsed = buildDashboardModel(payload);
                setDashboard(parsed);
            } catch (error) {
                if (!active) return;
                setDashboard(null);
                setDashboardError(error?.response?.data?.message || 'Không tải được dữ liệu dashboard.');
            } finally {
                if (active) setLoadingDashboard(false);
            }
        };

        loadDashboard();
        return () => {
            active = false;
        };
    }, [artisanId]);

    const processingOrdersCount = useMemo(
        () => orders.filter((item) => ['PENDING', 'PAID', 'SHIPPING'].includes(normalizeStatus(item?.status))).length,
        [orders],
    );

    const dashboardStats = useMemo(() => ({
        totalOrders: dashboard?.summary?.totalOrders || 0,
        totalRequests: dashboard?.summary?.totalRequests || 0,
        avgOrderValue: dashboard?.summary?.avgOrderValue || 0,
        conversionRate: dashboard?.summary?.conversionRate || 0,
        pendingRequests: dashboard?.summary?.pendingRequests || 0,
        avgCompletionDays: dashboard?.summary?.avgCompletionDays || 0,
        grossEarnings: dashboard?.financialDetails?.grossEarnings || 0,
        totalCommission: dashboard?.financialDetails?.totalCommission || 0,
        pendingWithdrawal: dashboard?.financialDetails?.pendingWithdrawal || 0,
        currentBalance: dashboard?.financialDetails?.currentBalance || 0,
        netEarnings: dashboard?.financialDetails?.netEarnings || 0,
        totalCustomers: dashboard?.customerAnalytics?.totalCustomers || 0,
        repeatCustomerRate: dashboard?.customerAnalytics?.repeatCustomerRate || 0,
        totalTemplates: dashboard?.templatePerformance?.totalTemplates || 0,
        templateConversionRate: dashboard?.templatePerformance?.templateConversionRate || 0,
        orderFulfillmentRate: dashboard?.performanceMetrics?.orderFulfillmentRate || 0,
        complaintRate: dashboard?.performanceMetrics?.complaintRate || 0,
        avgResponseTimeHours: dashboard?.performanceMetrics?.avgResponseTimeHours || 0,
        avgRating: dashboard?.performanceMetrics?.avgRating,
        totalReviews: dashboard?.performanceMetrics?.totalReviews || 0,
    }), [dashboard]);

    const revenueTrend = useMemo(() => {
        const list = Array.isArray(dashboard?.revenueChart) ? dashboard.revenueChart : [];
        const normalizeDateKey = (value) => {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return null;
            return date.toISOString().slice(0, 10);
        };

        const monthLabel = (yearMonth) => {
            if (!yearMonth) return '—';
            const [year, month] = yearMonth.split('-').map(Number);
            if (!year || !month) return yearMonth;
            return new Date(year, month - 1, 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
        };

        const filtered = list.filter((item) => {
            if (revenueChartMode === 'day' || revenueChartMode === 'week') {
                if (!revenueChartMonth) return true;
                const rawDate = item?.date || item?.day || item?.createdAt;
                const date = new Date(rawDate);
                if (Number.isNaN(date.getTime())) return false;
                return date.toISOString().slice(0, 7) === revenueChartMonth;
            }
            return true;
        });

        const grouped = filtered.reduce((acc, item) => {
            const rawDate = item?.date || item?.day || item?.createdAt;
            const date = new Date(rawDate);
            if (Number.isNaN(date.getTime())) return acc;

            let groupKey = rawDate;
            let label = formatDate(rawDate);

            if (revenueChartMode === 'week') {
                const day = date.getDay();
                const monday = new Date(date);
                const diff = day === 0 ? -6 : 1 - day;
                monday.setDate(date.getDate() + diff);
                monday.setHours(0, 0, 0, 0);
                groupKey = monday.toISOString().slice(0, 10);
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                label = `${formatDate(monday)} - ${formatDate(sunday)}`;
            } else if (revenueChartMode === 'month') {
                groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                label = monthLabel(groupKey);
            } else {
                groupKey = normalizeDateKey(rawDate) || rawDate;
                label = formatDate(rawDate);
            }

            const current = acc.get(groupKey) || {
                date: rawDate,
                label,
                revenue: 0,
                orderNumber: 0,
            };

            current.revenue += Number(item?.revenue || 0);
            current.orderNumber += Number(item?.orderNumber || item?.orders || 0);
            current.date = rawDate;
            current.label = label;
            acc.set(groupKey, current);
            return acc;
        }, new Map());

        const groupedList = Array.from(grouped.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
        const peak = Math.max(...groupedList.map((item) => Number(item.revenue || 0)), 1);

        return groupedList.map((item) => ({
            ...item,
            height: Math.max(12, Math.round((Number(item.revenue || 0) / peak) * 100)),
        }));
    }, [dashboard, revenueChartMode, revenueChartMonth]);

    const totalReceived = useMemo(
        () => transactions.filter(isDepositTransaction).reduce((sum, tx) => sum + getTransactionAmount(tx), 0),
        [transactions],
    );

    const monthReceived = useMemo(
        () => transactions
            .filter((tx) => isDepositTransaction(tx) && isCurrentMonth(tx?.createdAt || tx?.createAt || tx?.transactionDate))
            .reduce((sum, tx) => sum + getTransactionAmount(tx), 0),
        [transactions],
    );

    const sortedConversations = useMemo(() => {
        const list = [...conversations];
        list.sort((a, b) => {
            const ta = new Date(a?.lastMessageTime || a?.updatedAt || 0).getTime();
            const tb = new Date(b?.lastMessageTime || b?.updatedAt || 0).getTime();
            return tb - ta;
        });
        return list.slice(0, 3);
    }, [conversations]);

    const displayName = user?.fullName || user?.name || user?.username || 'bạn';
    const hasDashboardData = Boolean(dashboard);

    const handleNotificationClick = async (notification) => {
        if (!notification) return;

        const notificationId = notification?.notificationId || notification?.id;
        if (!notification?.isRead && notificationId) {
            const res = await markNotificationAsRead(notificationId);
            if (!res.success) {
                appToast.error('Không thể đánh dấu đã đọc', res.error || 'Vui lòng thử lại.');
                return;
            }

            setNotifications((prev) => prev.map((item) => (item?.notificationId === notificationId || item?.id === notificationId ? { ...item, isRead: true, read: true } : item)));
            setNotificationCount((prev) => Math.max(0, prev - 1));
        }

        const targetUrl = resolveNotificationTarget(notification);
        setShowNotifications(false);

        if (targetUrl) {
            navigate(targetUrl);
        }
    };

    const handleMarkAllNotificationsAsRead = async () => {
        setNotificationsLoading(true);
        setNotificationsError('');
        try {
            const res = await markAllNotificationsAsRead();
            if (!res.success) {
                appToast.error('Không thể đánh dấu đã đọc', res.error || 'Vui lòng thử lại.');
                return;
            }

            setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true, read: true })));
            setNotificationCount(0);
        } catch (err) {
            setNotificationsError(err?.response?.data?.message || err?.message || 'Không thể đánh dấu tất cả đã đọc.');
        } finally {
            setNotificationsLoading(false);
        }
    };

    return (
        <div className="wb">
            <header className="wb-header">
                <div>
                    <h1 className="wb-title">Workbench</h1>
                    <p className="wb-subtitle">Xin chào {displayName}! Hôm nay bạn có {actionableCount} việc cần xử lý.</p>
                </div>

                <div className="wb-header-actions">
                    <div className="wb-notification-wrap">
                        <button type="button" className="wb-notification-btn" onClick={() => setShowNotifications((value) => !value)} aria-label="Thông báo">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M15 17H5l1.4-1.4A2 2 0 0 0 7 14.2V10a5 5 0 1 1 10 0v4.2a2 2 0 0 0 .6 1.4L19 17h-4m-5 0a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>

                        {showNotifications && (
                            <div className="wb-notification-dropdown" role="dialog" aria-label="Danh sách thông báo">
                                <div className="wb-notification-dropdown-header">
                                    <h4>Thông báo mới</h4>
                                    <div className="wb-notification-actions">
                                        <button
                                            type="button"
                                            className="wb-notification-mark-all"
                                            onClick={handleMarkAllNotificationsAsRead}
                                            disabled={notificationsLoading || notificationCount === 0}
                                        >
                                            Đánh dấu tất cả đã đọc
                                        </button>
                                        <button
                                            type="button"
                                            className="wb-notification-mark-all"
                                            onClick={async () => {
                                                const refreshed = await Promise.all([getUnreadNotificationCount(), getNotifications({ page: 0, size: 20 })]);
                                                const [countRes, listRes] = refreshed;
                                                if (countRes?.success) setNotificationCount(Number(countRes.data) || 0);
                                                if (listRes?.success) {
                                                    setNotifications(Array.isArray(listRes.data?.content) ? listRes.data.content : []);
                                                }
                                            }}
                                        >
                                            Làm mới
                                        </button>
                                    </div>
                                </div>
                                <div className="wb-notification-list">
                                    {notificationsError ? (
                                        <div className="wb-notification-empty">{notificationsError}</div>
                                    ) : notifications.length === 0 ? (
                                        <div className="wb-notification-empty">Chưa có thông báo mới.</div>
                                    ) : (
                                        notifications.map((notification, index) => (
                                            <button
                                                key={notification?.notificationId || notification?.id || index}
                                                type="button"
                                                className={`wb-notification-item ${notification?.isRead ? 'read' : 'unread'}`}
                                                onClick={() => {
                                                    void handleNotificationClick(notification);
                                                }}
                                            >
                                                <div className={`wb-notification-icon ${getNotificationIconClass(notification)}`}>
                                                    <FiMessageCircle />
                                                </div>
                                                <div className="wb-notification-content">
                                                    <div className="wb-notification-item-top">
                                                        <span className="wb-notification-title">{notification?.title || notification?.type || 'Thông báo'}</span>
                                                    </div>
                                                    <p className="wb-notification-message">{notification?.message || notification?.content || 'Bạn có một thông báo mới.'}</p>
                                                    <div className="wb-notification-meta-row">
                                                        <span className="wb-notification-time">{formatDateTime(notification?.createdAt || notification?.time || '')}</span>
                                                        <span className="wb-notification-chev">→</span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <section className="wb-dashboard-panel">
                <div className="wb-dashboard-head">
                    <div>
              
                        <h2>Bức tranh tổng quan cho artisan</h2>
                    </div>
                    <div className="wb-dashboard-meta">
                        <span className="wb-dashboard-meta-item"><FiClock /> {loadingDashboard ? 'Đang tải...' : 'Cập nhật gần nhất'}</span>
                        <span className="wb-dashboard-meta-item"><FiBarChart2 /> {dashboardStats.totalOrders} đơn · {dashboardStats.totalCustomers} khách</span>
                    </div>
                </div>

                {loadingDashboard ? (
                    <WidgetSkeleton rows={4} />
                ) : dashboardError ? (
                    <div className="wb-dashboard-empty">
                        <strong>Không tải được dashboard</strong>
                        <p>{dashboardError}</p>
                    </div>
                ) : hasDashboardData ? (
                    <>
                        <div className="wb-dashboard-cards">
                            <DashboardCard icon={<FiBarChart2 />} label="Tổng đơn" value={dashboardStats.totalOrders} helper="Tổng đơn từ API" tone="blue" />
                            <DashboardCard icon={<FiTrendingUp />} label="Doanh thu" value={dashboardStats.grossEarnings} helper="Doanh thu gộp" tone="green" />
                            <DashboardCard icon={<FiTruck />} label="Yêu cầu mở" value={dashboardStats.totalRequests} helper="Số lượng yêu cầu mở" tone="amber" />
                            <DashboardCard icon={<FiMessageCircle />} label="Khách quay lại" value={toPercent(dashboardStats.repeatCustomerRate)} helper="Tỷ lệ khách quay lại" tone="purple" />
                        </div>

                        <div className="wb-dashboard-charts">
                            <article className="wb-chart-card">
                                <div className="wb-chart-head wb-chart-head--split">
                                    <div>
                                        <h3>Doanh thu</h3>
                                        <p>Xem theo ngày, tuần hoặc tháng</p>
                                    </div>
                                    <div className="wb-chart-controls">
                                        <div className="wb-chart-filter">
                                            <button type="button" className={revenueChartMode === 'day' ? 'wb-chart-filter-btn active' : 'wb-chart-filter-btn'} onClick={() => setRevenueChartMode('day')}>
                                                Ngày
                                            </button>
                                            <button type="button" className={revenueChartMode === 'week' ? 'wb-chart-filter-btn active' : 'wb-chart-filter-btn'} onClick={() => setRevenueChartMode('week')}>
                                                Tuần
                                            </button>
                                            <button type="button" className={revenueChartMode === 'month' ? 'wb-chart-filter-btn active' : 'wb-chart-filter-btn'} onClick={() => setRevenueChartMode('month')}>
                                                Tháng
                                            </button>
                                        </div>
                                        {(revenueChartMode === 'day' || revenueChartMode === 'week') && (
                                            <label className="wb-month-select-wrap">
                                                <span>Tháng</span>
                                                <select value={revenueChartMonth} onChange={(event) => setRevenueChartMonth(event.target.value)}>
                                                    <option value="">Tất cả</option>
                                                    {Array.from(new Set((dashboard?.revenueChart || []).map((item) => {
                                                        const rawDate = item?.date || item?.day || item?.createdAt;
                                                        const date = new Date(rawDate);
                                                        return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 7);
                                                    }).filter(Boolean))).sort().map((month) => (
                                                        <option key={month} value={month}>{month}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                    </div>
                                    <FiBarChart2 />
                                </div>
                                <div className="wb-bar-chart-scroll" data-mode={revenueChartMode}>
                                    <div className={`wb-bar-chart wb-bar-chart--revenue wb-bar-chart--${revenueChartMode}`} role="img" aria-label="Biểu đồ doanh thu">
                                        {revenueTrend.length === 0 ? <p className="wb-empty">Chưa có dữ liệu doanh thu.</p> : revenueTrend.map((item) => (
                                            <div key={`${item.label}-${item.date}`} className="wb-bar-chart-item">
                                                <div className="wb-bar-track">
                                                    <div className="wb-bar-fill" style={{ height: `${item.height}%` }} />
                                                </div>
                                                <span className="wb-bar-label">{item.label}</span>
                                                <strong className="wb-bar-value">{formatCurrencyVnd(item.revenue)}</strong>
                                                <span className="wb-bar-small">{item.orderNumber} đơn</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </article>

                            <article className="wb-chart-card">
                                <div className="wb-chart-head">
                                    <div>
                                        <h3>Phân phối đơn hàng</h3>
                                    </div>
                                    <FiPieChart />
                                </div>
                                <div className="wb-status-list">
                                    {dashboard?.statusEntries?.map((entry) => (
                                        <div key={entry.status} className="wb-status-row">
                                            <span>{getOrderStatusLabel(entry.status)}</span>
                                            <strong>{entry.value}</strong>
                                        </div>
                                    ))}
                                    <div className="wb-status-row">
                                        <span>Hoàn tất đơn</span>
                                        <strong>{toPercent(dashboardStats.orderFulfillmentRate)}</strong>
                                    </div>
                                    <div className="wb-status-row">
                                        <span>Tỷ lệ khiếu nại</span>
                                        <strong>{toPercent(dashboardStats.complaintRate)}</strong>
                                    </div>
                                    <div className="wb-status-row">
                                        <span>Thời gian phản hồi TB</span>
                                        <strong>{dashboardStats.avgResponseTimeHours.toFixed(1)} giờ</strong>
                                    </div>
                                </div>
                            </article>

                            <article className="wb-chart-card wb-chart-card--list">
                                <div className="wb-chart-head">
                                    <div>
                                        <h3>Top khách hàng & sản phẩm</h3>
                                    </div>
                                    <FiTruck />
                                </div>
                                <div className="wb-top-lists">
                                    <div className="wb-top-list-block">
                                        <h4>Top khách hàng</h4>
                                        {dashboard.topCustomers.length === 0 ? (
                                            <p className="wb-empty">Chưa có dữ liệu.</p>
                                        ) : dashboard.topCustomers.slice(0, 4).map((customer, index) => (
                                            <div key={customer.customerId || index} className="wb-top-item">
                                                <div>
                                                    <strong>{customer.customerName || 'Khách hàng'}</strong>
                                                    <p>{customer.email || '—'}</p>
                                                </div>
                                                <span>{customer.totalOrders || 0} đơn · {formatCurrencyVnd(customer.totalSpent)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="wb-top-list-block">
                                        <h4>Top sản phẩm</h4>
                                        {dashboard.topProducts.length === 0 ? (
                                            <p className="wb-empty">Chưa có dữ liệu.</p>
                                        ) : dashboard.topProducts.slice(0, 4).map((product, index) => (
                                            <div key={product.productId || index} className="wb-top-item">
                                                <div>
                                                    <strong>{product.productName || 'Sản phẩm'}</strong>
                                                    <p>{product.sold || 0} đã bán</p>
                                                </div>
                                                <span>{formatCurrencyVnd(product.revenue)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </article>
                        </div>
                    </>
                ) : (
                    <div className="wb-dashboard-empty">
                        <strong>Dashboard chưa có dữ liệu</strong>
                        <p>API đã phản hồi nhưng không có nội dung phù hợp để hiển thị.</p>
                    </div>
                )}
            </section>

            <section className="wb-stats">
                <StatCard icon={<FiPackage />} label="Đơn đang xử lý" value={loadingOrders ? '...' : processingOrdersCount} tone="blue" />
                <StatCard icon={<FiTrendingUp />} label="Doanh thu ròng" value={loadingDashboard ? '...' : formatCurrencyVnd(dashboardStats.netEarnings)} tone="green" />
                <StatCard icon={<FiClock />} label="Yêu cầu chờ" value={loadingDashboard ? '...' : dashboardStats.pendingRequests} tone="amber" />
                <StatCard icon={<FiMessageCircle />} label="Đánh giá TB" value={dashboardStats.avgRating == null ? '—' : dashboardStats.avgRating.toFixed(1)} tone="purple" />
            </section>

            <section className="wb-grid">
                <div className="wb-col">
                    <Widget title="Đơn hàng đang xử lý" actionText="Xem tất cả →" onAction={() => navigate('/artisan/orders')}>
                        {loadingOrders ? (
                            <WidgetSkeleton rows={3} />
                        ) : latestOrders.length === 0 ? (
                            <EmptyState text="Chưa có đơn hàng nào." />
                        ) : (
                            <div className="wb-list">
                                {latestOrders.map((order) => {
                                    const id = order?.orderId || order?.id;
                                    const quantity = (order?.orderDetails || []).reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
                                    return (
                                        <div key={id} className="wb-item">
                                            <div className="wb-item-head">
                                                <span className="wb-mono">#{shortId(id)}</span>
                                                <span className={`wb-badge ${getStatusClass(order?.status)}`}>{getOrderStatusLabel(order?.status)}</span>
                                            </div>
                                            <p className="wb-item-meta">
                                                {formatDate(order?.orderDate || order?.createAt)} · {formatCurrencyVnd(order?.total)} · {getPaymentMethodLabel(order?.paymentMethod)} · {quantity} SP
                                            </p>
                                            <button type="button" className="wb-link-btn" onClick={() => navigate(`/artisan/orders/${id}`)}>Chi tiết</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Widget>

                    <Widget title="Đơn tùy chỉnh đang làm" actionText="Quản lý →" onAction={() => navigate('/artisan/orders')}>
                        {loadingCustomOrders ? (
                            <WidgetSkeleton rows={3} />
                        ) : customOrdersWithStage.length === 0 ? (
                            <EmptyState text="Không có đơn tùy chỉnh đang làm." />
                        ) : (
                            <div className="wb-list">
                                {customOrdersWithStage.slice(0, 3).map(({ order, stage }) => {
                                    const stageStatus = normalizeStatus(stage?.status);
                                    const dotClass = stageStatus === 'PAID' ? 'wb-dot--warning' : stageStatus === 'COMPLETED' ? 'wb-dot--gray' : 'wb-dot--success';
                                    const orderId = order?.id || order?.customOrderId || order?.orderId;
                                    return (
                                        <div key={orderId} className="wb-item">
                                            <div className="wb-item-head">
                                                <div className="wb-dot-title">
                                                    <span className={`wb-dot ${dotClass}`} />
                                                    <span>{order?.title || order?.requestTitle || `Custom #${shortId(orderId)}`}</span>
                                                </div>
                                                <span className={`wb-badge ${getStatusClass(order?.status)}`}>{getOrderStatusLabel(order?.status)}</span>
                                            </div>
                                            <p className="wb-item-meta">
                                                Stage {stage?.stageOrder ?? stage?.order ?? '—'}: {stage?.name || '—'} · Hạn {formatDate(getDueDate(stage))}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Widget>

                    <Widget title="Ví & tài chính">
                        {loadingDashboard ? (
                            <WidgetSkeleton rows={2} />
                        ) : (
                            <div className="wb-wallet">
                                <p className="wb-wallet-label">Số dư hiện tại</p>
                                <h3 className="wb-wallet-balance">{formatCurrencyVnd(dashboardStats.currentBalance)}</h3>
                                <div className="wb-wallet-meta">
                                    <div className="wb-wallet-box wb-wallet-box--earnings">
                                        <span>Thu nhập ròng</span>
                                        <strong>{formatCurrencyVnd(dashboardStats.netEarnings)}</strong>
                                    </div>
                                    <div className="wb-wallet-box wb-wallet-box--commission">
                                        <span>Phí sàn</span>
                                        <strong>{formatCurrencyVnd(dashboardStats.totalCommission)}</strong>
                                    </div>
                                    <div className="wb-wallet-box">
                                        <span>Rút chờ xử lý</span>
                                        <strong>{formatCurrencyVnd(dashboardStats.pendingWithdrawal)}</strong>
                                    </div>
                                </div>
                                <div className="wb-wallet-actions">
                                    <button type="button" className="wb-wallet-link" onClick={() => navigate('/artisan/wallet')}>Xem ví →</button>
                                    <button type="button" className="wb-wallet-link" onClick={() => navigate('/artisan/finance')}>Chi tiết tài chính →</button>
                                </div>
                            </div>
                        )}
                    </Widget>
                </div>

                <div className="wb-col">
                    <Widget
                        title="Yêu cầu từ khách"
                        titleAddon={!loadingDashboard && dashboardStats.totalRequests > 0 ? <span className="wb-new-badge">{dashboardStats.totalRequests} mới</span> : null}
                    >
                        {loadingRequests ? (
                            <WidgetSkeleton rows={3} />
                        ) : dashboardStats.totalRequests === 0 ? (
                            <EmptyState text="Hiện chưa có yêu cầu mở." />
                        ) : (
                            <>
                                <div className="wb-list">
                                    {(openRequests.length > 0 ? openRequests : []).map((req, index) => (
                                        <div key={req?.id || req?.customRequestId || index} className="wb-item">
                                            <div className="wb-item-head">
                                                <strong>{req?.title || req?.name || 'Yêu cầu tùy chỉnh'}</strong>
                                            </div>
                                            <p className="wb-item-meta">
                                                {formatCurrencyVnd(req?.maxBudget || req?.budget || 0)} · {getRelative(req?.createdAt || req?.createAt)}
                                            </p>
                                        </div>
                                    ))}
                                    {openRequests.length === 0 && (
                                        <div className="wb-item">
                                            <div className="wb-item-head">
                                                <strong>Tổng yêu cầu mở</strong>
                                            </div>
                                            <p className="wb-item-meta">API đang trả về {dashboardStats.totalRequests} yêu cầu cần xử lý.</p>
                                        </div>
                                    )}
                                </div>
                                <button type="button" className="wb-full-btn" onClick={() => navigate('/artisan/requests')}>Xem tất cả yêu cầu →</button>
                            </>
                        )}
                    </Widget>

                    <Widget title="Tin nhắn" actionText="Xem tất cả →" onAction={() => navigate('/artisan/messages')}>
                        {loadingMessages ? (
                            <WidgetSkeleton rows={3} />
                        ) : sortedConversations.length === 0 ? (
                            <EmptyState text="Chưa có hội thoại nào." />
                        ) : (
                            <div className="wb-list">
                                {sortedConversations.map((conv, index) => {
                                    const name = getConversationName(conv);
                                    return (
                                        <div key={conv?.conversationId || conv?.id || index} className="wb-item wb-chat-item">
                                            <div className="wb-avatar">{getInitials(name)}</div>
                                            <div className="wb-chat-content">
                                                <div className="wb-item-head">
                                                    <strong>{name}</strong>
                                                    {Number(conv?.unreadCount || 0) > 0 && <span className="wb-unread-dot" />}
                                                </div>
                                                <p className="wb-item-meta wb-truncate">{conv?.lastMessage || 'Chưa có tin nhắn'}</p>
                                            </div>
                                            <span className="wb-chat-time">{formatDateTime(conv?.lastMessageTime || conv?.updatedAt)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Widget>


                </div>
            </section>
        </div>
    );
};

const StatCard = ({ icon, label, value, tone = 'neutral' }) => (
    <article className={`wb-stat-card wb-stat-card--${tone}`}>
        <div className="wb-stat-icon">{icon}</div>
        <div>
            <p className="wb-stat-label">{label}</p>
            <p className="wb-stat-value">{value}</p>
        </div>
    </article>
);

const DashboardCard = ({ icon, label, value, helper, tone = 'neutral' }) => (
    <article className={`wb-dashboard-card wb-dashboard-card--${tone}`}>
        <div className="wb-dashboard-card-icon">{icon}</div>
        <div>
            <p className="wb-dashboard-card-label">{label}</p>
            <strong className="wb-dashboard-card-value">{typeof value === 'number' ? value.toLocaleString('vi-VN') : value}</strong>
            <p className="wb-dashboard-card-helper">{helper}</p>
        </div>
    </article>
);

const Widget = ({ title, titleAddon, actionText, onAction, children }) => (
    <article className="wb-widget">
        <div className="wb-widget-head">
            <div className="wb-widget-title-wrap">
                <h3>{title}</h3>
                {titleAddon}
            </div>
            {actionText && (
                <button type="button" className="wb-header-link" onClick={onAction}>{actionText}</button>
            )}
        </div>
        {children}
    </article>
);

const WidgetSkeleton = ({ rows = 3 }) => (
    <div className="wb-skeleton-wrap">
        {Array.from({ length: rows }).map((_, index) => (
            <div className="wb-skeleton" key={index} />
        ))}
    </div>
);

const EmptyState = ({ text }) => <p className="wb-empty">{text}</p>;

export default Workbench;