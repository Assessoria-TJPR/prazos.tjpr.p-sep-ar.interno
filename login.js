/**
 * @file login.js
 * Componente de Login redesenhado - Design Profissional TJPR
 */

const TJPRLoginPage = () => {
    const [username, setUsername] = React.useState(''); // Mudado de email para username
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Constrói o email completo adicionando o domínio
            const fullEmail = username.includes('@')
                ? username // Se já incluir @, usa como está
                : `${username}@tjpr.jus.br`; // Senão, adiciona o domínio

            await firebase.auth().signInWithEmailAndPassword(fullEmail, password);
            // Login bem-sucedido - o AuthProvider cuidará do redirecionamento
        } catch (err) {
            console.error('Erro no login:', err);

            // Mensagens de erro mais amigáveis
            const errorMessages = {
                'auth/invalid-email': 'Email inválido.',
                'auth/user-disabled': 'Esta conta foi desativada.',
                'auth/user-not-found': 'Email ou senha incorretos.',
                'auth/wrong-password': 'Email ou senha incorretos.',
                'auth/invalid-credential': 'Email ou senha incorretos.',
                'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
            };

            setError(errorMessages[err.code] || 'Erro ao fazer login. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen overflow-y-auto bg-gradient-to-br from-tjpr-navy-900 via-tjpr-navy-800 to-tjpr-navy-700 flex items-center justify-center p-4 sm:p-8">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '40px 40px'
                }}></div>
            </div>

            {/* Login Card */}
            <div className="relative w-full max-w-md my-auto">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header com Logo */}
                    <div className="bg-gradient-to-r from-tjpr-navy-800 to-tjpr-navy-700 px-6 sm:px-8 py-8 sm:py-12 text-center">
                        <img
                            src="Logo.png"
                            alt="TJPR"
                            className="h-16 sm:h-20 mx-auto mb-4 filter brightness-0 invert"
                        />
                        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
                            Módulo de Prazos
                        </h1>
                        <p className="text-sm text-tjpr-navy-500">
                            Tribunal de Justiça do Paraná
                        </p>
                        <p className="text-xs text-tjpr-navy-600 mt-1">
                            Assessoria P-SEP-AR
                        </p>
                    </div>

                    {/* Form */}
                    <div className="p-6 sm:p-8">
                        <form onSubmit={handleLogin} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-tjpr-error p-4 rounded">
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons text-tjpr-error text-sm">error</span>
                                        <p className="text-sm text-tjpr-error font-medium">{error}</p>
                                    </div>
                                </div>
                            )}

                            <TJPRInput
                                label="Usuário"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="seu.usuario"
                                helperText="Digite apenas seu login (o @tjpr.jus.br será adicionado automaticamente)"
                                required
                                icon="person"
                            />

                            <div>
                                <TJPRInput
                                    label="Senha"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    icon="lock"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="mt-2 text-sm text-tjpr-navy-700 hover:text-tjpr-navy-600 flex items-center gap-1"
                                >
                                    <span className="material-icons text-sm">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                    {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                </button>
                            </div>

                            <TJPRButton
                                type="submit"
                                variant="primary"
                                size="lg"
                                icon={loading ? null : "login"}
                                disabled={loading}
                                className="w-full"
                            >
                                {loading ? (
                                    <>
                                        <span className="inline-block animate-spin material-icons">refresh</span>
                                        Entrando...
                                    </>
                                ) : (
                                    'Entrar no Sistema'
                                )}
                            </TJPRButton>
                        </form>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-white/70">
                        Sistema de uso restrito • Assessoria P-SEP-AR
                    </p>
                </div>
            </div>
        </div>
    );
};
