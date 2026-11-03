import { describe, expect, it } from 'vitest';
import { AsaasProvider } from './asaas';

const p = new AsaasProvider('k', 'secret');
const body = (event: string) =>
	JSON.stringify({ id: 'evt_1', event, payment: { id: 'pay_1', externalReference: 'booking-1' } });

describe('AsaasProvider.parseWebhook', () => {
	it('rejeita token invalido', () => {
		expect(() => p.parseWebhook(new Headers({ 'asaas-access-token': 'x' }), body('PAYMENT_RECEIVED'))).toThrow();
	});
	it('converte pagamento recebido', () => {
		const e = p.parseWebhook(new Headers({ 'asaas-access-token': 'secret' }), body('PAYMENT_RECEIVED'));
		expect(e).toEqual({ type: 'paid', providerId: 'pay_1', externalReference: 'booking-1', eventId: 'evt_1' });
	});
	it('ignora eventos desconhecidos', () => {
		expect(p.parseWebhook(new Headers({ 'asaas-access-token': 'secret' }), body('PAYMENT_CREATED'))).toEqual({
			type: 'ignored'
		});
	});
});

describe('AsaasProvider.createPixCharge (fetch simulado)', () => {
	it('monta cobranca Pix e le o copia e cola', async () => {
		const calls: string[] = [];
		const fake: typeof fetch = async (url, init) => {
			calls.push(`${init?.method ?? 'GET'} ${String(url).split('/v3')[1]}`);
			const u = String(url);
			const json = u.endsWith('/customers')
				? { id: 'cus_1' }
				: u.endsWith('/payments')
					? { id: 'pay_1' }
					: { payload: '000201...', encodedImage: 'iVBOR', expirationDate: '2026-11-10 12:00:00' };
			return new Response(JSON.stringify(json), { status: 200 });
		};
		const prov = new AsaasProvider('k', 's', 'https://x/v3', fake);
		const r = await prov.createPixCharge({
			customer: { name: 'A', cpfCnpj: '1' },
			valueCents: 15000,
			reference: 'b1',
			description: 'Limpeza',
			expiresInMinutes: 15
		});
		expect(r.pixCopiaECola).toBe('000201...');
		expect(calls).toEqual(['POST /customers', 'POST /payments', 'GET /payments/pay_1/pixQrCode']);
	});
});
