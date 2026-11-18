import { describe, expect, it } from 'vitest';

export function validateReviewInput(input: {
	bookingStatus: string;
	customerId: string;
	actorId: string;
	rating: unknown;
	comment?: unknown;
}): { ok: true; rating: number; comment: string | null } | { ok: false; error: string; code: number } {
	if (input.customerId !== input.actorId) {
		return { ok: false, error: 'forbidden', code: 403 };
	}
	if (input.bookingStatus !== 'completed') {
		return { ok: false, error: 'review allowed only for completed bookings', code: 400 };
	}
	if (typeof input.rating !== 'number' || isNaN(input.rating)) {
		return { ok: false, error: 'rating is required', code: 400 };
	}
	const rounded = Math.round(input.rating);
	if (rounded < 1 || rounded > 5) {
		return { ok: false, error: 'rating must be between 1 and 5', code: 400 };
	}
	let cleanComment: string | null = null;
	if (typeof input.comment === 'string') {
		cleanComment = input.comment.trim().slice(0, 1000) || null;
	}
	return { ok: true, rating: rounded, comment: cleanComment };
}

describe('Avaliação pós-serviço (Reviews)', () => {
	it('permite avaliação de 1 a 5 estrelas para pedido concluído pelo próprio cliente', () => {
		const res = validateReviewInput({
			bookingStatus: 'completed',
			customerId: 'user_123',
			actorId: 'user_123',
			rating: 5,
			comment: 'Excelente limpeza!'
		});
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.rating).toBe(5);
			expect(res.comment).toBe('Excelente limpeza!');
		}
	});

	it('arredonda notas fracionárias válidas', () => {
		const res = validateReviewInput({
			bookingStatus: 'completed',
			customerId: 'user_123',
			actorId: 'user_123',
			rating: 4.2
		});
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.rating).toBe(4);
			expect(res.comment).toBeNull();
		}
	});

	it('rejeita notas menores que 1 ou maiores que 5', () => {
		expect(
			validateReviewInput({
				bookingStatus: 'completed',
				customerId: 'user_123',
				actorId: 'user_123',
				rating: 0
			})
		).toEqual({ ok: false, error: 'rating must be between 1 and 5', code: 400 });

		expect(
			validateReviewInput({
				bookingStatus: 'completed',
				customerId: 'user_123',
				actorId: 'user_123',
				rating: 6
			})
		).toEqual({ ok: false, error: 'rating must be between 1 and 5', code: 400 });
	});

	it('bloqueia avaliação se o status do pedido não for "completed"', () => {
		const statuses = ['pending_payment', 'scheduled', 'awaiting_contact', 'in_progress', 'canceled'];
		for (const st of statuses) {
			const res = validateReviewInput({
				bookingStatus: st,
				customerId: 'user_123',
				actorId: 'user_123',
				rating: 5
			});
			expect(res).toEqual({ ok: false, error: 'review allowed only for completed bookings', code: 400 });
		}
	});

	it('bloqueia avaliação se outro cliente tentar avaliar o pedido', () => {
		const res = validateReviewInput({
			bookingStatus: 'completed',
			customerId: 'user_123',
			actorId: 'user_456',
			rating: 5
		});
		expect(res).toEqual({ ok: false, error: 'forbidden', code: 403 });
	});

	it('limita comentário a no máximo 1000 caracteres e remove espaços extras', () => {
		const longText = 'a'.repeat(1200);
		const res = validateReviewInput({
			bookingStatus: 'completed',
			customerId: 'user_123',
			actorId: 'user_123',
			rating: 5,
			comment: `  ${longText}  `
		});
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.comment?.length).toBe(1000);
		}
	});
});
