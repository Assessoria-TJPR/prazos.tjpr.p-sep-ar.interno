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
                <div className="px-6 py-5 border-b tjpr-border-main">
                    <div className="flex items-center gap-4">
                        {icon && (
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <span className="material-icons text-primary">{icon}</span>
                            </div>
                        )}
                        <div className="flex-1">
                            {title && (
                                <h3 className="text-xl font-extrabold tjpr-text-main tracking-tight">
                                    {title}
                                </h3>
                            )}
                            {subtitle && (
                                <p className="text-xs font-semibold tjpr-text-dim mt-1 uppercase tracking-widest">
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
                <div className="px-6 py-5 tjpr-bg-alt border-t tjpr-border-main flex items-center justify-end gap-4">
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
        secondary: 'tjpr-bg-secondary hover:tjpr-bg-secondary-hover text-white',
        success: 'tjpr-bg-success/10 tjpr-text-success border tjpr-border-success/20 hover:tjpr-bg-success/20',
        warning: 'tjpr-bg-warning/10 tjpr-text-warning border tjpr-border-warning/20 hover:tjpr-bg-warning/20',
        error: 'tjpr-bg-error/10 tjpr-text-error border tjpr-border-error/20 hover:tjpr-bg-error/20',
        ghost: 'bg-transparent hover:tjpr-bg-alt tjpr-text-dim hover:tjpr-text-main'
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
                    {required && <span className="tjpr-text-error ml-1">*</span>}
                </label>
            )}
            <div className="relative group">
                {icon && (
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:tjpr-text-primary">
                        <span className="material-icons tjpr-text-dim">{icon}</span>
                    </div>
                )}
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    className={`tjpr-input ${icon ? 'pl-12' : ''} ${error ? 'tjpr-border-error/50 tjpr-bg-error/5' : ''} ${className}`}
                />
            </div>
            {error && (
                <p className="mt-2 text-xs font-bold tjpr-text-error flex items-center gap-1">
                    <span className="material-icons text-[14px]">error_outline</span>
                    {error}
                </p>
            )}
            {helperText && !error && (
                <p className="mt-2 text-xs font-medium tjpr-text-dim">
                    {helperText}
                </p>
            )}
        </div>
    );
};

/**
 * TJPRHeader - Barra de Navegação Monolítica
 */
const TJPRHeader = ({ user, onLogout, onToggleDarkMode, theme, onOpenProfile, currentArea, onNavigate, isAdmin, notifications, onToggleNotifications }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="tjpr-header">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    {/* Logo e Título Elite */}
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.href = '/'}>
                            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                                <img src="Logo.png" alt="TJPR" className="w-6 h-6 object-contain dark:brightness-0 dark:invert" />
                            </div>
                            <h1 className="text-xl font-black tjpr-text-main tracking-tight flex items-center gap-2">
                                P-SEP-AR <span className="text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">ADMIN</span>
                            </h1>
                        </div>
                        <div className="hidden md:block">
                            <p className="text-[10px] font-bold tjpr-text-dim uppercase tracking-[0.2em] mt-0.5">
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
                                className="relative p-3 rounded-xl tjpr-bg-alt hover:opacity-80 border tjpr-border-main transition-all group"
                                title="Notificações"
                            >
                                <span className="material-icons tjpr-text-dim group-hover:tjpr-text-main">notifications</span>
                                {notifications && notifications.length > 0 && (
                                    <span className="absolute top-2.5 right-2.5 w-3 h-3 tjpr-bg-error rounded-full border-[3px] tjpr-bg-main animate-pulse"></span>
                                )}
                            </button>
                        )}

                        {/* User Menu Elite */}
                        <div className="relative">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="flex items-center gap-3 p-2 pl-3 rounded-2xl tjpr-bg-alt hover:opacity-80 border tjpr-border-main transition-all"
                            >
                                <div className="hidden lg:block text-right">
                                    <p className="text-xs font-black tjpr-text-main leading-none">
                                        {user?.displayName || 'Usuário'}
                                    </p>
                                    <p className="text-[9px] font-bold tjpr-text-dim uppercase mt-1">
                                        {isAdmin ? 'Administrador' : 'Acessor'}
                                    </p>
                                </div>
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-black/10 dark:shadow-black/20"
                                    style={{ background: `linear-gradient(135deg, ${user?.avatarColor || '#4f46e5'}, #312e81)` }}
                                >
                                    {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                                </div>
                            </button>

                            {/* Dropdown Elite */}
                            {isMenuOpen && (
                                <div className="absolute right-0 mt-3 w-56 tjpr-bg-main border tjpr-border-main rounded-2xl shadow-2xl py-2 z-[100] animate-in fade-in slide-in-from-top-2">
                                    <div className="px-4 py-3 border-b tjpr-border-main mb-2">
                                        <p className="text-xs font-bold tjpr-text-dim uppercase tracking-widest">Opções</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            onOpenProfile();
                                            setIsMenuOpen(false);
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm font-bold tjpr-text-dim hover:tjpr-bg-alt hover:tjpr-text-main flex items-center gap-3 transition-colors"
                                    >
                                        <span className="material-icons text-lg text-primary">person_outline</span>
                                        Meu Perfil
                                    </button>
                                    <button
                                        onClick={() => {
                                            onToggleDarkMode();
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm font-bold tjpr-text-dim hover:tjpr-bg-alt hover:tjpr-text-main flex items-center gap-3 transition-colors"
                                    >
                                        <span className="material-icons text-lg text-amber-400">
                                            {theme === 'dark' ? 'light_mode' : theme === 'light' ? 'dark_mode' : 'brightness_auto'}
                                        </span>
                                        {theme === 'dark' ? 'Modo Claro' : theme === 'light' ? 'Modo Escuro' : 'Tema do Sistema'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            onLogout();
                                            setIsMenuOpen(false);
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm font-bold tjpr-text-error hover:tjpr-bg-error/10 flex items-center gap-3 transition-colors"
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
        default: 'tjpr-bg-alt tjpr-text-dim border tjpr-border-main',
        success: 'tjpr-badge-success',
        warning: 'tjpr-badge-warning',
        error: 'tjpr-badge-error',
        info: 'tjpr-badge-primary',
        primary: 'tjpr-badge-primary',
        secondary: 'tjpr-badge-secondary'
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-300">
            <div className={`w-full ${maxWidths[maxWidth]} max-h-[90vh] overflow-hidden flex flex-col`}>
                <div className="tjpr-card flex flex-col h-full tjpr-bg-main">
                    {/* Header Elite */}
                    <div className="px-6 py-5 border-b tjpr-border-main flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {icon && (
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <span className="material-icons text-primary">{icon}</span>
                                </div>
                            )}
                            <h3 className="text-xl font-extrabold tjpr-text-main tracking-tight">
                                {title}
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl hover:tjpr-bg-alt flex items-center justify-center tjpr-text-dim hover:tjpr-text-main transition-all"
                        >
                            <span className="material-icons">close</span>
                        </button>
                    </div>

                    {/* Content Scrollable */}
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1 tjpr-text-main">
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
             <div className="absolute top-20 right-4 w-96 max-h-[80vh] tjpr-bg-main backdrop-blur-xl rounded-3xl shadow-2xl border tjpr-border-main overflow-hidden z-[100] animate-in zoom-in-95 slide-in-from-top-4 duration-200 origin-top-right">
                <div className="p-6 border-b tjpr-border-main flex justify-between items-center tjpr-bg-alt">
                    <h3 className="font-black tjpr-text-main tracking-tight">NOTIFICAÇÕES</h3>
                    {notifications.length > 0 && (
                        <button onClick={onMarkAsRead} className="text-[10px] font-bold text-primary hover:opacity-80 uppercase tracking-widest border-b border-primary/30">
                            Limpar Tudo
                        </button>
                    )}
                </div>
                <div className="overflow-y-auto max-h-[60vh] custom-scrollbar">
                    {notifications.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 tjpr-bg-alt rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-icons tjpr-text-dim text-3xl">notifications_off</span>
                            </div>
                            <p className="text-sm font-bold tjpr-text-dim uppercase tracking-widest">Vazio</p>
                        </div>
                    ) : (
                        <div className="divide-y tjpr-border-main">
                            {notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={() => onNotificationClick && onNotificationClick(notif)}
                                    className={`p-5 hover:tjpr-bg-alt transition-all cursor-pointer group ${!notif.read ? 'bg-primary/[0.03]' : ''}`}
                                >
                                    <div className="flex gap-4">
                                        <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 transition-transform group-hover:scale-150 ${!notif.read ? 'bg-primary shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'bg-transparent'}`}></div>
                                        <div className="flex-1">
                                             <p className={`text-sm font-medium leading-relaxed ${!notif.read ? 'tjpr-text-main' : 'tjpr-text-dim'}`}>
                                                {notif.message}
                                             </p>
                                             <p className="text-[10px] font-bold tjpr-text-dim uppercase mt-2 tracking-tighter">
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
        info: 'border-primary/50 tjpr-bg-main text-primary',
        success: 'border-emerald-500/50 tjpr-bg-main text-emerald-500',
        warning: 'border-amber-500/50 tjpr-bg-main text-amber-500',
        error: 'border-rose-500/50 tjpr-bg-main text-rose-500'
    };

    return (
         <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl animate-in slide-in-from-right-full duration-500 mb-3 min-w-[300px] max-w-md ${colors[type]}`}>
            <span className="material-icons">{icons[type]}</span>
            <p className="text-xs font-black uppercase tracking-widest flex-1">{message}</p>
            <button onClick={onClose} className="tjpr-text-dim hover:tjpr-text-main transition-colors">
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
                <p className="tjpr-text-dim text-sm font-bold uppercase tracking-widest leading-relaxed">
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
            <div className="tjpr-bg-main backdrop-blur-xl border tjpr-border-main rounded-[2rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <div className="flex items-start gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="material-icons text-primary">cookie</span>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-black tjpr-text-main uppercase tracking-widest mb-2">Privacidade & Cookies</h4>
                        <p className="text-[11px] font-medium tjpr-text-dim leading-relaxed mb-6">
                            Utilizamos cookies e tecnologias similares para garantir a melhor experiência em nossa plataforma monolítica, em conformidade com a LGPD e diretrizes de segurança do TJPR.
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={handleAccept} 
                                className="tjpr-button-primary flex-1 !px-4 !py-3 !text-[10px]"
                            >
                                Aceitar Termos
                            </button>
                            <button 
                                onClick={() => setIsVisible(false)} 
                                className="px-4 py-3 bg-white/5 hover:bg-white/10 tjpr-text-dim hover:tjpr-text-main text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
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
