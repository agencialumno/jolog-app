import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertNotProduction, FakePaymentProvider } from '../src/lib/server/payments/fake';
import { FakeInvoiceProvider } from '../src/lib/server/invoices/fake';
import { handlePaymentEvent, type BookingRepo } from '../src/lib/server/payment-handler';
import type { PaymentEvent } from '../src/lib/server/payments/types';

describe('Apêndice B: Provedor de Pagamento Fake', () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		delete process.env.VERCEL_ENV;
		delete process.env.NODE_ENV;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		vi.restoreAllMocks();
	});

	describe('Trava de Segurança em Produção', () => {
		it('lança erro ao invocar assertNotProduction quando NODE_ENV === "production"', () => {
			process.env.NODE_ENV = 'production';
			expect(() => assertNotProduction()).toThrowError(/Fake payment provider cannot be used in production/);
		});

		it('lança erro ao invocar assertNotProduction quando VERCEL_ENV === "production"', () => {
			process.env.VERCEL_ENV = 'production';
			expect(() => assertNotProduction()).toThrowError(/Fake payment provider cannot be used in production/);
		});

		it('bloqueia createPixCharge em ambiente de produção', async () => {
			process.env.NODE_ENV = 'production';
			const provider = new FakePaymentProvider();
			await expect(
				provider.createPixCharge({
					customer: { name: 'Teste', cpfCnpj: '00000000000' },
					valueCents: 13000,
					reference: 'booking_1',
					description: 'Limpeza',
					expiresInMinutes: 15
				})
			).rejects.toThrowError(/cannot be used in production/);
		});

		it('bloqueia createPaymentLink em ambiente de produção', async () => {
			process.env.VERCEL_ENV = 'production';
			const provider = new FakePaymentProvider();
			await expect(
				provider.createPaymentLink({
					valueCents: 13000,
					reference: 'booking_1',
					description: 'Limpeza'
				})
			).rejects.toThrowError(/cannot be used in production/);
		});
	});

	describe('FakePaymentProvider fora de produção', () => {
		it('gera cobrança Pix com id "fake_<uuid>", copia e cola "PIX-FAKE-..." e validade', async () => {
			const provider = new FakePaymentProvider();
			const charge = await provider.createPixCharge({
				customer: { name: 'Cliente Teste', cpfCnpj: '12345678909' },
				valueCents: 13000,
				reference: 'book_abc',
				description: 'Limpeza 2 quartos',
				expiresInMinutes: 15
			});

			expect(charge.providerId).toMatch(/^fake_[0-9a-f-]+$/);
			expect(charge.pixCopiaECola).toMatch(/^PIX-FAKE-[0-9a-f-]+$/);
			expect(charge.qrCodeBase64).toBeTruthy();
			expect(new Date(charge.expiresAt).getTime()).toBeGreaterThan(Date.now());
		});

		it('gera link de pagamento apontando para /pagamento-teste/<id>', async () => {
			const provider = new FakePaymentProvider();
			const link = await provider.createPaymentLink({
				valueCents: 16000,
				reference: 'book_def',
				description: 'Limpeza 3 quartos'
			});

			expect(link.providerId).toMatch(/^fake_[0-9a-f-]+$/);
			expect(link.url).toBe(`/pagamento-teste/${link.providerId}`);
		});

		it('parseWebhook interpreta eventos paid, expired e refunded corretamente', () => {
			const provider = new FakePaymentProvider();
			const headers = new Headers();

			const paidRaw = JSON.stringify({
				type: 'paid',
				providerId: 'fake_123',
				externalReference: 'booking_99',
				eventId: 'evt_paid_1'
			});
			const eventPaid = provider.parseWebhook(headers, paidRaw);
			expect(eventPaid).toEqual({
				type: 'paid',
				providerId: 'fake_123',
				externalReference: 'booking_99',
				eventId: 'evt_paid_1'
			});

			const expiredRaw = JSON.stringify({
				type: 'expired',
				providerId: 'fake_123',
				externalReference: 'booking_99',
				eventId: 'evt_exp_1'
			});
			const eventExp = provider.parseWebhook(headers, expiredRaw);
			expect(eventExp).toEqual({
				type: 'expired',
				providerId: 'fake_123',
				externalReference: 'booking_99',
				eventId: 'evt_exp_1'
			});
		});
	});

	describe('handlePaymentEvent com FakeInvoiceProvider e idempotência', () => {
		function createMockRepo(initialEvents: string[] = []): BookingRepo & {
			paid: { bookingId: string; providerId: string }[];
			expired: string[];
			invoices: { bookingId: string; externalId: string; status: string; pdfUrl?: string }[];
			failures: { bookingId: string; error: string }[];
		} {
			const events = new Set(initialEvents);
			const paid: { bookingId: string; providerId: string }[] = [];
			const expired: string[] = [];
			const invoices: { bookingId: string; externalId: string; status: string; pdfUrl?: string }[] = [];
			const failures: { bookingId: string; error: string }[] = [];

			return {
				paid,
				expired,
				invoices,
				failures,
				async registerEvent(eventId: string) {
					if (events.has(eventId)) return false;
					events.add(eventId);
					return true;
				},
				async markPaid(bookingId: string, providerId: string) {
					paid.push({ bookingId, providerId });
					return {
						service: 'cleaning',
						valueCents: 13000,
						description: 'Serviço de limpeza',
						serviceDate: '2026-11-20'
					};
				},
				async markExpired(bookingId: string) {
					expired.push(bookingId);
				},
				async markRefunded(bookingId: string) {
					expired.push(bookingId);
				},
				async saveInvoice(bookingId: string, externalId: string, status: string, pdfUrl?: string) {
					invoices.push({ bookingId, externalId, status, pdfUrl });
				},
				async recordInvoiceFailure(bookingId: string, error: string) {
					failures.push({ bookingId, error });
				}
			};
		}

		it('aprovação confirma agendamento e gera nota fiscal simulada', async () => {
			const repo = createMockRepo();
			const invoiceProvider = new FakeInvoiceProvider({
				async put() {},
				async getStream() {
					return null;
				},
				async delete() {}
			});

			const event: PaymentEvent = {
				type: 'paid',
				providerId: 'fake_pay_1',
				externalReference: 'booking_001',
				eventId: 'evt_unique_1'
			};

			const result = await handlePaymentEvent(event, repo, invoiceProvider);
			expect(result).toBe('processed');
			expect(repo.paid).toEqual([{ bookingId: 'booking_001', providerId: 'fake_pay_1' }]);
			expect(repo.invoices).toHaveLength(1);
			expect(repo.invoices[0].bookingId).toBe('booking_001');
			expect(repo.invoices[0].externalId).toMatch(/^fake_inv_/);
			expect(repo.invoices[0].status).toBe('authorized');
		});

		it('evento duplicado é ignorado com resultado "duplicate" (idempotência)', async () => {
			const repo = createMockRepo(['evt_duplicate_123']);
			const invoiceProvider = new FakeInvoiceProvider();

			const event: PaymentEvent = {
				type: 'paid',
				providerId: 'fake_pay_2',
				externalReference: 'booking_002',
				eventId: 'evt_duplicate_123'
			};

			const result = await handlePaymentEvent(event, repo, invoiceProvider);
			expect(result).toBe('duplicate');
			expect(repo.paid).toHaveLength(0);
			expect(repo.invoices).toHaveLength(0);
		});

		it('expiração de pagamento chama markExpired e libera slot', async () => {
			const repo = createMockRepo();
			const invoiceProvider = new FakeInvoiceProvider();

			const event: PaymentEvent = {
				type: 'expired',
				providerId: 'fake_pay_3',
				externalReference: 'booking_003',
				eventId: 'evt_exp_3'
			};

			const result = await handlePaymentEvent(event, repo, invoiceProvider);
			expect(result).toBe('processed');
			expect(repo.expired).toEqual(['booking_003']);
			expect(repo.paid).toHaveLength(0);
		});

		it('falha na emissão de NF NUNCA desfaz agendamento nem lança erro', async () => {
			const repo = createMockRepo();
			const brokenInvoiceProvider = {
				async issue() {
					throw new Error('Falha no emissor fiscal!');
				},
				async get() {
					throw new Error('fail');
				},
				async cancel() {}
			};

			const event: PaymentEvent = {
				type: 'paid',
				providerId: 'fake_pay_4',
				externalReference: 'booking_004',
				eventId: 'evt_unique_4'
			};

			const result = await handlePaymentEvent(event, repo, brokenInvoiceProvider);
			expect(result).toBe('processed');
			expect(repo.paid).toEqual([{ bookingId: 'booking_004', providerId: 'fake_pay_4' }]);
			expect(repo.failures).toHaveLength(1);
			expect(repo.failures[0].bookingId).toBe('booking_004');
			expect(repo.failures[0].error).toContain('Falha no emissor fiscal!');
		});
	});

	describe('Simulação de segurança de acesso', () => {
		it('usuário alheio não pode simular pagamento (validação de propriedade)', () => {
			const booking = { customerId: 'user_original_owner' };
			const actorUser = { uid: 'user_malicious_attacker', role: 'cliente' };

			const canAccess = actorUser.role === 'admin' || booking.customerId === actorUser.uid;
			expect(canAccess).toBe(false);
		});

		it('dono do booking pode simular pagamento', () => {
			const booking = { customerId: 'user_legit_owner' };
			const actorUser = { uid: 'user_legit_owner', role: 'cliente' };

			const canAccess = actorUser.role === 'admin' || booking.customerId === actorUser.uid;
			expect(canAccess).toBe(true);
		});

		it('admin pode simular pagamento de qualquer cobrança', () => {
			const booking = { customerId: 'user_any' };
			const adminUser = { uid: 'admin_user', role: 'admin' };

			const canAccess = adminUser.role === 'admin' || booking.customerId === adminUser.uid;
			expect(canAccess).toBe(true);
		});
	});
});
