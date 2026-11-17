<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, getAuthUser } from '../../lib/api';
	import { formatBRL, timeLabel } from '../../lib/ui/dates';

	interface Order {
		serviceType: 'cleaning' | 'laundry' | 'inspection';
		status: string;
		startsAt: string | null;
		priceCents: number;
		holdExpiresAt: string | null;
		laundry: { cycles: number; desiredDate: string } | null;
	}
	const names = { cleaning: 'Limpeza', laundry: 'Lavanderia', inspection: 'Vistoria de check-in' };
	const id = $derived(page.url.searchParams.get('id') ?? '');
	let order = $state<Order | null>(null);
	let status = $state<'loading' | 'error' | 'ok'>('loading');
	let now = $state(Date.now());
	let paying = $state(false);
	let payError = $state('');

	async function loadOrder() {
		try {
			await getAuthUser();
			order = await api<Order>(`/api/bookings/${id}`);
			status = 'ok';
		} catch {
			status = 'error';
		}
	}

	onMount(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		loadOrder();
		return () => clearInterval(t);
	});

	const left = $derived(order?.holdExpiresAt ? Math.max(0, new Date(order.holdExpiresAt).getTime() - now) : 0);
	const mmss = $derived(
		`${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`
	);
	const dateText = (iso: string) => {
		const d = new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString();
		return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} às ${timeLabel(iso)}`;
	};

	async function goToPayment() {
		if (paying) return;
		paying = true;
		payError = '';
		try {
			const res = await api<{ id: string; paymentLink?: string; pixCopiaECola?: string }>(
				`/api/bookings/${id}/payment`,
				{
					method: 'POST',
					body: JSON.stringify({ method: 'link' })
				}
			);
			if (res.paymentLink) {
				window.location.href = res.paymentLink;
			} else {
				payError = 'Link de pagamento não gerado.';
			}
		} catch (e) {
			let msg = 'Não foi possível gerar o link de pagamento. Tente novamente.';
			if (e instanceof Error) {
				try {
					const parsed = JSON.parse(e.message);
					if (parsed?.message) msg = parsed.message;
				} catch {
					msg = e.message;
				}
			}
			payError = msg;
		} finally {
			paying = false;
		}
	}
</script>

<section>
	<a class="back" href="/pedidos">← Pedidos</a>
	<h1>Pedido criado</h1>
	{#if status === 'loading'}
		<p role="status">Carregando…</p>
	{:else if status === 'error' || !order}
		<p class="notice" role="alert">Não foi possível carregar este pedido.</p>
	{:else}
		<dl class="sum">
			<dt>Serviço</dt>
			<dd>{names[order.serviceType]}</dd>
			{#if order.startsAt}
				<dt>Data</dt>
				<dd>{dateText(order.startsAt)}</dd>
			{/if}
			{#if order.laundry}
				<dt>Ciclos</dt>
				<dd>{order.laundry.cycles}</dd>
				<dt>Dia desejado</dt>
				<dd>{order.laundry.desiredDate.split('-').reverse().join('/')}</dd>
			{/if}
			<dt>Total</dt>
			<dd>{formatBRL(order.priceCents)}</dd>
			<dt>Status</dt>
			<dd>
				{order.status === 'scheduled' || order.status === 'awaiting_contact'
					? 'Confirmado (Pago)'
					: order.status === 'pending_payment'
						? 'Aguardando pagamento'
						: order.status === 'canceled'
							? 'Cancelado'
							: order.status}
			</dd>
		</dl>
		{#if order.status === 'pending_payment'}
			<p class="notice">
				Reserva garantida por mais <b>{mmss}</b>.
			</p>
			{#if payError}
				<p class="notice error">{payError}</p>
			{/if}
			<button class="btn btn-pay" onclick={goToPayment} disabled={paying}>
				{paying ? 'Carregando…' : 'Ir para o Pagamento'}
			</button>
		{:else if order.status === 'scheduled' || order.status === 'awaiting_contact'}
			<p class="notice success">Pagamento aprovado e agendamento confirmado!</p>
		{:else if order.status === 'canceled'}
			<p class="notice" role="status">Este pedido expirou ou foi cancelado.</p>
		{/if}
		<a class="btn btn-secondary" href="/">Voltar ao início</a>
	{/if}
</section>

<style>
	.back {
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
		display: inline-block;
		margin-bottom: 8px;
	}
	.sum {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 14px;
		margin: 16px 0;
	}
	.sum dt {
		color: var(--color-muted);
	}
	.sum dd {
		margin: 0;
		font-weight: 600;
	}
	.notice {
		background: #f4f4f6;
		padding: 12px;
		border-radius: 8px;
		font-size: 0.95rem;
		margin: 14px 0;
	}
	.notice.success {
		background: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}
	.notice.error {
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}
	.btn {
		display: block;
		width: 100%;
		border: none;
		border-radius: var(--radius-sm);
		padding: 12px;
		font-weight: 700;
		text-align: center;
		text-decoration: none;
		font-size: 1rem;
		cursor: pointer;
		margin-top: 10px;
	}
	.btn-pay {
		background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
		color: white;
	}
	.btn-pay:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.btn-secondary {
		background: #e5e5ea;
		color: var(--color-text);
	}
</style>
