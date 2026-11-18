/**
 * Cria (ou reseta) a conta de teste para revisores das lojas (Apple App Review e Google Play Review).
 *   bun run scripts/create-reviewer.ts [email] [senha] [nome]
 * Exemplo:
 *   bun run scripts/create-reviewer.ts revisor@jolog.com "JologReview2026!" "Revisor de Teste"
 */
import { adminAuth, adminDb } from '../src/lib/server/firebase';

const [email = 'revisor@jolog.com', password = 'JologReview2026!', name = 'Revisor Apple/Google'] =
	process.argv.slice(2);

const auth = adminAuth();
const db = adminDb();

let user = await auth.getUserByEmail(email).catch(() => null);
if (!user) {
	user = await auth.createUser({
		email,
		password,
		displayName: name
	});
	console.log(`Conta de revisor criada: ${email}`);
} else {
	await auth.updateUser(user.uid, { password });
	console.log(`Senha do revisor atualizada para a conta: ${email}`);
}

await auth.setCustomUserClaims(user.uid, { role: 'cliente' });

await db.collection('profiles').doc(user.uid).set(
	{
		role: 'cliente',
		name,
		phone: '21975706117',
		cpfCnpj: '00000000000',
		createdAt: new Date().toISOString()
	},
	{ merge: true }
);

// Cadastra um imóvel inicial de teste para o revisor não precisar preencher endereço do zero
const propRef = db.collection('properties').doc(`prop_review_${user.uid.slice(0, 8)}`);
await propRef.set(
	{
		customerId: user.uid,
		condominium: 'Etehe',
		block: '1',
		apartment: '101',
		address: 'Estrada dos Bandeirantes, 1000 - Rio de Janeiro, RJ',
		bedrooms: 2,
		createdAt: new Date().toISOString()
	},
	{ merge: true }
);

console.log(`\n========================================`);
console.log(`✅ CONTA DE REVISOR PRONTA PARA AS LOJAS:`);
console.log(`E-mail:   ${email}`);
console.log(`Senha:    ${password}`);
console.log(`Papel:    cliente`);
console.log(`Imóvel:   Condomínio Etehe, Bloco 1, Apt 101 (2 quartos)`);
console.log(`========================================\n`);
process.exit(0);

