/**
 * @file login.js
 * Interface de Acesso Monolith Elite - Alta Autoridade TJPR
 */

const TJPRLoginPage = () => {
    const [isLogin, setIsLogin] = React.useState(true);
    const [username, setUsername] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [displayName, setDisplayName] = React.useState('');
    const [setorIdSelecionado, setSetorIdSelecionado] = React.useState('');
    const [setorNome, setSetorNome] = React.useState('');
    const [acceptTerms, setAcceptTerms] = React.useState(false);
    const [showPrivacy, setShowPrivacy] = React.useState(false);
    const [setores, setSetores] = React.useState([]);
    const [error, setError] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);
    const [showForgotPasswordModal, setShowForgotPasswordModal] = React.useState(false);
    const [resetEmail, setResetEmail] = React.useState('');

    // Busca os setores do Supabase quando o modo de registro é ativado
    React.useEffect(() => {
        if (!isLogin && window._supabaseClient) {
            const fetchSetores = async () => {
                try {
                    const { data, error } = await window._supabaseClient
                        .from('setores')
                        .select('*')
                        .order('nome');
                    
                    if (error) throw error;
                    setSetores(data);
                } catch (err) {
                    console.error("Erro ao buscar setores para o registro:", err);
                    setError("Não foi possível carregar a lista de setores.");
                }
            };
            fetchSetores();
        }
    }, [isLogin]);

    const normalizeString = (str) => {
        return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        const fullEmail = username.includes('@') ? username : `${username}@tjpr.jus.br`;

        try {
            if (isLogin) {
                const { error: loginError } = await window._supabaseClient.auth.signInWithPassword({
                    email: fullEmail,
                    password: password
                });
                if (loginError) throw loginError;
            } else {
                if (password !== confirmPassword) {
                    setError("As senhas não coincidem.");
                    setLoading(false);
                    return;
                }
                if (!acceptTerms) {
                    setError("Você precisa concordar com os termos para se registrar.");
                    setLoading(false);
                    return;
                }
                const isCreatingNew = setorIdSelecionado === '__novo__';
                if (!isCreatingNew && !setorIdSelecionado) {
                    setError("Por favor, selecione o seu setor.");
                    setLoading(false);
                    return;
                }
                if (isCreatingNew && !setorNome.trim()) {
                    setError("Por favor, digite o nome do novo setor.");
                    setLoading(false);
                    return;
                }

                let setorIdFinal;
                
                // Se for criar novo setor
                if (isCreatingNew) {
                    const nomeNormalizado = normalizeString(setorNome);
                    const { data: novoSetor, error: setorError } = await window._supabaseClient
                        .from('setores')
                        .insert({ nome: setorNome.trim(), nome_normalizado: nomeNormalizado })
                        .select()
                        .single();
                    
                    if (setorError) {
                        if (setorError.code === '23505') { // Unique constraint
                            throw new Error("Este setor já está cadastrado.");
                        }
                        throw setorError;
                    }
                    setorIdFinal = novoSetor.id;
                } else {
                    setorIdFinal = setorIdSelecionado;
                }

                // Sign up no Supabase
                const { data: signUpData, error: signUpError } = await window._supabaseClient.auth.signUp({
                    email: fullEmail,
                    password: password,
                    options: {
                        data: {
                            display_name: displayName.trim(),
                            setor_id: setorIdFinal
                        }
                    }
                });

                if (signUpError) throw signUpError;

                // O trigger 'on_auth_user_created' no Postgres cuidará de criar o profile.
                // Mas vamos atualizar o profile com o setor_id e nome se necessário.
                if (signUpData.user) {
                    const { error: profileError } = await window._supabaseClient
                        .from('profiles')
                        .update({
                            display_name: displayName.trim(),
                            setor_id: setorIdFinal
                        })
                        .eq('id', signUpData.user.id);
                    
                    if (profileError) console.error("Erro ao atualizar profile:", profileError);
                }

                setMessage("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
                setIsLogin(true);
            }
        } catch (err) {
            console.error('Erro na autenticação:', err);
            setError(err.message || 'Ocorreu um erro. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const openForgotPasswordModal = () => {
        const initialEmail = username
            ? (username.includes('@') ? username : `${username}@tjpr.jus.br`)
            : '';
        setResetEmail(initialEmail);
        setError('');
        setMessage('');
        setShowForgotPasswordModal(true);
    };

    const closeForgotPasswordModal = () => {
        setShowForgotPasswordModal(false);
        setResetEmail('');
    };

    const handleForgotPassword = async () => {
        if (!resetEmail.trim()) {
            setError("Por favor, informe o e-mail do usuário.");
            return;
        }
        const fullEmail = resetEmail.includes('@') ? resetEmail.trim() : `${resetEmail.trim()}@tjpr.jus.br`;
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const { error: resetError } = await window._supabaseClient.auth.resetPasswordForEmail(fullEmail, {
                redirectTo: window.location.origin
            });
            if (resetError) throw resetError;
            
            closeForgotPasswordModal();
            setMessage(`Link de redefinição enviado para ${fullEmail}.`);
        } catch (err) {
            console.error('Erro ao enviar e-mail:', err);
            setError(err.message || 'Erro ao enviar e-mail. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-[#020617] text-white selection:bg-indigo-500/30">
            {/* LADO ESQUERDO: AUTORIDADE E MARCA */}
            <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-slate-900 relative overflow-hidden items-center justify-center p-20">
                {/* Background Decorativo */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,rgba(79,70,229,0.15)_0%,transparent_50%)]"></div>
                    <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_70%,rgba(99,102,241,0.1)_0%,transparent_50%)]"></div>
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
                </div>

                <div className="relative z-10 max-w-lg">
                    <div className="mb-12 inline-flex items-center gap-4 p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm animate-in fade-in slide-in-from-left duration-700">
                        <img src="Logo.png" alt="TJPR" className="h-14 w-auto filter brightness-0 invert" />
                        <div className="h-10 w-px bg-white/10 mx-2"></div>
                        <div>
                            <h2 className="text-sm font-black tracking-widest uppercase">TJPR</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Justiça com Tecnologia</p>
                        </div>
                    </div>

                    <h1 className="text-6xl font-black mb-8 leading-tight tracking-tighter animate-in fade-in slide-in-from-bottom duration-700 delay-200">
                        Excelência no <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Controle de Prazos.</span>
                    </h1>

                    <p className="text-xl text-slate-400 font-medium leading-relaxed mb-12 animate-in fade-in slide-in-from-bottom duration-700 delay-300">
                        A plataforma monolítica para assessores do P-SEP-AR. Precisão judicial, segurança de dados e alta performance operacional.
                    </p>

                    <div className="grid grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom duration-700 delay-500">
                        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-colors group">
                            <span className="material-icons text-indigo-400 mb-4 text-3xl group-hover:scale-110 transition-transform">verified_user</span>
                            <h3 className="font-bold text-white mb-1">Acesso Seguro</h3>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">Autenticação centralizada com monitoramento de sessões.</p>
                        </div>
                        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-colors group">
                            <span className="material-icons text-indigo-400 mb-4 text-3xl group-hover:scale-110 transition-transform">auto_graph</span>
                            <h3 className="font-bold text-white mb-1">Regras CNJ</h3>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">Cálculos baseados na legislação vigente e normas do CNJ.</p>
                        </div>
                    </div>
                </div>

                {/* Footer Discreto */}
                <div className="absolute bottom-12 left-20 right-20 flex justify-between items-center opacity-30 text-[10px] font-bold tracking-[0.2em] uppercase">
                    <span>© 2026 TJPR</span>
                    <span>Versão 2.4.0-ELITE</span>
                </div>
            </div>

            {/* LADO DIREITO: LOGIN FORM */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-20 relative bg-slate-950 overflow-y-auto">
                {/* Blur Decorativo de Fundo (Mobile Only) */}
                <div className="md:hidden absolute inset-0 bg-gradient-to-br from-indigo-950/20 to-slate-950 pointer-events-none"></div>

                <div className="w-full max-w-md relative z-10">
                    <div className="mb-10 text-center md:text-left">
                        <img src="Logo.png" alt="TJPR" className="h-10 w-auto mb-6 mx-auto md:mx-0 md:hidden filter brightness-0 invert" />
                        <h2 className="text-4xl font-black tracking-tight mb-3">
                            {isLogin ? 'Bem-vindo de volta' : 'Inicie sua jornada'}
                        </h2>
                        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">
                            Acesse o Portal de Prazos
                        </p>
                    </div>

                    <div className="tjpr-card !bg-white/5 !border-white/10 !p-8 backdrop-blur-xl shadow-2xl animate-in zoom-in-95 duration-500">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 animate-shake">
                                    <span className="material-icons text-rose-500">error_outline</span>
                                    <p className="text-xs font-bold text-rose-400">{error}</p>
                                </div>
                            )}

                            {message && (
                                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                                    <span className="material-icons text-emerald-500">check_circle_outline</span>
                                    <p className="text-xs font-bold text-emerald-400">{message}</p>
                                </div>
                            )}

                            {!isLogin && (
                                <TJPRInput
                                    label="Seu Nome Profissional"
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Ex: Dr. João Silva"
                                    required
                                    icon="person_outline"
                                />
                            )}

                            {!isLogin && (
                                <div className="space-y-2">
                                    <label className="tjpr-label">Setor de Lotação</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400">
                                            <span className="material-icons">business</span>
                                        </div>
                                        <select
                                            value={setorIdSelecionado}
                                            onChange={(e) => setSetorIdSelecionado(e.target.value)}
                                            required
                                            className="tjpr-input pl-12 appearance-none cursor-pointer"
                                        >
                                            <option value="" disabled className="bg-slate-900">Selecione seu setor...</option>
                                            {setores.map(setor => <option key={setor.id} value={setor.id} className="bg-slate-900">{setor.nome}</option>)}
                                            <option value="__novo__" className="bg-slate-900 font-bold text-indigo-400">Cadastrar novo setor...</option>
                                        </select>
                                    </div>
                                    {setorIdSelecionado === '__novo__' && (
                                        <input
                                            type="text"
                                            placeholder="Nome do Novo Setor"
                                            value={setorNome}
                                            onChange={(e) => setSetorNome(e.target.value)}
                                            required
                                            className="tjpr-input animate-in fade-in slide-in-from-top-2 mt-2"
                                        />
                                    )}
                                </div>
                            )}

                            <TJPRInput
                                label="Usuário Corporativo"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="usuario"
                                helperText={isLogin ? "O sufixo @tjpr.jus.br será incluído automaticamente." : ""}
                                required
                                icon="alternate_email"
                            />

                            <div className="space-y-3">
                                <TJPRInput
                                    label="Senha de Acesso"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    icon="lock_outline"
                                />
                                <div className="flex justify-between items-center px-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 flex items-center gap-1 transition-colors uppercase tracking-widest"
                                    >
                                        <span className="material-icons text-sm">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                        {showPassword ? 'Ocultar' : 'Exibir'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={openForgotPasswordModal}
                                        className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-widest"
                                    >
                                        Esqueci minha senha
                                    </button>
                                </div>
                            </div>

                            {!isLogin && (
                                <React.Fragment>
                                    <TJPRInput
                                        label="Confirmar Senha"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        icon="lock_reset"
                                    />
                                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                                        <input
                                            type="checkbox"
                                            checked={acceptTerms}
                                            onChange={(e) => setAcceptTerms(e.target.checked)}
                                            className="mt-1 h-4 w-4 rounded border-white/10 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                                            id="terms"
                                        />
                                        <label htmlFor="terms" className="text-[10px] font-bold text-slate-400 leading-tight uppercase tracking-widest">
                                            Li e aceito as <button type="button" onClick={() => setShowPrivacy(true)} className="text-indigo-400 underline">normas de uso</button> e a política de proteção de dados.
                                        </label>
                                    </div>
                                </React.Fragment>
                            )}

                            <TJPRButton
                                type="submit"
                                variant="primary"
                                size="lg"
                                icon={loading ? null : (isLogin ? "login" : "person_add")}
                                disabled={loading}
                                className="w-full !rounded-2xl h-14"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>PROCESSANDO...</span>
                                    </div>
                                ) : (
                                    isLogin ? 'ENTRAR NO SISTEMA' : 'CONCLUIR CADASTRO'
                                )}
                            </TJPRButton>
                        </form>

                        <div className="mt-8 pt-8 border-t border-white/5 text-center">
                            <button
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError('');
                                    setMessage('');
                                    closeForgotPasswordModal();
                                }}
                                className="text-xs font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-widest"
                            >
                                {isLogin ? (
                                    <span>Não tem acesso? <span className="text-white border-b border-indigo-500/50">Solicite aqui</span></span>
                                ) : (
                                    <span>Já possui cadastro? <span className="text-white border-b border-indigo-500/50">Ir para Login</span></span>
                                )}
                            </button>
                        </div>
                    </div>

                    <p className="mt-10 text-[9px] text-center text-slate-600 font-bold uppercase tracking-[0.3em]">
                        Segurança TJPR • Proteção por Criptografia Militar
                    </p>
                </div>
            </div>

            {/* MODAL ESQUECI MINHA SENHA ELITE */}
            {showForgotPasswordModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5">
                            <h2 className="text-xl font-black mb-2">Recuperar Acesso</h2>
                            <p className="text-sm text-slate-400 font-medium">
                                Um link de redefinição será enviado para o e-mail informado abaixo.
                            </p>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleForgotPassword();
                            }}
                            className="p-8 space-y-6"
                        >
                            <TJPRInput
                                label="E-mail Institucional"
                                type="email"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                                placeholder="usuario@tjpr.jus.br"
                                required
                                icon="mail_outline"
                            />
                            <div className="flex gap-4">
                                <TJPRButton
                                    type="button"
                                    variant="secondary"
                                    onClick={closeForgotPasswordModal}
                                    disabled={loading}
                                    className="flex-1"
                                >
                                    VOLTAR
                                </TJPRButton>
                                <TJPRButton
                                    type="submit"
                                    variant="primary"
                                    icon={loading ? null : "send"}
                                    disabled={loading}
                                    className="flex-1"
                                >
                                    ENVIAR
                                </TJPRButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
