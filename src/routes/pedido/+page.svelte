<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api } from '../../lib/api';
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

	onMount(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		(async () => {
			try {
				order = await api<Order>(`/api/bookings/${id}`);
				status = 'ok';
			} catch {
				status = 'error';
			}
		})();
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
		</dl>
		{#if order.status === 'pending_payment'}
			<p class="notice">
				Reserva por mais <b>{mmss}</b>. O pagamento ainda não está disponível no app.
			</p>
		{:else if order.status === 'canceled'}
			<p class="notice" role="status">Este pedido expirou ou foi cancelado.</p>
		{/if}
		<a class="btn" href="/">Voltar ao início</a>
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
		background: var(--color-notice);
		color: var(--color-primary-dark);
		padding: 10px 14px;
		border-radius: var(--radius);
		font-size: 14px;
	}
	.btn {
		width: 100%;
		margin-top: 8px;
	}
</style>
