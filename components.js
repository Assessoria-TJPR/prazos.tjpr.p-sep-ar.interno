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
const TJPRHeader = ({ user, onLogout, onToggleDarkMode, isDarkMode, onOpenProfile, currentArea, onNavigate, isAdmin }) => {
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
                    {onNavigate && (
                        <nav className="hidden md:flex items-center gap-2">
                            <button
                                onClick={() => onNavigate('Calculadora')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${currentArea === 'Calculadora'
                                    ? 'bg-white/20 text-white'
                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                <span className="material-icons text-sm">calculate</span>
                                Calculadora
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={() => onNavigate('Admin')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${currentArea === 'Admin'
                                        ? 'bg-white/20 text-white'
                                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <span className="material-icons text-sm">settings</span>
                                    Administração
                                </button>
                            )}
                        </nav>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
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
