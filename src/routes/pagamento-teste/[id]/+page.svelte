<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, ApiError, getAuthUser } from '../../../lib/api';
	import { formatBRL } from '../../../lib/ui/dates';

	interface PaymentInfo {
		providerId: string;
		bookingId: string;
		serviceType: 'cleaning' | 'laundry' | 'inspection';
		priceCents: number;
		method: 'pix' | 'link';
		status: string;
		pixCopiaECola: string | null;
		paymentLink: string | null;
		holdExpiresAt: string | null;
	}

	const names = {
		cleaning: 'Limpeza',
		laundry: 'Lavanderia',
		inspection: 'Vistoria de check-in'
	};

	const id = $derived(page.params.id);

	let loading = $state(true);
	let errorMsg = $state('');
	let info = $state<PaymentInfo | null>(null);
	let simulating = $state(false);
	let feedback = $state<{ type: 'success' | 'warn' | 'error'; message: string } | null>(null);
	let copied = $state(false);

	async function load() {
		loading = true;
		errorMsg = '';
		try {
			await getAuthUser();
			info = await api<PaymentInfo>(`/api/test/payments/${id}`);
		} catch (err) {
			if (err instanceof ApiError && err.status === 404) {
				errorMsg = 'Página de simulação não encontrada ou desativada neste ambiente.';
			} else if (err instanceof ApiError && err.status === 403) {
				errorMsg = 'Você não tem permissão para acessar esta cobrança de teste.';
			} else if (err instanceof ApiError && err.status === 401) {
				errorMsg = 'Faça login com a conta dona do pedido para acessar esta simulação.';
			} else {
				errorMsg = 'Não foi possível carregar os dados do pagamento simulado.';
			}
		} finally {
			loading = false;
		}
	}

	async function simulate(action: 'paid' | 'expired') {
		if (simulating) return;
		simulating = true;
		feedback = null;
		try {
			const res = await api<{ result: string; action: string }>(`/api/test/payments/${id}`, {
				method: 'POST',
				body: JSON.stringify({ action })
			});

			if (action === 'paid') {
				if (res.result === 'needs_refund') {
					feedback = {
						type: 'warn',
						message: 'O pagamento foi simulado, mas a vaga expirou e foi ocupada (marcado como needsRefund).'
					};
				} else {
					feedback = {
						type: 'success',
						message: 'Pagamento simulado com SUCESSO! Agendamento confirmado e nota fiscal emitida.'
					};
				}
			} else {
				feedback = {
					type: 'warn',
					message: 'Pagamento expirado simulado. O agendamento foi cancelado e a vaga liberada.'
				};
			}
			await load();
		} catch (err) {
			feedback = {
				type: 'error',
				message: err instanceof Error ? err.message : 'Falha ao executar a simulação de pagamento.'
			};
		} finally {
			simulating = false;
		}
	}

	async function copyPix() {
		if (!info?.pixCopiaECola) return;
		try {
			await navigator.clipboard.writeText(info.pixCopiaECola);
			copied = true;
			setTimeout(() => (copied = false), 2500);
		} catch {
			// fallback
		}
	}

	onMount(load);
</script>

<svelte:head>
	<title>Simulação de Pagamento (Ambiente de Testes) - Jolog</title>
</svelte:head>

<section class="test-payment">
	<div class="test-badge">
		<span class="dot"></span>
		Ambiente de Testes (Fake Payments)
	</div>

	<h1>Simulação de Pagamento</h1>

	{#if loading}
		<div class="card status-card">
			<p>Carregando dados da cobrança…</p>
		</div>
	{:else if errorMsg}
		<div class="card error-card">
			<p role="alert">{errorMsg}</p>
			<a class="btn btn-secondary" href="/">Voltar ao início</a>
		</div>
	{:else if info}
		<div class="card">
			<div class="service-header">
				<span class="label">Serviço</span>
				<h2>{names[info.serviceType] ?? info.serviceType}</h2>
				<span class="price">{formatBRL(info.priceCents)}</span>
			</div>

			<dl class="details-list">
				<dt>ID da Cobrança</dt>
				<dd><code>{info.providerId}</code></dd>

				<dt>ID do Pedido</dt>
				<dd><code>{info.bookingId}</code></dd>

				<dt>Método</dt>
				<dd>{info.method === 'pix' ? 'Pix' : 'Link de pagamento'}</dd>

				<dt>Status Atual</dt>
				<dd>
					<span class="status-pill status-{info.status}">
						{info.status === 'paid' ? 'Pago' : info.status === 'pending' ? 'Pendente' : info.status}
					</span>
				</dd>
			</dl>

			{#if info.pixCopiaECola}
				<div class="pix-box">
					<label for="fake-pix">Pix Copia e Cola (Falso):</label>
					<div class="copy-row">
						<input id="fake-pix" type="text" readonly value={info.pixCopiaECola} />
						<button type="button" class="btn btn-copy" onclick={copyPix}>
							{copied ? 'Copiado!' : 'Copiar'}
						</button>
					</div>
				</div>
			{/if}

			{#if feedback}
				<div class="alert alert-{feedback.type}" role="status">
					{feedback.message}
				</div>
			{/if}

			<div class="actions">
				<button type="button" class="btn btn-pay" disabled={simulating} onclick={() => simulate('paid')}>
					{simulating ? 'Processando…' : 'Simular pagamento aprovado'}
				</button>

				<button type="button" class="btn btn-expire" disabled={simulating} onclick={() => simulate('expired')}>
					{simulating ? 'Processando…' : 'Simular pagamento expirado'}
				</button>
			</div>

			<div class="links">
				<a class="link" href="/pedido?id={info.bookingId}">Ver resumo do pedido</a>
				<a class="link" href="/pedidos">Ver todos os pedidos</a>
			</div>
		</div>
	{/if}
</section>

<style>
	.test-payment {
		max-width: 520px;
		margin: 0 auto;
	}

	.test-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: #fff3cd;
		color: #856404;
		border: 1px solid #ffeeba;
		padding: 4px 12px;
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 12px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #856404;
	}

	h1 {
		color: var(--color-primary);
		font-size: 1.5rem;
		margin: 0 0 16px;
	}

	.card {
		background: var(--color-surface);
		border-radius: var(--radius-md);
		padding: 20px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}

	.service-header {
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 14px;
		margin-bottom: 16px;
	}

	.service-header .label {
		font-size: 0.8rem;
		text-transform: uppercase;
		color: var(--color-muted);
		font-weight: 600;
	}

	.service-header h2 {
		margin: 4px 0;
		font-size: 1.25rem;
		color: #222;
	}

	.service-header .price {
		font-size: 1.35rem;
		font-weight: 800;
		color: var(--color-primary);
	}

	.details-list {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 12px;
		margin: 0 0 16px;
		font-size: 0.9rem;
	}

	.details-list dt {
		color: var(--color-muted);
	}

	.details-list dd {
		margin: 0;
		font-weight: 600;
		word-break: break-all;
	}

	.status-pill {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 0.8rem;
		text-transform: uppercase;
		font-weight: 700;
	}

	.status-pending {
		background: #fff3cd;
		color: #856404;
	}

	.status-paid {
		background: #d4edda;
		color: #155724;
	}

	.pix-box {
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 12px;
		margin-bottom: 16px;
	}

	.pix-box label {
		display: block;
		font-size: 0.8rem;
		color: var(--color-muted);
		font-weight: 600;
		margin-bottom: 6px;
	}

	.copy-row {
		display: flex;
		gap: 8px;
	}

	.copy-row input {
		flex: 1;
		font-size: 0.82rem;
		padding: 8px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: #fdfdfd;
		font-family: monospace;
	}

	.alert {
		padding: 12px 14px;
		border-radius: var(--radius-sm);
		margin-bottom: 16px;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.alert-success {
		background: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.alert-warn {
		background: #fff3cd;
		color: #856404;
		border: 1px solid #ffeeba;
	}

	.alert-error {
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 16px;
	}

	.btn {
		display: block;
		width: 100%;
		border: none;
		border-radius: var(--radius-sm);
		padding: 12px;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		text-align: center;
		text-decoration: none;
		transition: opacity 0.2s;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-pay {
		background: linear-gradient(135deg, #28a745, #218838);
		color: white;
	}

	.btn-expire {
		background: #e9ecef;
		color: #495057;
		border: 1px solid #ced4da;
	}

	.btn-copy {
		width: auto;
		background: var(--color-primary);
		color: white;
		padding: 8px 14px;
		font-size: 0.85rem;
	}

	.btn-secondary {
		background: var(--color-primary);
		color: white;
	}

	.links {
		display: flex;
		justify-content: space-between;
		font-size: 0.88rem;
		border-top: 1px solid var(--color-border);
		padding-top: 14px;
	}

	.link {
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
	}

	.link:hover {
		text-decoration: underline;
	}
</style>
