import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../../assets/logo.png';
import {
    FiHome,
    FiMail,
    FiPackage,
    FiGrid,
    FiFileText,
    FiClipboard,
    FiRepeat,
    FiAlertTriangle,
    FiCreditCard,
    FiLogOut,
    FiUser,
} from 'react-icons/fi';
import './Sidebar.css';

const Sidebar = ({ user, activeView, setActiveView, onLogout, isOpen = false, onClose }) => {
    const navigate = useNavigate();
    const [avatarFailed, setAvatarFailed] = useState(false);
    const safeUserName = user?.name || user?.fullName || 'Artisan';
    const avatarUrl = user?.avatar || user?.avatarUrl || '';
    const initials = useMemo(() => {
        const parts = String(safeUserName).trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return 'AR';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
    }, [safeUserName]);

    const menuSections = [
        {
            title: 'Tổng quan',
            items: [
                { id: 'dashboard', icon: <FiHome />, label: 'Bảng điều khiển', badge: null },
                { id: 'profile', icon: <FiUser />, label: 'Hồ sơ cá nhân', badge: null },
                { id: 'messages', icon: <FiMail />, label: 'Tin nhắn', badge: null },
            ],
        },
        {
            title: 'Quản lý sản phẩm',
            items: [
                { id: 'portfolio', icon: <FiPackage />, label: 'Quản lí sản phẩm', badge: null },
                { id: 'templates', icon: <FiGrid />, label: 'Mẫu thiết kế', badge: null },
            ],
        },
        {
            title: 'Đơn hàng',
            items: [
                { id: 'readyOrders', icon: <FiPackage />, label: 'Quản lí đơn hàng', badge: null },
                { id: 'requests', icon: <FiFileText />, label: 'Yêu cầu từ khách', badge: null },
                { id: 'customOrders', icon: <FiClipboard />, label: 'Đơn tùy chỉnh', badge: null },
                { id: 'templateOrders', icon: <FiGrid />, label: 'Đơn hàng Template', badge: null },
                { id: 'shipments', icon: <FiRepeat />, label: 'Vận đơn', badge: null },
            ],
        },
        {
            title: 'Hỗ trợ',
            items: [
                { id: 'complaints', icon: <FiAlertTriangle />, label: 'Khiếu nại', badge: null },
                { id: 'wallet', icon: <FiCreditCard />, label: 'Ví của tôi', badge: null },
            ],
        },
    ];

    return (
        <aside className={`artisan-sidebar ${isOpen ? 'open' : ''}`}>
            {onClose && <button type="button" className="sidebar-close-btn" aria-label="Đóng menu" onClick={onClose}>&times;</button>}
            <div className="sidebar-header">
                <button
                    type="button"
                    className="sidebar-logo"
                    onClick={() => {
                        if (onClose) onClose();
                        navigate('/');
                    }}
                    aria-label="Về trang chủ"
                >
                    <img src={logo} alt="Catholic Market" className="logo-image" />
                    <div className="logo-text">
                        <span className="logo-title">Catholic Market</span>
                        <span className="logo-subtitle">Nghệ nhân</span>
                    </div>
                </button>
            </div>

            <nav className="sidebar-nav">
                {menuSections.map((group, groupIndex) => (
                    <div key={group.title} className="sidebar-nav-group">
                        {groupIndex > 0 && <div className="sidebar-group-divider" />}
                        <p className="sidebar-group-title">{group.title}</p>
                        <ul>
                            {group.items.map((item) => (
                                <li key={item.id}>
                                    <button
                                        className={`nav-link ${activeView === item.id ? 'active' : ''}`}
                                        onClick={() => setActiveView(item.id)}
                                        type="button"
                                    >
                                        <span className="nav-icon">{item.icon}</span>
                                        <span className="nav-text">{item.label}</span>
                                        {item.badge && <span className="nav-badge">{item.badge}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user">
                    {avatarUrl && !avatarFailed ? (
                        <img src={avatarUrl} alt={safeUserName} className="user-avatar" onError={() => setAvatarFailed(true)} />
                    ) : (
                        <div className="user-avatar user-avatar-fallback" aria-hidden="true">{initials}</div>
                    )}
                    <div className="user-info">
                        <h3 className="user-name" title={safeUserName}>{safeUserName}</h3>
                        <p className="user-role">Nghệ nhân</p>
                    </div>
                    <button type="button" className="sidebar-logout" onClick={onLogout} aria-label="Đăng xuất">
                        <FiLogOut className="nav-icon" />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
