import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
	assertFails,
	assertSucceeds,
	initializeTestEnvironment,
	type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
	doc,
	getDoc,
	setDoc,
	updateDoc,
	deleteDoc,
	serverTimestamp,
	collection,
	getDocs,
	query,
	where
} from 'firebase/firestore';

let env: RulesTestEnvironment;
const ctx = (uid: string, role?: string) => env.authenticatedContext(uid, role ? { role } : {}).firestore();

beforeAll(async () => {
	const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
	env = await initializeTestEnvironment({
		projectId: 'demo-jolog-rules',
		firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) }
	});
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
	await env.clearFirestore();
	await env.withSecurityRulesDisabled(async (c) => {
		const db = c.firestore();
		await setDoc(doc(db, 'profiles/ana'), { role: 'cliente', name: 'Ana' });
		await setDoc(doc(db, 'profiles/bia'), { role: 'cliente', name: 'Bia' });
		await setDoc(doc(db, 'properties/p1'), { ownerId: 'ana', address: 'Rua A', bedrooms: 2 });
		await setDoc(doc(db, 'bookings/b1'), {
			customerId: 'ana',
			assignedStaff: 'eq1',
			status: 'completed',
			priceCents: 15000
		});
		await setDoc(doc(db, 'bookings/b2'), {
			customerId: 'bia',
			assignedStaff: 'eq2',
			status: 'scheduled',
			priceCents: 15000
		});
		await setDoc(doc(db, 'bookings/b1/photos/f1'), { kind: 'before', storagePath: 'x' });
		await setDoc(doc(db, 'payments/pay1'), { bookingId: 'b1', status: 'paid' });
		await setDoc(doc(db, 'invoices/b1'), { externalId: 'n1' });
		await setDoc(doc(db, 'inspectionChecklistItems/c1'), { label: 'Chaves', active: true });
		await setDoc(doc(db, 'slotLocks/t0_x'), { bookingId: 'b1' });
		await setDoc(doc(db, 'paymentEvents/e1'), {});
	});
});

describe('leitura', () => {
	it('cliente le o proprio booking, nao o de outro cliente', async () => {
		const ana = ctx('ana', 'cliente');
		await assertSucceeds(getDoc(doc(ana, 'bookings/b1')));
		await assertFails(getDoc(doc(ana, 'bookings/b2')));
	});
	it('query de bookings do outro cliente e negada', async () => {
		const ana = ctx('ana', 'cliente');
		await assertFails(getDocs(query(collection(ana, 'bookings'), where('customerId', '==', 'bia'))));
		await assertSucceeds(getDocs(query(collection(ana, 'bookings'), where('customerId', '==', 'ana'))));
	});
	it('acesso cruzado: perfil, imovel, pagamento, NF e fotos de outro cliente', async () => {
		const bia = ctx('bia', 'cliente');
		await assertFails(getDoc(doc(bia, 'profiles/ana')));
		await assertFails(getDoc(doc(bia, 'properties/p1')));
		await assertFails(getDoc(doc(bia, 'payments/pay1')));
		await assertFails(getDoc(doc(bia, 'invoices/b1')));
		await assertFails(getDoc(doc(bia, 'bookings/b1/photos/f1')));
	});
	it('equipe le so bookings atribuidos (e suas fotos)', async () => {
		const eq1 = ctx('eq1', 'equipe');
		await assertSucceeds(getDoc(doc(eq1, 'bookings/b1')));
		await assertSucceeds(getDoc(doc(eq1, 'bookings/b1/photos/f1')));
		await assertFails(getDoc(doc(eq1, 'bookings/b2')));
		await assertFails(getDoc(doc(eq1, 'payments/pay1')));
	});
	it('admin le tudo exceto colecoes so-servidor', async () => {
		const adm = ctx('adm', 'admin');
		for (const p of ['bookings/b1', 'bookings/b2', 'profiles/ana', 'payments/pay1', 'invoices/b1', 'properties/p1'])
			await assertSucceeds(getDoc(doc(adm, p)));
		await assertFails(getDoc(doc(adm, 'slotLocks/t0_x')));
		await assertFails(getDoc(doc(adm, 'paymentEvents/e1')));
	});
	it('sem login nada e lido', async () => {
		const anon = env.unauthenticatedContext().firestore();
		await assertFails(getDoc(doc(anon, 'bookings/b1')));
		await assertFails(getDoc(doc(anon, 'inspectionChecklistItems/c1')));
	});
	it('conta logada sem papel nao acessa dados alheios', async () => {
		await assertFails(getDoc(doc(ctx('zed'), 'bookings/b1')));
	});
});

describe('escrita negada ao app', () => {
	it('cliente nao altera preco, status nem cria booking', async () => {
		const ana = ctx('ana', 'cliente');
		await assertFails(updateDoc(doc(ana, 'bookings/b1'), { priceCents: 1 }));
		await assertFails(updateDoc(doc(ana, 'bookings/b1'), { status: 'completed' }));
		await assertFails(setDoc(doc(ana, 'bookings/new'), { customerId: 'ana', priceCents: 1, status: 'scheduled' }));
		await assertFails(deleteDoc(doc(ana, 'bookings/b1')));
	});
	it('ninguem escreve pagamento, NF, catalogo ou status (nem admin pelo app)', async () => {
		for (const c of [ctx('ana', 'cliente'), ctx('eq1', 'equipe'), ctx('adm', 'admin')]) {
			await assertFails(setDoc(doc(c, 'payments/x'), { bookingId: 'b1', status: 'paid' }));
			await assertFails(updateDoc(doc(c, 'payments/pay1'), { status: 'refunded' }));
			await assertFails(setDoc(doc(c, 'invoices/b1'), { externalId: 'fake' }));
			await assertFails(setDoc(doc(c, 'inspectionChecklistItems/c9'), { label: 'x' }));
			await assertFails(updateDoc(doc(c, 'bookings/b1'), { status: 'in_progress' }));
		}
	});
	it('equipe nao escreve foto direto no Firestore', async () => {
		await assertFails(setDoc(doc(ctx('eq1', 'equipe'), 'bookings/b1/photos/f2'), { kind: 'after' }));
	});
});

describe('auto-promocao de papel', () => {
	it('cliente nao muda o proprio role no perfil', async () => {
		const ana = ctx('ana', 'cliente');
		await assertFails(updateDoc(doc(ana, 'profiles/ana'), { role: 'admin' }));
		await assertFails(updateDoc(doc(ana, 'profiles/ana'), { name: 'Ana', role: 'admin' }));
	});
	it('cliente nao cria perfil proprio com role admin', async () => {
		await assertFails(setDoc(doc(ctx('novo', 'cliente'), 'profiles/novo'), { role: 'admin', name: 'x' }));
		await assertFails(setDoc(doc(ctx('novo'), 'profiles/novo'), { role: 'admin', name: 'x' }));
	});
	it('sem claim de papel nao ha acesso privilegiado', async () => {
		await assertFails(getDoc(doc(ctx('ana'), 'profiles/bia')));
	});
	it('cliente edita nome/telefone do proprio perfil, nao o de outro', async () => {
		await assertSucceeds(updateDoc(doc(ctx('ana', 'cliente'), 'profiles/ana'), { name: 'Ana Maria', phone: '1199' }));
		await assertFails(updateDoc(doc(ctx('ana', 'cliente'), 'profiles/bia'), { name: 'hack' }));
	});
});

describe('imoveis', () => {
	it('cliente cria imovel proprio valido', async () => {
		await assertSucceeds(
			setDoc(doc(ctx('ana', 'cliente'), 'properties/p2'), { ownerId: 'ana', address: 'Rua B', bedrooms: 3 })
		);
	});
	it('nao cria em nome de outro nem com quartos invalidos', async () => {
		const ana = ctx('ana', 'cliente');
		await assertFails(setDoc(doc(ana, 'properties/p3'), { ownerId: 'bia', address: 'Rua B', bedrooms: 3 }));
		await assertFails(setDoc(doc(ana, 'properties/p4'), { ownerId: 'ana', address: 'Rua B', bedrooms: 5 }));
	});
	it('nao altera imovel de outro', async () => {
		await assertFails(updateDoc(doc(ctx('bia', 'cliente'), 'properties/p1'), { address: 'x' }));
	});
});

describe('avaliacao', () => {
	const review = () => ({ customerId: 'ana', rating: 5, comment: 'otimo', createdAt: serverTimestamp() });
	it('dono avalia pedido concluido', async () => {
		await assertSucceeds(setDoc(doc(ctx('ana', 'cliente'), 'reviews/b1'), review()));
	});
	it('nao avalia pedido de outro, nem pedido nao concluido', async () => {
		await assertFails(setDoc(doc(ctx('bia', 'cliente'), 'reviews/b1'), { ...review(), customerId: 'bia' }));
		await assertFails(setDoc(doc(ctx('bia', 'cliente'), 'reviews/b2'), { ...review(), customerId: 'bia' }));
	});
	it('nota fora de 1-5 e campos extras sao negados', async () => {
		const ana = ctx('ana', 'cliente');
		await assertFails(setDoc(doc(ana, 'reviews/b1'), { ...review(), rating: 6 }));
		await assertFails(setDoc(doc(ana, 'reviews/b1'), { ...review(), bonus: 100 }));
	});
});
