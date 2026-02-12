/**
 * @file components.jsx
 * Componentes reutilizáveis do Design System TJPR
 */

const { useState, useEffect } = React;

// ============================================
// COMPONENTES BASE DO DESIGN SYSTEM
// ============================================

/**
 * TJPRCard - Container estilizado para seções de conteúdo
 */
const TJPRCard = ({ title, subtitle, children, actions, className = '', icon }) => {
    return (
        <div className={`tjpr-card ${className}`}>
            {(title || subtitle || icon) && (
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        {icon && (
                            <span className="material-icons text-tjpr-navy-700 dark:text-tjpr-navy-500">{icon}</span>
                        )}
                        <div className="flex-1">
                            {title && (
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {title}
                                </h3>
                            )}
                            {subtitle && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                    {actions}
                </div>
            )}
        </div>
    );
};

/**
 * TJPRButton - Botão estilizado do sistema
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
    const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variantClasses = {
        primary: 'bg-tjpr-navy-800 hover:bg-tjpr-navy-700 text-white focus:ring-tjpr-navy-700 shadow-sm hover:shadow-md',
        secondary: 'bg-white hover:bg-gray-50 text-tjpr-navy-800 border-2 border-tjpr-navy-800 focus:ring-tjpr-navy-700',
        success: 'bg-tjpr-success hover:bg-green-700 text-white focus:ring-tjpr-success shadow-sm',
        warning: 'bg-tjpr-warning hover:bg-orange-600 text-white focus:ring-tjpr-warning shadow-sm',
        error: 'bg-tjpr-error hover:bg-red-700 text-white focus:ring-tjpr-error shadow-sm',
        ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg'
    };

    const disabledClasses = 'opacity-50 cursor-not-allowed pointer-events-none';

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? disabledClasses : ''} ${className}`}
        >
            {icon && iconPosition === 'left' && (
                <span className="material-icons text-inherit" style={{ fontSize: 'inherit' }}>{icon}</span>
            )}
            {children}
            {icon && iconPosition === 'right' && (
                <span className="material-icons text-inherit" style={{ fontSize: 'inherit' }}>{icon}</span>
            )}
        </button>
    );
};

/**
 * TJPRInput - Campo de entrada estilizado
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
                    {required && <span className="text-tjpr-error ml-1">*</span>}
                </label>
            )}
            <div className="relative">
                {icon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-icons text-gray-400">{icon}</span>
                    </div>
                )}
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    className={`tjpr-input ${icon ? 'pl-10' : ''} ${error ? 'border-tjpr-error' : ''}`}
                />
            </div>
            {error && (
                <p className="mt-1 text-sm text-tjpr-error flex items-center gap-1">
                    <span className="material-icons text-sm">error</span>
                    {error}
                </p>
            )}
            {helperText && !error && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {helperText}
                </p>
            )}
        </div>
    );
};

/**
 * TJPRHeader - Cabeçalho institucional do sistema
 */
const TJPRHeader = ({ user, onLogout, onToggleDarkMode, isDarkMode, onOpenProfile, currentArea, onNavigate, isAdmin, notifications, onToggleNotifications }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="tjpr-header sticky top-0 z-50">
            <div className="max-w-full px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo e Título */}
                    <div className="flex items-center gap-4">
                        <img src="Logo.png" alt="TJPR" className="h-10 w-auto" />
                        <div className="hidden sm:block">
                            <h1 className="text-lg font-semibold text-white">
                                Módulo de Prazos Processuais
                            </h1>
                            <p className="text-xs text-tjpr-navy-500">
                                Assessoria P-SEP-AR
                            </p>
                        </div>
                    </div>

                    {/* Navigation (if navigation is provided) */}


                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        {/* Notifications Toggle */}
                        {onToggleNotifications && (
                            <button
                                onClick={onToggleNotifications}
                                className="relative p-2 rounded-lg hover:bg-tjpr-navy-700 transition-colors"
                                title="Notificações"
                            >
                                <span className="material-icons text-white">notifications</span>
                                {notifications && notifications.length > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-tjpr-navy-900 pointer-events-none"></span>
                                )}
                            </button>
                        )}

                        {/* Dark Mode Toggle */}
                        <button
                            onClick={onToggleDarkMode}
                            className="p-2 rounded-lg hover:bg-tjpr-navy-700 transition-colors"
                            title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
                        >
                            <span className="material-icons text-white">
                                {isDarkMode ? 'light_mode' : 'dark_mode'}
                            </span>
                        </button>

                        {/* User Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-tjpr-navy-700 transition-colors"
                            >
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold"
                                    style={{ backgroundColor: user?.avatarColor || '#C5A572' }}
                                >
                                    {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <span className="hidden md:block text-white text-sm font-medium">
                                    {user?.displayName || user?.email?.split('@')[0] || 'Usuário'}
                                </span>
                                <span className="material-icons text-white text-sm">
                                    {isMenuOpen ? 'expand_less' : 'expand_more'}
                                </span>
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl py-2 border border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={() => {
                                            onOpenProfile();
                                            setIsMenuOpen(false);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    >
                                        <span className="material-icons text-sm">person</span>
                                        Meu Perfil
                                    </button>
                                    <button
                                        onClick={() => {
                                            onLogout();
                                            setIsMenuOpen(false);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-tjpr-error hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    >
                                        <span className="material-icons text-sm">logout</span>
                                        Sair
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
 * TJPRBadge - Badge para status e categorias
 */
const TJPRBadge = ({ children, variant = 'default', icon }) => {
    const variants = {
        default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        success: 'tjpr-badge-success',
        warning: 'tjpr-badge-warning',
        error: 'tjpr-badge-error',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    };

    return (
        <span className={`tjpr-badge ${variants[variant]}`}>
            {icon && <span className="material-icons text-xs mr-1">{icon}</span>}
            {children}
        </span>
    );
};

/**
 * TJPRFormGroup - Wrapper para grupos de campos de formulário
 */
const TJPRFormGroup = ({ children, cols = 1, className = '' }) => {
    const gridCols = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
    };

    return (
        <div className={`grid ${gridCols[cols]} gap-4 ${className}`}>
            {children}
        </div>
    );
};

/**
 * TJPRModal - Modal/Dialog profissional
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`w-full ${maxWidths[maxWidth]} max-h-[90vh] overflow-auto`}>
                <div className="tjpr-card">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {icon && (
                                    <span className="material-icons text-tjpr-navy-700 dark:text-tjpr-navy-500">{icon}</span>
                                )}
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {title}
                                </h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <span className="material-icons text-gray-500">close</span>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * PrivacyPolicyModal - Modal de Política de Privacidade
 */
const PrivacyPolicyModal = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Política de Privacidade e Termos de Uso</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">1. Coleta de Dados</h3>
                    <p>Para o funcionamento desta ferramenta (Calculadora de Prazos e Painel Administrativo), coletamos os seguintes dados pessoais:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Identificação:</strong> Nome, E-mail e Setor de lotação.</li>
                        <li><strong>Dados de Uso:</strong> Registros de cálculos realizados, números de processos consultados, data e hora das ações.</li>
                        <li><strong>Técnicos:</strong> Endereço IP e User-Agent (navegador) para fins de segurança e auditoria.</li>
                    </ul>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">2. Finalidade</h3>
                    <p>Os dados são utilizados estritamente para:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Autenticação e controle de acesso ao sistema.</li>
                        <li>Geração de histórico de cálculos para o próprio usuário.</li>
                        <li>Auditoria e estatísticas de uso para a administração do sistema (TJPR).</li>
                        <li>Melhoria contínua da ferramenta através da análise de erros reportados.</li>
                    </ul>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">3. Armazenamento e Segurança</h3>
                    <p>Os dados são armazenados em nuvem utilizando os serviços do Google Firebase, com regras de segurança que restringem o acesso apenas a usuários autorizados e administradores do sistema.</p>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">4. Seus Direitos (LGPD)</h3>
                    <p>Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Acessar seus dados (disponível no Perfil e Histórico).</li>
                        <li>Corrigir dados incompletos ou desatualizados.</li>
                        <li>Solicitar a exclusão de sua conta e dados pessoais (disponível na opção "Excluir Conta" no perfil).</li>
                    </ul>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">5. Cookies e Armazenamento Local</h3>
                    <p>Utilizamos armazenamento local (LocalStorage) para salvar suas preferências de tema e configurações da calculadora. Não utilizamos cookies de rastreamento publicitário.</p>
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={onClose} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all">Entendi</button>
                </div>
            </div>
        </div>
    );
};

/**
 * CookieConsent - Banner de consentimento de cookies/LGPD
 */
const CookieConsent = () => {
    const [visible, setVisible] = React.useState(false);

    React.useEffect(() => {
        const consent = localStorage.getItem('lgpd_consent');
        if (!consent) {
            setVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('lgpd_consent', 'true');
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-[80] animate-fade-in">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-slate-600 dark:text-slate-300">
                    <p><strong>Este sistema utiliza dados para funcionamento.</strong></p>
                    <p>Utilizamos armazenamento local para salvar suas preferências e coletamos dados de uso para fins de auditoria e melhoria, em conformidade com a LGPD. Ao continuar, você concorda com nossa Política de Privacidade.</p>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                    <button
                        onClick={() => document.dispatchEvent(new CustomEvent('openPrivacyPolicy'))}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Ler Política
                    </button>
                    <button
                        onClick={handleAccept}
                        className="px-6 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        Concordar e Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

const NotificationsPanel = ({ notifications, onMarkAsRead, isOpen, onClose, onNotificationClick }) => {
    if (!isOpen) return null;

    return (
        <React.Fragment>
            <div className="fixed inset-0 z-[40]" onClick={onClose}></div>
            <div className="absolute top-16 right-4 w-80 max-h-[80vh] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[50] animate-fade-in-up origin-top-right">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">Notificações</h3>
                    {notifications.length > 0 && (
                        <button onClick={onMarkAsRead} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                            Marcar todas como lidas
                        </button>
                    )}
                </div>
                <div className="overflow-y-auto max-h-[60vh]">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            <span className="material-icons text-4xl mb-2 text-slate-300 dark:text-slate-600">notifications_off</span>
                            <p className="text-sm">Nenhuma notificação nova.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={() => onNotificationClick && onNotificationClick(notif)}
                                    className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer ${!notif.read ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                                >
                                    <div className="flex gap-3">
                                        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!notif.read ? 'bg-indigo-500' : 'bg-transparent'}`}></div>
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-800 dark:text-slate-200">{notif.message}</p>
                                            <p className="text-xs text-slate-400 mt-1">{formatarData(notif.createdAt?.toDate())}</p>
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

window.NotificationsPanel = NotificationsPanel;
