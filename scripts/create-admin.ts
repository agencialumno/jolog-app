/**
 * Cria (ou promove) o PRIMEIRO admin. Roda so na sua maquina, com a service account em variaveis de ambiente:
 *   bun run scripts/create-admin.ts email@exemplo.com "Senha forte" "Nome"
 * Nunca exposto como endpoint. Depois use POST /api/admin/users/:uid/role para os demais papeis.
 */
import { adminAuth, adminDb } from '../src/lib/server/firebase';

const [email, password, name = 'Admin'] = process.argv.slice(2);
if (!email) {
	console.error('uso: bun run scripts/create-admin.ts <email> [senha] [nome]');
	process.exit(1);
}
const auth = adminAuth();
let user = await auth.getUserByEmail(email).catch(() => null);
if (!user) {
	if (!password || password.length < 8) {
		console.error('conta nao existe: informe uma senha com 8+ caracteres');
		process.exit(1);
	}
	user = await auth.createUser({ email, password, displayName: name });
}
await auth.setCustomUserClaims(user.uid, { role: 'admin' });
await adminDb()
	.collection('profiles')
	.doc(user.uid)
	.set({ role: 'admin', name, createdAt: new Date() }, { merge: true });
console.log(`admin definido: ${email} (${user.uid}). Faca login de novo para renovar o token.`);
