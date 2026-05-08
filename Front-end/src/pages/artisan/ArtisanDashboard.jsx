import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Workbench from './components/Workbench';
import PortfolioView from './components/PortfolioView';
import TemplatesView from './components/TemplatesView';
import ArtisanRequestsPage from './ArtisanRequestsPage';
import ArtisanOrdersPage from './ArtisanOrdersPage';
import ArtisanTemplateOrdersPage from './ArtisanTemplateOrdersPage';
import ArtisanReadyOrdersPage from './ArtisanReadyOrdersPage';
import ComplaintManagementPage from './ComplaintManagementPage';
import ArtisanQuoteCreatePage from './ArtisanQuoteCreatePage';
import ShipmentManagementPage from './ShipmentManagementPage';
import WalletPage from '../customer/WalletPage';
import ChatPage from '../customer/ChatPage';
import ArtisanProfilePage from './ArtisanProfilePage';
import './ArtisanDashboard.css';

const getViewFromPath = (pathname) => {
    if (pathname === '/artisan/profile') return 'profile';
    if (pathname === '/artisan/templates') return 'templates';
    if (pathname === '/artisan/portfolio') return 'portfolio';
    if (pathname === '/artisan/requests') return 'requests';
    if (/^\/artisan\/requests\/[^/]+\/custom-order$/.test(pathname)) return 'customOrderCreate';
    if (pathname === '/artisan/orders') return 'customOrders';
    if (pathname === '/artisan/template-orders') return 'templateOrders';
    if (pathname === '/artisan/ready-orders') return 'readyOrders';
    if (pathname === '/artisan/complaints') return 'complaints';
    if (pathname === '/artisan/wallet') return 'wallet';
    if (pathname === '/artisan/shipments') return 'shipments';
    if (pathname === '/artisan/messages') return 'messages';
    return 'dashboard';
};

const viewToPath = (view) => {
    if (view === 'profile') return '/artisan/profile';
    if (view === 'templates') return '/artisan/templates';
    if (view === 'portfolio') return '/artisan/portfolio';
    if (view === 'requests') return '/artisan/requests';
    if (view === 'customOrders') return '/artisan/orders';
    if (view === 'templateOrders') return '/artisan/template-orders';
    if (view === 'readyOrders') return '/artisan/ready-orders';
    if (view === 'complaints') return '/artisan/complaints';
    if (view === 'wallet') return '/artisan/wallet';
    if (view === 'shipments') return '/artisan/shipments';
    if (view === 'messages') return '/artisan/messages';
    return '/artisan';
};

const ArtisanDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const activeView = getViewFromPath(location.pathname);

    if (!user || String(user.role || '').toUpperCase() !== 'ARTISAN') {
        navigate('/');
        return null;
    }

    const handleChangeView = (view) => {
        setSidebarOpen(false);
        const nextPath = viewToPath(view);
        if (location.pathname !== nextPath) navigate(nextPath);
    };

    const sidebarView = activeView === 'customOrderCreate' ? 'requests' : activeView;

    return (
        <div className="artisan-dashboard">
            <button type="button" className="artisan-mobile-menu-btn" aria-label="Menu" onClick={() => setSidebarOpen(true)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
            </button>
            {sidebarOpen && <div className="artisan-sidebar-overlay" onClick={() => setSidebarOpen(false)} role="presentation" />}
            <Sidebar
                user={user}
                activeView={sidebarView}
                setActiveView={handleChangeView}
                onLogout={logout}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />
            <main
                className={`artisan-main ${activeView === 'messages' ? 'artisan-main--chat' : ''}`}
                style={activeView === 'messages' ? { padding: 0 } : undefined}
            >
                {activeView === 'messages' ? (
                    <ChatPage hideHeader />
                ) : (
                    <div className="artisan-main-inner">
                        {activeView === 'dashboard' && <Workbench user={user} />}
                        {activeView === 'profile' && <ArtisanProfilePage />}
                        {activeView === 'commissions' && <div className="view-placeholder">Commissions View</div>}
                        {activeView === 'portfolio' && <PortfolioView user={user} />}
                        {activeView === 'templates' && <TemplatesView user={user} />}
                        {activeView === 'requests' && <ArtisanRequestsPage embedded />}
                        {activeView === 'customOrderCreate' && <ArtisanQuoteCreatePage embedded />}
                        {activeView === 'customOrders' && <ArtisanOrdersPage embedded />}
                        {activeView === 'templateOrders' && <ArtisanTemplateOrdersPage embedded />}
                        {activeView === 'readyOrders' && <ArtisanReadyOrdersPage embedded />}
                        {activeView === 'complaints' && <ComplaintManagementPage />}
                        {activeView === 'shipments' && <ShipmentManagementPage user={user} embedded />}
                        {activeView === 'wallet' && <WalletPage embedded />}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ArtisanDashboard;
