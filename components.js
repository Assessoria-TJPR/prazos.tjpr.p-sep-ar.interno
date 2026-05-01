/**
 * @file components.jsx
 * Componentes Elite do Design System P-SEP-AR
 */

const { useState, useEffect } = React;

// ============================================
// COMPONENTES BASE - MONOLITH ELITE
// ============================================

/**
 * TJPRCard - Container Elite com Glassmorphism Profundo
 */
const TJPRCard = ({ title, subtitle, children, actions, className = '', icon }) => {
    return (
        <div className={`tjpr-card ${className}`}>
            {(title || subtitle || icon) && (
                <div className="px-6 py-5 border-b border-white/5">
                    <div className="flex items-center gap-4">
                        {icon && (
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                <span className="material-icons text-indigo-400">{icon}</span>
                            </div>
                        )}
                        <div className="flex-1">
                            {title && (
                                <h3 className="text-xl font-extrabold text-white tracking-tight">
                                    {title}
                                </h3>
                            )}
                            {subtitle && (
                                <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-widest">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <div className="p-6">
                {children}
            </div>
            {actions && (
                <div className="px-6 py-5 bg-slate-950/20 border-t border-white/5 flex items-center justify-end gap-4">
                    {actions}
                </div>
            )}
        </div>
    );
};

/**
 * TJPRButton - Botão de Alta Performance com Gradientes Flamejantes
 */
const TJPRButton = ({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    icon,
    iconPosition = 'left',
    disabled = false,
    className = '',
    type = 'button'
}) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 font-bold transition-all duration-300 rounded-lg focus:outline-none relative overflow-hidden';

    const variantClasses = {
        primary: 'tjpr-button-primary text-white',
        secondary: 'bg-slate-950/20 hover:bg-slate-950/40 text-white border border-white/10 hover:border-white/20',
        success: 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30',
        warning: 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30',
        error: 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30',
        ghost: 'bg-transparent hover:bg-slate-950/40 text-slate-400 hover:text-white'
    };

    const sizeClasses = {
        sm: 'px-4 py-2 text-xs',
        md: 'px-6 py-3 text-sm',
        lg: 'px-8 py-4 text-base'
    };

    const disabledClasses = 'opacity-40 cursor-not-allowed pointer-events-none grayscale';

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? disabledClasses : ''} ${className}`}
        >
            {icon && iconPosition === 'left' && (
                <span className="material-icons text-[1.2em]">{icon}</span>
            )}
            <span className="relative z-10">{children}</span>
            {icon && iconPosition === 'right' && (
                <span className="material-icons text-[1.2em]">{icon}</span>
            )}
        </button>
    );
};

/**
 * TJPRInput - Campo de Entrada com Foco Luminoso
 */
const TJPRInput = ({
    label,
    value,
    onChange,
    type = 'text',
    placeholder = '',
    required = false,
    error = '',
    helperText = '',
    icon,
    className = ''
}) => {
    return (
        <div className={`w-full ${className}`}>
            {label && (
                <label className="tjpr-label">
                    {label}
                    {required && <span className="text-rose-500 ml-1">*</span>}
                </label>
            )}
            <div className="relative group">
                {icon && (
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-400">
                        <span className="material-icons text-slate-500">{icon}</span>
                    </div>
                )}
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    className={`tjpr-input ${icon ? 'pl-12' : ''} ${error ? 'border-rose-500/50 bg-rose-500/5' : ''}`}
                />
            </div>
            {error && (
                <p className="mt-2 text-xs font-bold text-rose-400 flex items-center gap-1">
                    <span className="material-icons text-[14px]">error_outline</span>
                    {error}
                </p>
            )}
            {helperText && !error && (
                <p className="mt-2 text-xs font-medium text-slate-500">
                    {helperText}
                </p>
            )}
        </div>
    );
};

/**
 * TJPRHeader - Barra de Navegação Monolítica
 */
const TJPRHeader = ({ user, onLogout, onToggleDarkMode, isDarkMode, onOpenProfile, currentArea, onNavigate, isAdmin, notifications, onToggleNotifications }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="tjpr-header">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    {/* Logo e Título Elite */}
                    <div className="flex items-center gap-6">
                        <div className="relative group cursor-pointer" onClick={() => onNavigate && onNavigate('home')}>
                            <img src="Logo.png" alt="TJPR" className="h-11 w-auto relative z-10 transition-transform group-hover:scale-105" />
                            <div className="absolute inset-0 bg-indigo-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                        <div className="hidden md:block">
                            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                                P-SEP-AR
                            </h1>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-0.5">
                                Módulo de Prazos Processuais
                            </p>
                        </div>
                    </div>

                    {/* Actions Elite */}
                    <div className="flex items-center gap-4">
                        {/* Notifications Toggle */}
                        {onToggleNotifications && (
                            <button
                                onClick={onToggleNotifications}
                                className="relative p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
                                title="Notificações"
                            >
                                <span className="material-icons text-slate-400 group-hover:text-white">notifications</span>
                                {notifications && notifications.length > 0 && (
                                    <span className="absolute top-2.5 right-2.5 w-3 h-3 bg-rose-500 rounded-full border-[3px] border-[#020617] animate-pulse"></span>
                                )}
                            </button>
                        )}

                        {/* User Menu Elite */}
                        <div className="relative">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="flex items-center gap-3 p-2 pl-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                            >
                                <div className="hidden lg:block text-right">
                                    <p className="text-xs font-black text-white leading-none">
                                        {user?.displayName || 'Usuário'}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">
                                        {isAdmin ? 'Administrador' : 'Acessor'}
                                    </p>
                                </div>
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-black/20"
                                    style={{ background: `linear-gradient(135deg, ${user?.avatarColor || '#4f46e5'}, #312e81)` }}
                                >
                                    {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                                </div>
                            </button>

                            {/* Dropdown Elite */}
                            {isMenuOpen && (
                                <div className="absolute right-0 mt-3 w-56 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl py-2 z-[100] animate-in fade-in slide-in-from-top-2">
                                    <div className="px-4 py-3 border-b border-white/5 mb-2">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Opções</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            onOpenProfile();
                                            setIsMenuOpen(false);
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors"
                                    >
                                        <span className="material-icons text-lg text-indigo-400">person_outline</span>
                                        Meu Perfil
                                    </button>
                                    <button
                                        onClick={() => {
                                            onToggleDarkMode();
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-3 transition-colors"
                                    >
                                        <span className="material-icons text-lg text-amber-400">
                                            {isDarkMode ? 'light_mode' : 'dark_mode'}
                                        </span>
                                        {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            onLogout();
                                            setIsMenuOpen(false);
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-3 transition-colors"
                                    >
                                        <span className="material-icons text-lg">logout</span>
                                        Encerrar Sessão
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

/**
 * TJPRBadge - Badge com Profundidade
 */
const TJPRBadge = ({ children, variant = 'default', icon }) => {
    const variants = {
        default: 'bg-slate-800 text-slate-400 border border-slate-700',
        success: 'tjpr-badge-success',
        warning: 'tjpr-badge-warning',
        error: 'tjpr-badge-error',
        info: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
    };

    return (
        <span className={`tjpr-badge ${variants[variant]}`}>
            {icon && <span className="material-icons text-[14px] mr-1.5">{icon}</span>}
            {children}
        </span>
    );
};

/**
 * TJPRModal - Modal Glassmorphic
 */
const TJPRModal = ({ isOpen, onClose, title, children, maxWidth = '2xl', icon }) => {
    if (!isOpen) return null;

    const maxWidths = {
        'sm': 'max-w-sm',
        'md': 'max-w-md',
        'lg': 'max-w-lg',
        'xl': 'max-w-xl',
        '2xl': 'max-w-2xl',
        '4xl': 'max-w-4xl',
        '6xl': 'max-w-6xl'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className={`w-full ${maxWidths[maxWidth]} max-h-[90vh] overflow-hidden flex flex-col`}>
                <div className="tjpr-card flex flex-col h-full">
                    {/* Header Elite */}
                    <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {icon && (
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                    <span className="material-icons text-indigo-400">{icon}</span>
                                </div>
                            )}
                            <h3 className="text-xl font-extrabold text-white tracking-tight">
                                {title}
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all"
                        >
                            <span className="material-icons">close</span>
                        </button>
                    </div>

                    {/* Content Scrollable */}
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

const NotificationsPanel = ({ notifications, onMarkAsRead, isOpen, onClose, onNotificationClick }) => {
    if (!isOpen) return null;

    return (
        <React.Fragment>
            <div className="fixed inset-0 z-[90]" onClick={onClose}></div>
            <div className="absolute top-20 right-4 w-96 max-h-[80vh] bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden z-[100] animate-in zoom-in-95 slide-in-from-top-4 duration-200 origin-top-right">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h3 className="font-black text-white tracking-tight">NOTIFICAÇÕES</h3>
                    {notifications.length > 0 && (
                        <button onClick={onMarkAsRead} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest border-b border-indigo-400/30">
                            Limpar Tudo
                        </button>
                    )}
                </div>
                <div className="overflow-y-auto max-h-[60vh] custom-scrollbar">
                    {notifications.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-icons text-slate-600 text-3xl">notifications_off</span>
                            </div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Vazio</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={() => onNotificationClick && onNotificationClick(notif)}
                                    className={`p-5 hover:bg-white/5 transition-all cursor-pointer group ${!notif.read ? 'bg-indigo-500/[0.03]' : ''}`}
                                >
                                    <div className="flex gap-4">
                                        <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 transition-transform group-hover:scale-150 ${!notif.read ? 'bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'bg-transparent'}`}></div>
                                        <div className="flex-1">
                                            <p className={`text-sm font-medium leading-relaxed ${!notif.read ? 'text-white' : 'text-slate-400'}`}>
                                                {notif.message}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-600 uppercase mt-2 tracking-tighter">
                                                {formatarData(notif.createdAt ? new Date(notif.createdAt) : null)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </React.Fragment>
    );
};

/**
 * TJPRToast - Notificação Elite
 */
const TJPRToast = ({ message, type = 'info', onClose, duration = 5000 }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [onClose, duration]);

    const icons = {
        info: 'info',
        success: 'check_circle',
        warning: 'warning',
        error: 'error'
    };

    const colors = {
        info: 'border-indigo-500/50 bg-slate-900/90 text-indigo-400',
        success: 'border-emerald-500/50 bg-slate-900/90 text-emerald-400',
        warning: 'border-amber-500/50 bg-slate-900/90 text-amber-400',
        error: 'border-rose-500/50 bg-slate-900/90 text-rose-400'
    };

    return (
        <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl animate-in slide-in-from-right-full duration-500 mb-3 min-w-[300px] max-w-md ${colors[type]}`}>
            <span className="material-icons">{icons[type]}</span>
            <p className="text-xs font-black uppercase tracking-widest flex-1">{message}</p>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                <span className="material-icons text-sm">close</span>
            </button>
        </div>
    );
};

const TJPRToastContainer = () => {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        window.showToast = (message, type = 'info') => {
            const id = Date.now();
            setToasts(prev => [...prev, { id, message, type }]);
        };
    }, []);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div className="fixed bottom-8 right-8 z-[1000] flex flex-col items-end">
            {toasts.map(toast => (
                <TJPRToast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>
    );
};

/**
 * TJPRConfirmModal - Modal de Confirmação Elite
 */
const TJPRConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', variant = 'primary', icon = 'help_outline' }) => {
    return (
        <TJPRModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            icon={icon}
            maxWidth="sm"
        >
            <div className="space-y-6 text-center py-4">
                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest leading-relaxed">
                    {message}
                </p>
                <div className="flex gap-4 pt-4">
                    <TJPRButton 
                        variant="ghost" 
                        onClick={onClose}
                        className="flex-1"
                    >
                        {cancelText}
                    </TJPRButton>
                    <TJPRButton 
                        variant={variant} 
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="flex-1"
                    >
                        {confirmText}
                    </TJPRButton>
                </div>
            </div>
        </TJPRModal>
    );
};

// Export to window
window.TJPRCard = TJPRCard;
window.TJPRButton = TJPRButton;
window.TJPRInput = TJPRInput;
window.TJPRHeader = TJPRHeader;
window.TJPRBadge = TJPRBadge;
window.TJPRModal = TJPRModal;
window.NotificationsPanel = NotificationsPanel;
window.TJPRToastContainer = TJPRToastContainer;
window.TJPRConfirmModal = TJPRConfirmModal;

/**
 * CookieConsent - Aviso de Cookies Elite
 */
const CookieConsent = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('tjpr_cookie_consent');
        if (!consent) {
            // Pequeno delay para não impactar o LCP imediatamente
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('tjpr_cookie_consent', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 left-6 right-6 lg:left-auto lg:max-w-md z-[200] animate-in slide-in-from-bottom-10 duration-700">
            <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <div className="flex items-start gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="material-icons text-indigo-400">cookie</span>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">Privacidade & Cookies</h4>
                        <p className="text-[11px] font-medium text-slate-400 leading-relaxed mb-6">
                            Utilizamos cookies e tecnologias similares para garantir a melhor experiência em nossa plataforma monolítica, em conformidade com a LGPD e diretrizes de segurança do TJPR.
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={handleAccept} 
                                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                            >
                                Aceitar Termos
                            </button>
                            <button 
                                onClick={() => setIsVisible(false)} 
                                className="px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

window.CookieConsent = CookieConsent;

window.TJPRFormGroup = ({ children, cols = 1, className = '' }) => {
    const gridCols = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
    };
    return <div className={`grid ${gridCols[cols]} gap-6 ${className}`}>{children}</div>;
};
