import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FiHome } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { appToast } from '../../lib/appToast';
import walletService from '../../services/walletService';
import './WalletPage.css';

const PAGE_SIZE = 10;

const TYPE_META = {
    DEPOSIT: { label: '+ Nhận tiền', badgeClass: 'wallet-type-deposit', amountClass: 'wallet-amount-plus', sign: '+' },
    PLATFORM_FEE: { label: 'Phí sàn', badgeClass: 'wallet-type-fee', amountClass: 'wallet-amount-minus', sign: '-' },
    REFUND: { label: 'Hoàn tiền', badgeClass: 'wallet-type-refund', amountClass: 'wallet-amount-minus', sign: '-' },
    WITHDRAWAL: { label: 'Rút tiền', badgeClass: 'wallet-type-withdrawal', amountClass: 'wallet-amount-minus', sign: '-' },
};

const quickTabs = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'DEPOSIT', label: 'Nhận tiền' },
    { id: 'PLATFORM_FEE', label: 'Phí sàn' },
    { id: 'REFUND', label: 'Hoàn tiền' },
];

const formatCurrency = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} đ`;
const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—');
const formatShortDateTime = (value) => (value ? dayjs(value).format('DD/MM HH:mm') : '—');

const WalletPage = ({ embedded = false }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();

    const role = String(user?.role || '').toLowerCase();
    const isCustomer = role === 'customer';
    const isArtisan = role === 'artisan';
    const canView = isCustomer || isArtisan;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [withdrawOpen, setWithdrawOpen] = useState(false);
    const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false);
    const [withdrawDetailOpen, setWithdrawDetailOpen] = useState(false);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankAccountNumber, setBankAccountNumber] = useState('');
    const [bankAccountName, setBankAccountName] = useState('');
    const [withdrawReason, setWithdrawReason] = useState('');

    const [searchKeyword, setSearchKeyword] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [quickType, setQuickType] = useState('ALL');
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (!isAuthenticated || !canView) return;

        let cancelled = false;

        const fetchData = async () => {
            setLoading(true);

            const requests = [walletService.getMyWallet(), walletService.getWalletTransactions()];
            if (isArtisan) {
                requests.push(walletService.getMyWithdrawals());
            }

            const [walletRes, transactionsRes, withdrawalsRes] = await Promise.all(requests);

            if (cancelled) return;

            if (!walletRes.success) {
                appToast.error('Không tải được ví', walletRes.error || 'Vui lòng thử lại sau');
            }

            if (!transactionsRes.success) {
                appToast.error('Không tải được giao dịch ví', transactionsRes.error || 'Vui lòng thử lại sau');
            }

            if (isArtisan && withdrawalsRes && !withdrawalsRes.success) {
                appToast.error('Không tải được danh sách rút tiền', withdrawalsRes.error || 'Vui lòng thử lại sau');
            }

            setWallet(walletRes.success ? walletRes.data : null);
            setTransactions(transactionsRes.success ? (transactionsRes.data || []) : []);
            setWithdrawals(isArtisan && withdrawalsRes?.success ? (withdrawalsRes.data || []) : []);

            setLoading(false);
        };

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [location.key, isAuthenticated, canView]);

    const stats = useMemo(() => {
        return transactions.reduce(
            (acc, transaction) => {
                const amount = Number(transaction.amount || 0);
                const type = String(transaction.type || '').toUpperCase();
                if (type === 'DEPOSIT') {
                    acc.totalIn += amount;
                }
                if (['PLATFORM_FEE', 'REFUND', 'WITHDRAWAL'].includes(type)) {
                    acc.totalOut += amount;
                }
                return acc;
            },
            { totalIn: 0, totalOut: 0 },
        );
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        const effectiveTypeFilter = quickType !== 'ALL' ? quickType : typeFilter;
        return transactions.filter((transaction) => {
            const type = String(transaction.type || '').toUpperCase();
            const description = String(transaction.description || '').toLowerCase();
            const matchesKeyword = !keyword || description.includes(keyword);
            const matchesType = effectiveTypeFilter === 'ALL' || type === effectiveTypeFilter;
            return matchesKeyword && matchesType;
        });
    }, [transactions, searchKeyword, typeFilter, quickType]);

    useEffect(() => {
        setPage(1);
    }, [searchKeyword, typeFilter, quickType]);

    const pagedTransactions = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        return filteredTransactions.slice(start, end);
    }, [filteredTransactions, page]);

    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));

    const walletIdShort = useMemo(() => {
        const id = String(wallet?.walletId || '');
        if (id.length <= 12) return id || '—';
        return `${id.slice(0, 6)}...${id.slice(-4)}`;
    }, [wallet?.walletId]);

    const openWithdraw = () => {
        setWithdrawAmount('');
        setBankName('');
        setBankAccountNumber('');
        setBankAccountName('');
        setWithdrawReason('');
        setWithdrawOpen(true);
    };

    const refreshWithdrawals = async () => {
        const withdrawalsRes = await walletService.getMyWithdrawals();
        if (withdrawalsRes.success) setWithdrawals(withdrawalsRes.data || []);
    };

    const openWithdrawalDetail = async (withdrawal) => {
        const id = withdrawal?.withdrawalId;
        if (!id) return;

        setSelectedWithdrawal(null);
        setWithdrawDetailOpen(true);

        const res = await walletService.getWithdrawalDetail(id);
        if (!res.success) {
            appToast.error('Không tải được chi tiết', res.error || 'Vui lòng thử lại sau');
            setWithdrawDetailOpen(false);
            return;
        }

        setSelectedWithdrawal(res.data || withdrawal);
    };

    const openCancelWithdrawal = (withdrawal) => {
        setSelectedWithdrawal(withdrawal || null);
        setCancelConfirmOpen(true);
    };

    const confirmCancelWithdrawal = async () => {
        const id = selectedWithdrawal?.withdrawalId;
        if (!id) return;

        setSubmitting(true);
        const res = await walletService.cancelWithdrawalRequest(id);
        setSubmitting(false);

        if (!res.success) {
            appToast.error('Huỷ rút tiền thất bại', res.error || 'Vui lòng thử lại sau');
            return;
        }

        appToast.success('Đã huỷ yêu cầu rút tiền', 'Yêu cầu rút tiền đã được huỷ');
        setCancelConfirmOpen(false);
        setSelectedWithdrawal(null);
        await refreshWithdrawals();
    };

    const submitWithdraw = async () => {
        const amount = Number(withdrawAmount || 0);
        if (!amount || amount <= 0) {
            appToast.error('Số tiền không hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0');
            return;
        }
        if (amount > Number(wallet?.balance || 0)) {
            appToast.error('Số dư không đủ', 'Số tiền rút không được vượt quá số dư hiện tại');
            return;
        }
        if (!bankName.trim() || !bankAccountNumber.trim() || !bankAccountName.trim()) {
            appToast.error('Thiếu thông tin ngân hàng', 'Vui lòng nhập đầy đủ tên ngân hàng, số tài khoản và tên chủ tài khoản');
            return;
        }
        if (!withdrawReason.trim()) {
            appToast.error('Thiếu lý do rút tiền', 'Vui lòng nhập lý do rút tiền');
            return;
        }
        if (withdrawReason.trim().length < 10 || withdrawReason.trim().length > 500) {
            appToast.error('Lý do rút tiền không hợp lệ', 'Lý do rút tiền phải có từ 10 đến 500 ký tự');
            return;
        }

        setSubmitting(true);
        const res = await walletService.createWithdrawalRequest({
            amount,
            bankName,
            bankAccountNumber,
            bankAccountName,
            reason: withdrawReason,
        });
        setSubmitting(false);

        if (!res.success) {
            appToast.error('Rút tiền thất bại', res.error || 'Vui lòng thử lại sau');
            return;
        }

        appToast.success('Đã tạo yêu cầu rút tiền', 'Yêu cầu của bạn đã được gửi và đang chờ xử lý');
        setWithdrawConfirmOpen(false);
        setWithdrawOpen(false);
        const [walletRes, transactionsRes] = await Promise.all([
            walletService.getMyWallet(),
            walletService.getWalletTransactions(),
        ]);
        if (walletRes.success) setWallet(walletRes.data);
        if (transactionsRes.success) setTransactions(transactionsRes.data || []);
        await refreshWithdrawals();
    };

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!canView) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="wallet-page wallet-page-shell">
            <header className="wallet-header wallet-header-row wallet-page-header">
                <div className="wallet-page-header-content">
                    <p className="wallet-page-eyebrow">Artisan wallet</p>
                    <h1>Ví của tôi</h1>
                    <p>Quản lý số dư và lịch sử giao dịch</p>
                </div>
                <div className="wallet-page-header-actions">
                    <button type="button" className="btn btn-outline wallet-home-btn" onClick={() => navigate('/')}>
                        <FiHome size={16} />
                        Về trang chủ
                    </button>
                    <button type="button" className="btn btn-primary wallet-withdraw-btn" onClick={openWithdraw} disabled={loading || Number(wallet?.balance || 0) <= 0}>
                        Rút số dư
                    </button>
                </div>
            </header>

            {loading ? (
                <>
                    <div className="wallet-skeleton hero" />
                    <div className="wallet-skeleton row" />
                    <div className="wallet-skeleton table" />
                </>
            ) : (
                <>
                    <section className="wallet-top-grid">
                        <article className="wallet-hero-card">
                            <p className="wallet-hero-label">Số dư hiện tại</p>
                            <h2>{formatCurrency(wallet?.balance || 0)}</h2>
                            <p className="wallet-hero-meta"><code>{walletIdShort}</code></p>
                            <p className="wallet-hero-meta">Cập nhật: {wallet?.updatedAt ? dayjs(wallet.updatedAt).format('DD/MM/YYYY') : '—'}</p>
                        </article>

                        {/* <div className="wallet-stats-grid">
                            <article className="wallet-stat-card">
                                <p>Tổng đã nhận</p>
                                <h3 className="wallet-amount-plus">+ {formatCurrency(stats.totalIn)}</h3>
                            </article>
                            <article className="wallet-stat-card">
                                <p>Đã trừ</p>
                                <h3 className="wallet-amount-minus">- {formatCurrency(stats.totalOut)}</h3>
                            </article>
                        </div> */}
                    </section>

                    <section className="wallet-table-section">
                        <div className="wallet-filter-bar">
                            <input type="text" placeholder="Tìm theo mô tả giao dịch" value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} />
                            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                                <option value="ALL">Tất cả loại</option>
                                <option value="DEPOSIT">Nhận tiền</option>
                                <option value="PLATFORM_FEE">Phí sàn</option>
                                <option value="REFUND">Hoàn tiền</option>
                                <option value="WITHDRAWAL">Rút tiền</option>
                            </select>
                        </div>

                        <div className="wallet-quick-tabs">
                            {quickTabs.map((tab) => (
                                <button key={tab.id} type="button" className={`wallet-quick-tab ${quickType === tab.id ? 'active' : ''}`} onClick={() => setQuickType(tab.id)}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {pagedTransactions.length === 0 ? (
                            <div className="wallet-empty">Chưa có giao dịch nào</div>
                        ) : (
                            <>
                                <div className="wallet-table-wrapper">
                                    <table className="wallet-table">
                                        <thead>
                                            <tr>
                                                <th>GIAO DỊCH</th>
                                                <th>LOẠI</th>
                                                <th>SỐ TIỀN</th>
                                                <th>SỐ DƯ SAU</th>
                                                <th>THỜI GIAN</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pagedTransactions.map((transaction) => {
                                                const type = String(transaction.type || '').toUpperCase();
                                                const meta = TYPE_META[type] || TYPE_META.PLATFORM_FEE;

                                                return (
                                                    <tr key={transaction.transactionId}>
                                                        <td>
                                                            <p className="wallet-main-cell">{transaction.description || 'Giao dịch ví'}</p>
                                                            <span className="wallet-sub-cell">#{String(transaction.transactionId || '').slice(0, 8)}</span>
                                                        </td>
                                                        <td><span className={`wallet-type-badge ${meta.badgeClass}`}>{meta.label}</span></td>
                                                        <td><strong className={meta.amountClass}>{meta.sign} {formatCurrency(transaction.amount)}</strong></td>
                                                        <td><span className="wallet-balance-after">{formatCurrency(transaction.balanceAfter)}</span></td>
                                                        <td>{formatShortDateTime(transaction.createdAt)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="wallet-pagination">
                                    <span>Trang {page}/{totalPages}</span>
                                    <div>
                                        <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>Trước</button>
                                        <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>Sau</button>
                                    </div>
                                </div>
                            </>
                        )}
                    </section>

                    {isArtisan && (
                        <section className="wallet-withdrawal-section">
                            <div className="wallet-withdrawal-header">
                                <h2>Quản lí rút tiền</h2>
                                <p>Theo dõi các yêu cầu rút tiền của bạn.</p>
                            </div>

                            {withdrawals.length === 0 ? (
                                <div className="wallet-empty">Chưa có yêu cầu rút tiền nào</div>
                            ) : (
                                <div className="wallet-table-wrapper">
                                    <table className="wallet-table">
                                        <thead>
                                            <tr>
                                                <th>MÃ YÊU CẦU</th>
                                                <th>SỐ TIỀN</th>
                                                <th>NGÂN HÀNG</th>
                                                <th>TRẠNG THÁI</th>
                                                <th>THỜI GIAN</th>
                                                <th>HÀNH ĐỘNG</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {withdrawals.map((withdrawal) => {
                                                const status = String(withdrawal.status || 'PENDING').toLowerCase();
                                                const canCancel = String(withdrawal.status || '').toUpperCase() === 'PENDING';

                                                return (
                                                    <tr key={withdrawal.withdrawalId}>
                                                        <td>
                                                            <p className="wallet-main-cell">#{String(withdrawal.withdrawalId || '').slice(0, 8)}</p>
                                                            <span className="wallet-sub-cell">{withdrawal.bankAccountName || '—'}</span>
                                                        </td>
                                                        <td><strong className="wallet-amount-minus">- {formatCurrency(withdrawal.amount)}</strong></td>
                                                        <td>
                                                            <p className="wallet-main-cell">{withdrawal.bankName || '—'}</p>
                                                            <span className="wallet-sub-cell">{withdrawal.bankAccountNumber || '—'}</span>
                                                            <span className="wallet-sub-cell">Lý do: {withdrawal.reason || '—'}</span>
                                                        </td>
                                                        <td>
                                                            <span className={`wallet-status-badge wallet-status-${status}`}>
                                                                {withdrawal.status || 'PENDING'}
                                                            </span>
                                                        </td>
                                                        <td>{formatShortDateTime(withdrawal.createdAt)}</td>
                                                        <td>
                                                            <div className="wallet-actions-inline">
                                                                <button type="button" className="btn btn-outline btn-sm" onClick={() => openWithdrawalDetail(withdrawal)}>
                                                                    Xem chi tiết
                                                                </button>
                                                                <button type="button" className="btn btn-outline btn-sm" disabled={!canCancel} onClick={() => openCancelWithdrawal(withdrawal)}>
                                                                    Huỷ rút
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    )}

                    <section className="wallet-meta-foot">
                        <span>Tạo ví: {formatDateTime(wallet?.createdAt)}</span>
                        <span>Cập nhật gần nhất: {formatDateTime(wallet?.updatedAt)}</span>
                    </section>
                </>
            )}

            {withdrawOpen && (
                <div className="wallet-modal-backdrop" onClick={() => setWithdrawOpen(false)} role="presentation">
                    <div className="wallet-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="withdraw-modal-title">
                        <div className="wallet-modal-header">
                            <div>
                                <h2 id="withdraw-modal-title">Rút số dư</h2>
                                <p>Nhập thông tin tài khoản ngân hàng để tạo yêu cầu rút tiền.</p>
                            </div>
                            <button type="button" className="wallet-modal-close" onClick={() => setWithdrawOpen(false)} aria-label="Đóng">×</button>
                        </div>

                        <div className="wallet-modal-body">
                            <label>
                                <span>Số tiền rút</span>
                                <input type="number" min="1" step="1" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="VD: 50000" />
                            </label>
                            <label>
                                <span>Tên ngân hàng</span>
                                <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="VD: Vietcombank" />
                            </label>
                            <label>
                                <span>Số tài khoản</span>
                                <input type="text" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="VD: 76507964620482" />
                            </label>
                            <label>
                                <span>Tên chủ tài khoản</span>
                                <input type="text" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="VD: Nguyễn Văn A" />
                            </label>
                            <label>
                                <span>Lý do rút tiền</span>
                                <textarea
                                    value={withdrawReason}
                                    onChange={(e) => setWithdrawReason(e.target.value)}
                                    placeholder="Nhập lý do rút tiền (10-500 ký tự)"
                                    rows={4}
                                    maxLength={500}
                                />
                            </label>
                        </div>

                        <div className="wallet-modal-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setWithdrawOpen(false)} disabled={submitting}>Huỷ</button>
                            <button type="button" className="btn btn-primary" onClick={() => setWithdrawConfirmOpen(true)} disabled={submitting}>Tiếp tục</button>
                        </div>
                    </div>
                </div>
            )}

            {withdrawConfirmOpen && (
                <div className="wallet-modal-backdrop" onClick={() => setWithdrawConfirmOpen(false)} role="presentation">
                    <div className="wallet-modal wallet-confirm-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="withdraw-confirm-title">
                        <div className="wallet-modal-header">
                            <div>
                                <h2 id="withdraw-confirm-title">Xác nhận rút tiền</h2>
                                <p>Vui lòng kiểm tra lại thông tin trước khi gửi yêu cầu.</p>
                            </div>
                        </div>

                        <div className="wallet-confirm-summary">
                            <p><span>Số tiền:</span> <strong>{formatCurrency(withdrawAmount)}</strong></p>
                            <p><span>Ngân hàng:</span> <strong>{bankName || '—'}</strong></p>
                            <p><span>Số tài khoản:</span> <strong>{bankAccountNumber || '—'}</strong></p>
                            <p><span>Chủ tài khoản:</span> <strong>{bankAccountName || '—'}</strong></p>
                            <p><span>Lý do rút tiền:</span> <strong>{withdrawReason || '—'}</strong></p>
                        </div>

                        <div className="wallet-modal-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setWithdrawConfirmOpen(false)} disabled={submitting}>Quay lại</button>
                            <button type="button" className="btn btn-primary" onClick={submitWithdraw} disabled={submitting}>
                                {submitting ? 'Đang gửi...' : 'Xác nhận rút tiền'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {withdrawDetailOpen && (
                <div className="wallet-modal-backdrop" onClick={() => setWithdrawDetailOpen(false)} role="presentation">
                    <div className="wallet-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="withdraw-detail-title">
                        <div className="wallet-modal-header">
                            <div>
                                <h2 id="withdraw-detail-title">Chi tiết rút tiền</h2>
                                <p>Thông tin yêu cầu rút tiền.</p>
                            </div>
                            <button type="button" className="wallet-modal-close" onClick={() => setWithdrawDetailOpen(false)} aria-label="Đóng">×</button>
                        </div>

                        <div className="wallet-confirm-summary">
                            <p><span>Mã yêu cầu:</span> <strong>{selectedWithdrawal?.withdrawalId || '—'}</strong></p>
                            <p><span>Số tiền:</span> <strong>{formatCurrency(selectedWithdrawal?.amount)}</strong></p>
                            <p><span>Trạng thái:</span> <strong>{selectedWithdrawal?.status || '—'}</strong></p>
                            <p><span>Ngân hàng:</span> <strong>{selectedWithdrawal?.bankName || '—'}</strong></p>
                            <p><span>Số tài khoản:</span> <strong>{selectedWithdrawal?.fullBankAccountNumber || selectedWithdrawal?.bankAccountNumber || '—'}</strong></p>
                            <p><span>Chủ tài khoản:</span> <strong>{selectedWithdrawal?.bankAccountName || '—'}</strong></p>
                            <p><span>Tạo lúc:</span> <strong>{formatDateTime(selectedWithdrawal?.createdAt)}</strong></p>
                            <p><span>Xử lý lúc:</span> <strong>{formatDateTime(selectedWithdrawal?.processedAt)}</strong></p>
                            <p><span>Huỷ lúc:</span> <strong>{formatDateTime(selectedWithdrawal?.cancelledAt)}</strong></p>
                            <p><span>Người xử lý:</span> <strong>{selectedWithdrawal?.processedByName || '—'}</strong></p>
                            <p><span>Lý do từ chối:</span> <strong>{selectedWithdrawal?.rejectionReason || '—'}</strong></p>
                        </div>

                        <div className="wallet-modal-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setWithdrawDetailOpen(false)}>Đóng</button>
                            {String(selectedWithdrawal?.status || '').toUpperCase() === 'PENDING' && (
                                <button type="button" className="btn btn-outline" onClick={() => {
                                    setWithdrawDetailOpen(false);
                                    openCancelWithdrawal(selectedWithdrawal);
                                }}>
                                    Huỷ rút
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {cancelConfirmOpen && (
                <div className="wallet-modal-backdrop" onClick={() => setCancelConfirmOpen(false)} role="presentation">
                    <div className="wallet-modal wallet-confirm-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cancel-withdraw-title">
                        <div className="wallet-modal-header">
                            <div>
                                <h2 id="cancel-withdraw-title">Xác nhận huỷ rút tiền</h2>
                                <p>Bạn chỉ có thể huỷ yêu cầu đang ở trạng thái chờ xử lý.</p>
                            </div>
                        </div>

                        <div className="wallet-confirm-summary">
                            <p><span>Mã yêu cầu:</span> <strong>{selectedWithdrawal?.withdrawalId || '—'}</strong></p>
                            <p><span>Số tiền:</span> <strong>{formatCurrency(selectedWithdrawal?.amount)}</strong></p>
                            <p><span>Ngân hàng:</span> <strong>{selectedWithdrawal?.bankName || '—'}</strong></p>
                            <p><span>Lý do rút tiền:</span> <strong>{selectedWithdrawal?.reason || '—'}</strong></p>
                        </div>

                        <div className="wallet-modal-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setCancelConfirmOpen(false)} disabled={submitting}>Không</button>
                            <button type="button" className="btn btn-primary" onClick={confirmCancelWithdrawal} disabled={submitting}>
                                {submitting ? 'Đang huỷ...' : 'Xác nhận huỷ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WalletPage;
