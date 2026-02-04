/**
 * @file login.js
 * Componente de Login redesenhado - Design Profissional TJPR
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

    // Busca os setores do Firestore quando o modo de registro é ativado
    React.useEffect(() => {
        if (!isLogin && window.db) {
            const fetchSetores = async () => {
                try {
                    const snapshot = await window.db.collection('setores').orderBy('nome').get();
                    const setoresList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setSetores(setoresList);
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
                await firebase.auth().signInWithEmailAndPassword(fullEmail, password);
            } else {
                // Lógica de Registro
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
                let userCredential;

                // 1. Cria o usuário no Firebase Auth
                userCredential = await firebase.auth().createUserWithEmailAndPassword(fullEmail, password);

                // 2. Lógica de Setor (mesma do app.js original)
                if (isCreatingNew) {
                    const nomeNormalizado = normalizeString(setorNome);
                    const batch = window.db.batch();
                    const novoSetorRef = window.db.collection('setores').doc();
                    batch.set(novoSetorRef, { nome: setorNome.trim(), nomeNormalizado: nomeNormalizado });
                    const nomeUnicoRef = window.db.collection('setorNomesUnicos').doc(nomeNormalizado);
                    batch.set(nomeUnicoRef, { setorId: novoSetorRef.id });
                    await batch.commit();
                    setorIdFinal = novoSetorRef.id;
                } else {
                    setorIdFinal = setorIdSelecionado;
                }

                // 3. Salva dados adicionais no Firestore
                await window.db.collection('users').doc(userCredential.user.uid).set({
                    email: fullEmail,
                    role: 'basic',
                    displayName: displayName.trim(),
                    setorId: setorIdFinal,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // 4. Atualiza perfil e envia verificação
                await userCredential.user.updateProfile({ displayName: displayName.trim() });
                await userCredential.user.sendEmailVerification();

                setMessage("Conta criada! Enviamos um link de verificação para o seu e-mail.");
                setIsLogin(true); // Volta para o login após o registro
            }
        } catch (err) {
            console.error('Erro na autenticação:', err);
            const errorMessages = {
                'auth/invalid-email': 'Email inválido.',
                'auth/user-disabled': 'Esta conta foi desativada.',
                'auth/user-not-found': 'Email ou senha incorretos.',
                'auth/wrong-password': 'Email ou senha incorretos.',
                'auth/email-already-in-use': 'Este email já está sendo usado.',
                'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
                'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
            };
            setError(errorMessages[err.code] || 'Ocorreu um erro. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen overflow-y-auto bg-gradient-to-br from-tjpr-navy-900 via-tjpr-navy-800 to-tjpr-navy-700 flex items-center justify-center p-4 sm:p-8">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '40px 40px'
                }}></div>
            </div>

            <div className="relative w-full max-w-md my-auto">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300">
                    <div className="bg-gradient-to-r from-tjpr-navy-800 to-tjpr-navy-700 px-6 sm:px-8 py-6 sm:py-8 text-center">
                        <img src="Logo.png" alt="TJPR" className="h-12 sm:h-16 mx-auto mb-3 filter brightness-0 invert" />
                        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
                            {isLogin ? 'Módulo de Prazos' : 'Criar Conta'}
                        </h1>
                        <p className="text-xs text-tjpr-navy-500">
                            Tribunal de Justiça do Paraná
                        </p>
                    </div>

                    <div className="p-6 sm:p-8">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-tjpr-error p-3 rounded animate-shake">
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons text-tjpr-error text-sm">error</span>
                                        <p className="text-xs text-tjpr-error font-medium">{error}</p>
                                    </div>
                                </div>
                            )}

                            {message && (
                                <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-tjpr-success p-3 rounded">
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons text-tjpr-success text-sm">check_circle</span>
                                        <p className="text-xs text-tjpr-success font-medium">{message}</p>
                                    </div>
                                </div>
                            )}

                            {!isLogin && (
                                <TJPRInput
                                    label="Nome Completo"
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Ex: João Silva"
                                    required
                                    icon="person_outline"
                                />
                            )}

                            {!isLogin && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Setor de Lotação <span className="text-tjpr-error">*</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="material-icons text-gray-400">business</span>
                                        </div>
                                        <select
                                            value={setorIdSelecionado}
                                            onChange={(e) => setSetorIdSelecionado(e.target.value)}
                                            required
                                            className="tjpr-input pl-10 appearance-none"
                                        >
                                            <option value="" disabled>Selecione seu setor...</option>
                                            {setores.map(setor => <option key={setor.id} value={setor.id}>{setor.nome}</option>)}
                                            <option value="__novo__" className="font-bold text-blue-600">Não encontrou? Cadastre um novo...</option>
                                        </select>
                                    </div>
                                    {setorIdSelecionado === '__novo__' && (
                                        <input
                                            type="text"
                                            placeholder="Digite o nome do novo setor"
                                            value={setorNome}
                                            onChange={(e) => setSetorNome(e.target.value)}
                                            required
                                            className="tjpr-input animate-fade-in mt-2"
                                        />
                                    )}
                                </div>
                            )}

                            <TJPRInput
                                label="Usuário TJPR"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="seu.usuario"
                                helperText={isLogin ? "O @tjpr.jus.br será adicionado automaticamente" : ""}
                                required
                                icon="alternate_email"
                            />

                            <div className="space-y-1">
                                <TJPRInput
                                    label="Senha"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    icon="lock"
                                />
                                {isLogin && (
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-[10px] text-tjpr-navy-700 hover:text-tjpr-navy-600 flex items-center gap-1 transition-colors"
                                    >
                                        <span className="material-icons" style={{ fontSize: '12px' }}>
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                        {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                    </button>
                                )}
                            </div>

                            {!isLogin && (
                                <TJPRInput
                                    label="Confirmar Senha"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    icon="lock_reset"
                                />
                            )}

                            {!isLogin && (
                                <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    <input
                                        type="checkbox"
                                        checked={acceptTerms}
                                        onChange={(e) => setAcceptTerms(e.target.checked)}
                                        className="mt-1 h-4 w-4 rounded border-gray-300 text-tjpr-navy-800 focus:ring-tjpr-navy-700"
                                        id="terms"
                                    />
                                    <label htmlFor="terms" className="leading-tight">
                                        Li e concordo com a <button type="button" onClick={() => setShowPrivacy(true)} className="text-tjpr-navy-700 font-bold hover:underline">Política de Privacidade e Termos de Uso</button>.
                                    </label>
                                </div>
                            )}

                            <TJPRButton
                                type="submit"
                                variant="primary"
                                size="lg"
                                icon={loading ? null : (isLogin ? "login" : "person_add")}
                                disabled={loading}
                                className="w-full mt-2"
                            >
                                {loading ? (
                                    <span className="inline-block animate-spin material-icons">refresh</span>
                                ) : (
                                    isLogin ? 'Entrar no Sistema' : 'Criar minha conta'
                                )}
                            </TJPRButton>
                        </form>

                        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 text-center">
                            <button
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError('');
                                    setMessage('');
                                }}
                                className="text-sm font-medium text-tjpr-navy-800 hover:text-tjpr-navy-700 dark:text-tjpr-navy-500 transition-colors"
                            >
                                {isLogin ? (
                                    <>Não possui conta? <span className="font-bold underline">Cadastre-se aqui</span></>
                                ) : (
                                    <>Já possui uma conta? <span className="font-bold underline">Faça login</span></>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-[10px] text-white/60 uppercase tracking-widest font-medium">
                        Sistema Restrito • Assessoria P-SEP-AR • TJPR
                    </p>
                </div>
            </div>

            {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
        </div>
    );
};
