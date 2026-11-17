const MESSAGES: Record<string, string> = {
	'auth/invalid-email': 'E-mail inválido. Confira e tente de novo.',
	'auth/missing-email': 'Informe o seu e-mail.',
	'auth/missing-password': 'Informe a sua senha.',
	'auth/user-not-found': 'E-mail ou senha incorretos.',
	'auth/wrong-password': 'E-mail ou senha incorretos.',
	'auth/invalid-credential': 'E-mail ou senha incorretos.',
	'auth/email-already-in-use': 'Já existe uma conta com este e-mail. Tente entrar.',
	'auth/weak-password': 'Senha fraca. Use pelo menos 8 caracteres.',
	'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
	'auth/user-disabled': 'Esta conta está desativada. Fale com o SAC.',
	'auth/network-request-failed': 'Sem conexão. Verifique a internet e tente de novo.',
	'auth/invalid-api-key': 'O app não está configurado corretamente. Fale com o SAC.',
	'auth/operation-not-allowed': 'Login por e-mail e senha não está habilitado.'
};

/** Traduz erros do Firebase Auth/API para mensagens claras em português (sem vazar detalhes técnicos). */
export function authErrorMessage(e: unknown): string {
	const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
	if (MESSAGES[code]) return MESSAGES[code];
	if (typeof e === 'object' && e && 'status' in e)
		return 'Sua conta foi criada, mas não conseguimos concluir o cadastro. Entre com seu e-mail e senha para tentar de novo.';
	return 'Algo deu errado. Tente novamente.';
}

export interface Credentials {
	email: string;
	password: string;
	name?: string;
}

/** Validação no aparelho antes de chamar o Firebase. Devolve a mensagem ou null. */
export function validateCredentials(c: Credentials, mode: 'entrar' | 'cadastrar'): string | null {
	if (mode === 'cadastrar' && !c.name?.trim()) return 'Informe o seu nome.';
	if (!c.email.trim()) return 'Informe o seu e-mail.';
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) return 'E-mail inválido. Confira e tente de novo.';
	if (!c.password) return 'Informe a sua senha.';
	if (mode === 'cadastrar' && c.password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
	return null;
}
