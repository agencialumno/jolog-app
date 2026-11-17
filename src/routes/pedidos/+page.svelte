<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '../../lib/api';
	import { formatBRL, timeLabel } from '../../lib/ui/dates';

	interface Order {
		id: string;
		serviceType: 'cleaning' | 'laundry' | 'inspection';
		status: string;
		startsAt: string | null;
		priceCents: number;
		createdAt?: string;
		laundry?: { cycles: number; desiredDate: string };
	}
	const names: Record<string, string> = {
		cleaning: 'Limpeza',
		laundry: 'Lavanderia',
		inspection: 'Vistoria de check-in'
	};
	const statuses: Record<string, { label: string; ok?: boolean; cancel?: boolean }> = {
		pending_payment: { label: 'Aguardando pagamento' },
		scheduled: { label: 'Agendado', ok: true },
		awaiting_contact: { label: 'Aguardando contato' },
		in_progress: { label: 'Em andamento', ok: true },
		completed: { label: 'Concluído', ok: true },
		canceled: { label: 'Cancelado', cancel: true },
		refunded: { label: 'Reembolsado', cancel: true }
	};
	let orders = $state<Order[]>([]);
	let loading = $state(true);
	let error = $state('');

	async function loadOrders() {
		loading = true;
		error = '';
		try {
			orders = await api<Order[]>('/api/bookings');
		} catch {
			error = 'Não foi possível carregar seus pedidos no momento.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void loadOrders();
	});

	const dateText = (iso: string) => {
		const d = new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString();
		return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} às ${timeLabel(iso)}`;
	};
</script>

<svelte:head><title>Pedidos · Jolog</title></svelte:head>

<section class="pedidos">
	<h1>Meus pedidos</h1>

	{#if loading}
		<div class="skeleton-list">
			<div class="skeleton-card"></div>
			<div class="skeleton-card"></div>
		</div>
	{:else if error}
		<div class="notice" role="alert">
			<p>{error}</p>
			<button type="button" class="btn-retry" onclick={loadOrders}>Tentar novamente</button>
		</div>
	{:else if orders.length === 0}
		<div class="empty-state">
			<svg
				viewBox="0 0 24 24"
				width="44"
				height="44"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zm2 5h8m-8 4h8" />
			</svg>
			<h2>Nenhum pedido</h2>
			<p>Você ainda não realizou nenhum agendamento.</p>
			<a class="btn" href="/">Novo agendamento</a>
		</div>
	{:else}
		<div class="order-list">
			{#each orders as o (o.id)}
				{@const st = statuses[o.status] ?? { label: o.status }}
				<a class="order-card" href="/pedido?id={o.id}">
					<div class="order-head">
						<strong>{names[o.serviceType] ?? o.serviceType}</strong>
						<span class="badge" class:ok={st.ok} class:cancel={st.cancel}>{st.label}</span>
					</div>
					<div class="order-body">
						{#if o.startsAt}
							<span>Data: <b>{dateText(o.startsAt)}</b></span>
						{:else if o.laundry}
							<span
								>Dia desejado: <b>{o.laundry.desiredDate.split('-').reverse().join('/')}</b> ({o.laundry.cycles}
								{o.laundry.cycles === 1 ? 'ciclo' : 'ciclos'})</span
							>
						{/if}
						<span class="price">{formatBRL(o.priceCents)}</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</section>

<style>
	.pedidos {
		display: grid;
		gap: 16px;
	}
	h1 {
		font-size: 1.5rem;
	}
	.skeleton-list {
		display: grid;
		gap: 12px;
	}
	.skeleton-card {
		height: 96px;
		background: var(--color-surface);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius);
		animation: pulse 1.2s ease-in-out infinite;
	}
	.empty-state {
		text-align: center;
		padding: 40px 16px;
		color: var(--color-muted);
		display: grid;
		place-items: center;
		gap: 10px;
	}
	.empty-state svg {
		color: var(--color-muted);
		opacity: 0.6;
	}
	.empty-state h2 {
		font-size: 1.2rem;
		color: var(--color-text);
		margin: 0;
	}
	.empty-state p {
		margin: 0 0 12px;
		font-size: 0.95rem;
	}
	.order-list {
		display: grid;
		gap: 12px;
	}
	.order-card {
		display: grid;
		gap: 8px;
		padding: 16px;
		border-radius: var(--radius);
		background: var(--color-surface);
		border: 1.5px solid var(--color-border);
		color: inherit;
		text-decoration: none;
		transition:
			transform 0.12s ease,
			box-shadow 0.12s ease;
	}
	.order-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
	}
	.order-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.badge {
		font-size: 11px;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 999px;
		background: var(--color-border);
		color: var(--color-muted);
	}
	.badge.ok {
		background: rgba(31, 157, 85, 0.12);
		color: var(--color-ok);
	}
	.badge.cancel {
		background: var(--color-notice);
		color: var(--color-primary-dark);
	}
	.order-body {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		font-size: 13px;
		color: var(--color-muted);
	}
	.price {
		font-size: 15px;
		font-weight: 700;
		color: var(--color-primary);
	}
	.notice {
		background: var(--color-notice);
		color: var(--color-primary-dark);
		padding: 14px;
		border-radius: var(--radius);
		font-size: 14px;
	}
	.notice p {
		margin: 0 0 10px;
	}
	.btn-retry {
		min-height: 38px;
		font-size: 14px;
	}
	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}
</style>
