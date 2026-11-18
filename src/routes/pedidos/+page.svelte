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
		property?: {
			condominium?: string | null;
			block?: string | null;
			apartment?: string | null;
			address?: string;
		} | null;
	}

	const names: Record<string, string> = {
		cleaning: 'Limpeza Residencial',
		laundry: 'Lavanderia por Kilo',
		inspection: 'Vistoria de Check-in'
	};

	const statuses: Record<string, { label: string; badgeClass: string; actionHint: string }> = {
		pending_payment: {
			label: 'Aguardando pagamento',
			badgeClass: 'badge-pending',
			actionHint: 'Pagar agora →'
		},
		scheduled: {
			label: 'Agendado',
			badgeClass: 'badge-ok',
			actionHint: 'Ver detalhes →'
		},
		awaiting_contact: {
			label: 'Aguardando contato',
			badgeClass: 'badge-info',
			actionHint: 'Ver detalhes →'
		},
		in_progress: {
			label: 'Em andamento',
			badgeClass: 'badge-progress',
			actionHint: 'Acompanhar →'
		},
		completed: {
			label: 'Concluído',
			badgeClass: 'badge-ok',
			actionHint: 'Fotos, NF & Avaliação →'
		},
		canceled: {
			label: 'Cancelado',
			badgeClass: 'badge-cancel',
			actionHint: 'Ver detalhes →'
		},
		refunded: {
			label: 'Reembolsado',
			badgeClass: 'badge-cancel',
			actionHint: 'Ver detalhes →'
		}
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

<svelte:head><title>Meus Pedidos · Jolog</title></svelte:head>

<section class="pedidos">
	<div class="pedidos-header">
		<h1>Meus pedidos</h1>
		{#if orders.length > 0}
			<a class="btn-new" href="/">
				<svg
					viewBox="0 0 24 24"
					width="16"
					height="16"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				<span>Novo</span>
			</a>
		{/if}
	</div>

	{#if loading}
		<div class="skeleton-list">
			<div class="skeleton-card"></div>
			<div class="skeleton-card"></div>
			<div class="skeleton-card"></div>
		</div>
	{:else if error}
		<div class="notice error" role="alert">
			<p>{error}</p>
			<button type="button" class="btn-retry" onclick={loadOrders}>Tentar novamente</button>
		</div>
	{:else if orders.length === 0}
		<div class="empty-state">
			<div class="empty-icon">
				<svg
					viewBox="0 0 24 24"
					width="48"
					height="48"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zm2 5h8m-8 4h8" />
				</svg>
			</div>
			<h2>Nenhum pedido encontrado</h2>
			<p>Você ainda não realizou nenhum agendamento de limpeza, lavanderia ou vistoria.</p>
			<a class="btn btn-primary" href="/">Agendar serviço agora</a>
		</div>
	{:else}
		<div class="order-list">
			{#each orders as o (o.id)}
				{@const st = statuses[o.status] ?? { label: o.status, badgeClass: '', actionHint: 'Ver detalhes →' }}
				<a class="order-card" href="/pedido?id={o.id}">
					<div class="order-head">
						<div class="head-left">
							<strong>{names[o.serviceType] ?? o.serviceType}</strong>
							<span class="order-hash">#{o.id.slice(-6).toUpperCase()}</span>
						</div>
						<span class="badge {st.badgeClass}">{st.label}</span>
					</div>

					<div class="order-mid">
						{#if o.property}
							<div class="prop-info">
								<svg
									viewBox="0 0 24 24"
									width="14"
									height="14"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
									<polyline points="9 22 9 12 15 12 15 22" />
								</svg>
								<span>
									{#if o.property.condominium}<b>{o.property.condominium}</b>{/if}
									{#if o.property.block || o.property.apartment}
										· {#if o.property.block}Bl {o.property.block}
										{/if}
										{#if o.property.apartment}Apt {o.property.apartment}{/if}
									{/if}
								</span>
							</div>
						{/if}

						<div class="schedule-info">
							{#if o.startsAt}
								<span class="date-row">
									<svg
										viewBox="0 0 24 24"
										width="14"
										height="14"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
										<line x1="16" y1="2" x2="16" y2="6" />
										<line x1="8" y1="2" x2="8" y2="6" />
										<line x1="3" y1="10" x2="21" y2="10" />
									</svg>
									<b>{dateText(o.startsAt)}</b>
								</span>
							{:else if o.laundry}
								<span class="date-row">
									<svg
										viewBox="0 0 24 24"
										width="14"
										height="14"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<circle cx="12" cy="12" r="9" />
										<path d="M12 6v6l4 2" />
									</svg>
									Data desejada: <b>{o.laundry.desiredDate.split('-').reverse().join('/')}</b> ({o.laundry.cycles}
									{o.laundry.cycles === 1 ? 'ciclo' : 'ciclos'})
								</span>
							{/if}
						</div>
					</div>

					<div class="order-footer">
						<span class="price">{formatBRL(o.priceCents)}</span>
						<span class="action-hint">{st.actionHint}</span>
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

	.pedidos-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	h1 {
		font-size: 1.45rem;
		margin: 0;
		color: var(--color-text);
		font-weight: 700;
	}

	.btn-new {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: var(--color-primary);
		color: white;
		padding: 6px 12px;
		border-radius: 999px;
		text-decoration: none;
		font-size: 0.82rem;
		font-weight: 700;
		transition: opacity 0.15s ease;
	}
	.btn-new:hover {
		opacity: 0.9;
	}

	.skeleton-list {
		display: grid;
		gap: 12px;
	}
	.skeleton-card {
		height: 104px;
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
	.empty-icon {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: rgba(173, 13, 60, 0.06);
		color: var(--color-primary);
		display: grid;
		place-items: center;
	}
	.empty-state h2 {
		font-size: 1.2rem;
		color: var(--color-text);
		margin: 4px 0 0;
	}
	.empty-state p {
		margin: 0 0 12px;
		font-size: 0.92rem;
		max-width: 320px;
		line-height: 1.4;
	}

	.order-list {
		display: grid;
		gap: 12px;
	}
	.order-card {
		display: grid;
		gap: 10px;
		padding: 16px;
		border-radius: var(--radius);
		background: var(--color-surface);
		border: 1.5px solid var(--color-border);
		color: inherit;
		text-decoration: none;
		transition:
			transform 0.12s ease,
			box-shadow 0.12s ease,
			border-color 0.12s ease;
	}
	.order-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
		border-color: #d1d5db;
	}

	.order-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.head-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.head-left strong {
		font-size: 1.05rem;
		color: var(--color-text);
	}
	.order-hash {
		font-size: 0.75rem;
		color: var(--color-muted);
		font-weight: 600;
	}

	.badge {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 999px;
		background: var(--color-border);
		color: var(--color-muted);
	}
	.badge.badge-ok {
		background: rgba(31, 157, 85, 0.12);
		color: #0e6b36;
	}
	.badge.badge-pending {
		background: rgba(234, 179, 8, 0.15);
		color: #854d0e;
	}
	.badge.badge-progress {
		background: rgba(249, 115, 22, 0.15);
		color: #9a3412;
	}
	.badge.badge-info {
		background: rgba(14, 165, 233, 0.12);
		color: #0369a1;
	}
	.badge.badge-cancel {
		background: rgba(239, 68, 68, 0.12);
		color: #991b1b;
	}

	.order-mid {
		display: grid;
		gap: 6px;
		font-size: 0.88rem;
		color: var(--color-muted);
	}
	.prop-info,
	.date-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.prop-info svg,
	.date-row svg {
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.order-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 8px;
		border-top: 1px solid rgba(0, 0, 0, 0.05);
	}
	.price {
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--color-primary);
	}
	.action-hint {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-sm);
		padding: 12px 20px;
		font-weight: 700;
		text-align: center;
		text-decoration: none;
		font-size: 0.95rem;
		cursor: pointer;
		font-family: inherit;
		transition: opacity 0.15s ease;
	}
	.btn:hover {
		opacity: 0.92;
	}
	.btn-primary {
		background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
		color: white;
	}

	.notice {
		padding: 14px;
		border-radius: var(--radius);
		font-size: 14px;
	}
	.notice.error {
		background: #fde8e8;
		color: #9b1c1c;
		border: 1px solid #f8b4b4;
	}
	.btn-retry {
		background: #9b1c1c;
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		padding: 6px 14px;
		font-weight: 700;
		font-family: inherit;
		margin-top: 8px;
		cursor: pointer;
	}

	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}
</style>
