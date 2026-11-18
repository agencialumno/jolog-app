<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, getAuthUser, photoObjectUrl, downloadInvoiceBlob } from '../../lib/api';
	import { formatBRL, timeLabel } from '../../lib/ui/dates';

	interface Order {
		id?: string;
		serviceType: 'cleaning' | 'laundry' | 'inspection';
		status: string;
		startsAt: string | null;
		priceCents: number;
		holdExpiresAt: string | null;
		laundry: { cycles: number; desiredDate: string } | null;
		property?: {
			condominium?: string | null;
			block?: string | null;
			apartment?: string | null;
			street?: string | null;
			number?: string | null;
			address?: string;
			bedrooms?: number;
		} | null;
	}

	interface PhotoItem {
		id: string;
		kind: 'before' | 'after';
		createdAt: string;
		url?: string;
	}

	interface ReviewDoc {
		rating: number;
		comment: string;
		createdAt: string | null;
	}

	const names: Record<string, string> = {
		cleaning: 'Limpeza Residencial',
		laundry: 'Lavanderia por Kilo',
		inspection: 'Vistoria de Check-in'
	};

	const statuses: Record<string, { label: string; badgeClass: string; desc: string }> = {
		pending_payment: {
			label: 'Aguardando pagamento',
			badgeClass: 'badge-pending',
			desc: 'Aguardando confirmação do pagamento para garantir sua reserva.'
		},
		scheduled: {
			label: 'Agendado',
			badgeClass: 'badge-ok',
			desc: 'Pagamento aprovado! Nossa equipe comparecerá no dia e horário marcados.'
		},
		awaiting_contact: {
			label: 'Aguardando contato',
			badgeClass: 'badge-info',
			desc: 'Recebemos seu pedido. Nossa equipe entrará em contato para alinhar os detalhes da coleta.'
		},
		in_progress: {
			label: 'Em andamento',
			badgeClass: 'badge-progress',
			desc: 'Serviço em execução neste momento pela equipe Jolog.'
		},
		completed: {
			label: 'Concluído',
			badgeClass: 'badge-ok',
			desc: 'Serviço finalizado com sucesso! Veja as fotos e avalie nosso trabalho.'
		},
		canceled: {
			label: 'Cancelado',
			badgeClass: 'badge-cancel',
			desc: 'Este agendamento foi cancelado ou a reserva expirou.'
		},
		refunded: {
			label: 'Reembolsado',
			badgeClass: 'badge-cancel',
			desc: 'O valor deste serviço foi estornado.'
		}
	};

	const ratingLabels = [
		'',
		'1 estrela - Muito insatisfeito',
		'2 estrelas - Insatisfeito',
		'3 estrelas - Razoável',
		'4 estrelas - Bom atendimento',
		'5 estrelas - Excelente serviço!'
	];

	const id = $derived(page.url.searchParams.get('id') ?? '');
	let order = $state<Order | null>(null);
	let loadState = $state<'loading' | 'error' | 'ok'>('loading');
	let now = $state(Date.now());
	let paying = $state(false);
	let payError = $state('');

	// Fotos
	let photos = $state<PhotoItem[]>([]);
	let photosLoading = $state(false);
	let photoFilter = $state<'all' | 'before' | 'after'>('all');
	let selectedPhoto = $state<PhotoItem | null>(null);

	// Avaliacao
	let review = $state<ReviewDoc | null>(null);
	let ratingInput = $state(5);
	let hoverRating = $state(0);
	let commentInput = $state('');
	let savingReview = $state(false);
	let reviewSuccess = $state(false);
	let reviewError = $state('');

	// Nota Fiscal
	let downloadingInvoice = $state(false);
	let invoiceFeedback = $state('');
	let invoiceFeedbackType = $state<'info' | 'error' | 'success'>('info');

	async function loadOrder() {
		try {
			loadState = 'loading';
			await getAuthUser();
			order = await api<Order>(`/api/bookings/${id}`);
			loadState = 'ok';

			if (order.status === 'in_progress' || order.status === 'completed') {
				void loadPhotos();
			}
			if (order.status === 'completed') {
				void loadReview();
			}
		} catch {
			loadState = 'error';
		}
	}

	async function loadPhotos() {
		photosLoading = true;
		try {
			const list = await api<PhotoItem[]>(`/api/bookings/${id}/photos`);
			const withUrls = await Promise.all(
				list.map(async (p) => {
					try {
						const url = await photoObjectUrl(id, p.id);
						return { ...p, url };
					} catch {
						return p;
					}
				})
			);
			photos = withUrls;
		} catch {
			// Sem fotos ainda
		} finally {
			photosLoading = false;
		}
	}

	async function loadReview() {
		try {
			const r = await api<ReviewDoc | null>(`/api/bookings/${id}/review`);
			if (r) {
				review = r;
				ratingInput = r.rating;
				commentInput = r.comment || '';
			}
		} catch {
			// Sem avaliacao ainda
		}
	}

	async function submitReview() {
		if (savingReview) return;
		savingReview = true;
		reviewError = '';
		try {
			const res = await api<ReviewDoc>(`/api/bookings/${id}/review`, {
				method: 'POST',
				body: JSON.stringify({ rating: ratingInput, comment: commentInput })
			});
			review = res;
			reviewSuccess = true;
		} catch (e) {
			reviewError = e instanceof Error ? e.message : 'Não foi possível salvar sua avaliação. Tente novamente.';
		} finally {
			savingReview = false;
		}
	}

	async function handleDownloadInvoice() {
		if (downloadingInvoice) return;
		downloadingInvoice = true;
		invoiceFeedback = '';
		try {
			const res = await downloadInvoiceBlob(id);
			if (res.status === 'processing') {
				invoiceFeedbackType = 'info';
				invoiceFeedback = 'A nota fiscal está sendo gerada pela prefeitura. Tente novamente em alguns minutos.';
			} else if (res.status === 'ready' && res.blob) {
				const blobUrl = URL.createObjectURL(res.blob);
				const a = document.createElement('a');
				a.href = blobUrl;
				a.download = `nota-fiscal-${id.slice(0, 8)}.pdf`;
				document.body.appendChild(a);
				a.click();
				a.remove();
				setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
				invoiceFeedbackType = 'success';
				invoiceFeedback = 'Download iniciado com sucesso!';
			}
		} catch {
			invoiceFeedbackType = 'error';
			invoiceFeedback = 'Nota fiscal ainda não disponível para download no momento.';
		} finally {
			downloadingInvoice = false;
		}
	}

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

	onMount(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		void loadOrder();
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

	const filteredPhotos = $derived(photoFilter === 'all' ? photos : photos.filter((p) => p.kind === photoFilter));

	const currentRating = $derived(hoverRating > 0 ? hoverRating : ratingInput);
</script>

<svelte:head><title>Detalhes do Pedido · Jolog</title></svelte:head>

<section class="order-detail">
	<div class="nav-back">
		<a class="back-link" href="/pedidos">
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M19 12H5M12 19l-7-7 7-7" />
			</svg>
			<span>Meus pedidos</span>
		</a>
	</div>

	{#if loadState === 'loading'}
		<div class="skeleton-wrapper" aria-busy="true">
			<div class="skeleton-line" style="width: 60%; height: 28px;"></div>
			<div class="skeleton-card" style="height: 140px;"></div>
			<div class="skeleton-card" style="height: 180px;"></div>
		</div>
	{:else if loadState === 'error' || !order}
		<div class="notice error" role="alert">
			<p>Não foi possível carregar as informações deste pedido.</p>
			<button type="button" class="btn btn-secondary" onclick={loadOrder}>Tentar novamente</button>
		</div>
	{:else}
		{@const currentStatus = statuses[order.status] ?? { label: order.status, badgeClass: '', desc: '' }}

		<header class="detail-header">
			<div class="title-row">
				<h1>{names[order.serviceType] ?? order.serviceType}</h1>
				<span class="badge {currentStatus.badgeClass}">{currentStatus.label}</span>
			</div>
			<p class="order-id">Código do pedido: <b>#{id.slice(-6).toUpperCase()}</b></p>
		</header>

		<!-- Status banner -->
		<div class="status-banner {currentStatus.badgeClass}">
			<div class="status-icon">
				{#if order.status === 'completed'}
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M20 6L9 17l-5-5" />
					</svg>
				{:else if order.status === 'in_progress'}
					<span class="pulsing-dot"></span>
				{:else if order.status === 'pending_payment'}
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
					</svg>
				{:else}
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
					</svg>
				{/if}
			</div>
			<div class="status-text">
				<strong>{currentStatus.label}</strong>
				<p>{currentStatus.desc}</p>
			</div>
		</div>

		<!-- Ações de Pagamento -->
		{#if order.status === 'pending_payment'}
			<div class="payment-box">
				<div class="timer-row">
					<span class="timer-label">Tempo restante para pagamento:</span>
					<span class="timer-clock">{mmss}</span>
				</div>
				{#if payError}
					<p class="notice error">{payError}</p>
				{/if}
				<button class="btn btn-primary" onclick={goToPayment} disabled={paying}>
					{paying ? 'Preparando pagamento…' : 'Ir para o Pagamento'}
				</button>
			</div>
		{/if}

		<!-- Card de resumo do agendamento -->
		<div class="info-card">
			<h2>Resumo do agendamento</h2>
			<dl class="info-grid">
				<dt>Serviço</dt>
				<dd>{names[order.serviceType] ?? order.serviceType}</dd>

				{#if order.startsAt}
					<dt>Data e Horário</dt>
					<dd><b>{dateText(order.startsAt)}</b></dd>
				{/if}

				{#if order.laundry}
					<dt>Ciclos</dt>
					<dd>{order.laundry.cycles} {order.laundry.cycles === 1 ? 'ciclo' : 'ciclos'}</dd>
					<dt>Data desejada</dt>
					<dd><b>{order.laundry.desiredDate.split('-').reverse().join('/')}</b></dd>
				{/if}

				{#if order.property}
					<dt>Imóvel</dt>
					<dd>
						{#if order.property.condominium}
							<strong>{order.property.condominium}</strong><br />
						{/if}
						{#if order.property.block || order.property.apartment}
							<span>
								{#if order.property.block}Bloco {order.property.block}{/if}
								{#if order.property.block && order.property.apartment}
									·
								{/if}
								{#if order.property.apartment}Apt {order.property.apartment}{/if}
							</span><br />
						{/if}
						{#if order.property.address}
							<span class="text-muted">{order.property.address}</span>
						{/if}
					</dd>
				{/if}

				<dt>Valor total</dt>
				<dd class="price-val">{formatBRL(order.priceCents)}</dd>
			</dl>
		</div>

		<!-- Galeria de Fotos (Antes e Depois) -->
		{#if order.status === 'in_progress' || order.status === 'completed' || photos.length > 0}
			<div class="info-card">
				<div class="section-head">
					<h2>Fotos do serviço</h2>
					{#if photos.length > 0}
						<div class="photo-tabs">
							<button
								type="button"
								class="tab-btn"
								class:active={photoFilter === 'all'}
								onclick={() => (photoFilter = 'all')}>Todas ({photos.length})</button
							>
							<button
								type="button"
								class="tab-btn"
								class:active={photoFilter === 'before'}
								onclick={() => (photoFilter = 'before')}
								>Antes ({photos.filter((p) => p.kind === 'before').length})</button
							>
							<button
								type="button"
								class="tab-btn"
								class:active={photoFilter === 'after'}
								onclick={() => (photoFilter = 'after')}
								>Depois ({photos.filter((p) => p.kind === 'after').length})</button
							>
						</div>
					{/if}
				</div>

				{#if photosLoading}
					<p class="text-muted">Carregando fotos…</p>
				{:else if photos.length === 0}
					<div class="empty-photos">
						<svg
							viewBox="0 0 24 24"
							width="36"
							height="36"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
							<circle cx="12" cy="13" r="4" />
						</svg>
						<p>As fotos registradas pela equipe no início e término do serviço serão exibidas aqui.</p>
					</div>
				{:else}
					<div class="photos-grid">
						{#each filteredPhotos as p (p.id)}
							<button type="button" class="photo-item" onclick={() => (selectedPhoto = p)}>
								{#if p.url}
									<img src={p.url} alt="Foto {p.kind === 'before' ? 'Antes' : 'Depois'}" loading="lazy" />
								{:else}
									<div class="photo-placeholder">Carregando…</div>
								{/if}
								<span class="photo-tag" class:tag-after={p.kind === 'after'}>
									{p.kind === 'before' ? 'Antes' : 'Depois'}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Seção de Avaliação (Quando concluído) -->
		{#if order.status === 'completed'}
			<div class="info-card review-card">
				{#if review}
					<div class="section-head">
						<h2>Sua avaliação</h2>
						<span class="badge badge-ok">Avaliado</span>
					</div>
					<div class="rating-display">
						<div class="stars-row static">
							{#each [1, 2, 3, 4, 5] as star}
								<svg class="star-icon" class:filled={star <= review.rating} viewBox="0 0 24 24" width="26" height="26">
									<path
										d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
									/>
								</svg>
							{/each}
						</div>
						<span class="rating-num"><b>{review.rating}</b> de 5 estrelas</span>
					</div>
					{#if review.comment}
						<blockquote class="review-quote">
							"{review.comment}"
						</blockquote>
					{/if}
					<p class="review-thanks">
						<svg
							viewBox="0 0 24 24"
							width="16"
							height="16"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M20 6L9 17l-5-5" />
						</svg>
						Obrigado pelo seu feedback! Ele é fundamental para mantermos o alto padrão Jolog.
					</p>
				{:else}
					<h2>Como foi sua experiência?</h2>
					<p class="review-sub">Avalie o atendimento e a qualidade do serviço prestado.</p>

					<div class="rating-picker">
						<div class="stars-row interactive" role="radiogroup" aria-label="Nota do serviço de 1 a 5 estrelas">
							{#each [1, 2, 3, 4, 5] as star}
								<button
									type="button"
									class="star-btn"
									class:active={star <= currentRating}
									onmouseenter={() => (hoverRating = star)}
									onmouseleave={() => (hoverRating = 0)}
									onclick={() => (ratingInput = star)}
									aria-label="{star} estrelas"
								>
									<svg class="star-icon" viewBox="0 0 24 24" width="34" height="34">
										<path
											d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
										/>
									</svg>
								</button>
							{/each}
						</div>
						<p class="rating-label">{ratingLabels[currentRating] || 'Selecione uma nota'}</p>
					</div>

					<div class="comment-box">
						<label for="review-comment">Comentário (opcional)</label>
						<textarea
							id="review-comment"
							bind:value={commentInput}
							rows="3"
							maxlength="1000"
							placeholder="Conte como foi a limpeza, pontualidade e cuidado da equipe..."></textarea>
						<span class="char-count">{commentInput.length}/1000</span>
					</div>

					{#if reviewError}
						<p class="notice error">{reviewError}</p>
					{/if}
					{#if reviewSuccess}
						<p class="notice success">Avaliação enviada com sucesso! Muito obrigado.</p>
					{/if}

					<button
						type="button"
						class="btn btn-primary"
						disabled={savingReview || ratingInput < 1}
						onclick={submitReview}
					>
						{savingReview ? 'Enviando avaliação…' : 'Enviar avaliação'}
					</button>
				{/if}
			</div>
		{/if}

		<!-- Nota Fiscal (NFS-e) -->
		{#if order.status === 'completed' || order.status === 'scheduled' || order.status === 'in_progress'}
			<div class="info-card invoice-card">
				<div class="invoice-content">
					<div class="invoice-icon">
						<svg
							viewBox="0 0 24 24"
							width="28"
							height="28"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
							<polyline points="14 2 14 8 20 8" />
							<line x1="16" y1="13" x2="8" y2="13" />
							<line x1="16" y1="17" x2="8" y2="17" />
							<polyline points="10 9 9 9 8 9" />
						</svg>
					</div>
					<div>
						<h3>Nota Fiscal de Serviço (NFS-e)</h3>
						<p class="text-muted">Documento fiscal emitido após a confirmação do pagamento.</p>
					</div>
				</div>

				{#if invoiceFeedback}
					<p class="notice {invoiceFeedbackType}">{invoiceFeedback}</p>
				{/if}

				<button type="button" class="btn btn-invoice" onclick={handleDownloadInvoice} disabled={downloadingInvoice}>
					<svg
						viewBox="0 0 24 24"
						width="18"
						height="18"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" y1="15" x2="12" y2="3" />
					</svg>
					<span>{downloadingInvoice ? 'Consultando nota fiscal…' : 'Baixar Nota Fiscal (PDF)'}</span>
				</button>
			</div>
		{/if}

		<div class="actions-footer">
			<a class="btn btn-secondary" href="/pedidos">Voltar para Meus Pedidos</a>
		</div>
	{/if}
</section>

<!-- Modal de Foto em Tela Cheia -->
{#if selectedPhoto}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		onclick={() => (selectedPhoto = null)}
		onkeydown={(e) => e.key === 'Escape' && (selectedPhoto = null)}
	>
		<div
			class="photo-dialog"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="dialog-header">
				<span class="badge" class:badge-ok={selectedPhoto.kind === 'after'}>
					{selectedPhoto.kind === 'before' ? 'Foto de Antes' : 'Foto de Depois'}
				</span>
				<button type="button" class="btn-close" onclick={() => (selectedPhoto = null)} aria-label="Fechar foto">
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
			<div class="dialog-body">
				{#if selectedPhoto.url}
					<img src={selectedPhoto.url} alt="Foto ampliada do serviço" />
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.order-detail {
		display: grid;
		gap: 18px;
	}

	.nav-back {
		margin-bottom: -4px;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.95rem;
		transition: opacity 0.15s ease;
	}
	.back-link:hover {
		opacity: 0.8;
	}

	.detail-header {
		display: grid;
		gap: 4px;
	}
	.title-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	h1 {
		font-size: 1.45rem;
		margin: 0;
		color: var(--color-text);
		font-weight: 700;
	}
	.order-id {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-muted);
	}

	/* Status banner */
	.status-banner {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		border-radius: var(--radius);
		background: var(--color-surface);
		border: 1.5px solid var(--color-border);
	}
	.status-banner.badge-ok {
		background: rgba(31, 157, 85, 0.08);
		border-color: rgba(31, 157, 85, 0.25);
		color: #0e6b36;
	}
	.status-banner.badge-pending {
		background: rgba(234, 179, 8, 0.09);
		border-color: rgba(234, 179, 8, 0.3);
		color: #854d0e;
	}
	.status-banner.badge-progress {
		background: rgba(249, 115, 22, 0.09);
		border-color: rgba(249, 115, 22, 0.3);
		color: #9a3412;
	}
	.status-banner.badge-info {
		background: rgba(14, 165, 233, 0.09);
		border-color: rgba(14, 165, 233, 0.3);
		color: #0369a1;
	}
	.status-banner.badge-cancel {
		background: rgba(239, 68, 68, 0.08);
		border-color: rgba(239, 68, 68, 0.25);
		color: #991b1b;
	}
	.status-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.status-text strong {
		display: block;
		font-size: 0.98rem;
		margin-bottom: 2px;
	}
	.status-text p {
		margin: 0;
		font-size: 0.85rem;
		opacity: 0.9;
		line-height: 1.35;
	}

	.pulsing-dot {
		width: 14px;
		height: 14px;
		background: #ea580c;
		border-radius: 50%;
		display: inline-block;
		box-shadow: 0 0 0 0 rgba(234, 88, 12, 0.7);
		animation: pulse-ring 1.4s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
	}
	@keyframes pulse-ring {
		0% {
			transform: scale(0.8);
			box-shadow: 0 0 0 0 rgba(234, 88, 12, 0.7);
		}
		70% {
			transform: scale(1.1);
			box-shadow: 0 0 0 8px rgba(234, 88, 12, 0);
		}
		100% {
			transform: scale(0.8);
			box-shadow: 0 0 0 0 rgba(234, 88, 12, 0);
		}
	}

	/* Card genérico de informações */
	.info-card {
		background: var(--color-surface);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius);
		padding: 18px;
		display: grid;
		gap: 14px;
	}
	.info-card h2 {
		font-size: 1.12rem;
		margin: 0;
		font-weight: 700;
		color: var(--color-text);
	}

	.info-grid {
		display: grid;
		grid-template-columns: 120px 1fr;
		gap: 10px 14px;
		margin: 0;
		font-size: 0.95rem;
	}
	.info-grid dt {
		color: var(--color-muted);
		font-weight: 500;
	}
	.info-grid dd {
		margin: 0;
		font-weight: 600;
		color: var(--color-text);
	}
	.text-muted {
		color: var(--color-muted);
		font-size: 0.88rem;
		font-weight: 400;
	}
	.price-val {
		color: var(--color-primary);
		font-size: 1.15rem;
		font-weight: 800;
	}

	/* Pagamento */
	.payment-box {
		background: #fff8f5;
		border: 1.5px solid #fed7aa;
		border-radius: var(--radius);
		padding: 16px;
		display: grid;
		gap: 12px;
	}
	.timer-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.95rem;
	}
	.timer-clock {
		font-family: monospace;
		font-weight: 800;
		font-size: 1.25rem;
		color: #c2410c;
		background: #ffedd5;
		padding: 3px 8px;
		border-radius: 6px;
	}

	/* Fotos */
	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.photo-tabs {
		display: flex;
		gap: 6px;
	}
	.tab-btn {
		font-size: 0.8rem;
		padding: 5px 10px;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-muted);
		cursor: pointer;
		font-weight: 600;
		font-family: inherit;
		transition: all 0.15s ease;
	}
	.tab-btn.active {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}
	.empty-photos {
		display: grid;
		place-items: center;
		text-align: center;
		padding: 24px 12px;
		color: var(--color-muted);
		gap: 8px;
	}
	.photos-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 10px;
	}
	.photo-item {
		position: relative;
		aspect-ratio: 1;
		border-radius: var(--radius-sm);
		overflow: hidden;
		border: 1.5px solid var(--color-border);
		background: #000;
		padding: 0;
		cursor: pointer;
		display: block;
		transition: transform 0.15s ease;
	}
	.photo-item:hover {
		transform: scale(1.02);
	}
	.photo-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.photo-placeholder {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		color: #999;
		font-size: 0.8rem;
		background: #eee;
	}
	.photo-tag {
		position: absolute;
		bottom: 6px;
		left: 6px;
		background: rgba(0, 0, 0, 0.72);
		color: white;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 2px 7px;
		border-radius: 4px;
		backdrop-filter: blur(4px);
	}
	.photo-tag.tag-after {
		background: rgba(14, 107, 54, 0.85);
	}

	/* Avaliação */
	.review-card {
		border-color: rgba(245, 158, 11, 0.35);
		background: #fffdf9;
	}
	.review-sub {
		margin: -6px 0 6px;
		font-size: 0.9rem;
		color: var(--color-muted);
	}
	.rating-picker {
		display: grid;
		place-items: center;
		gap: 8px;
		padding: 10px 0;
	}
	.stars-row {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.star-btn {
		background: none;
		border: none;
		padding: 4px;
		cursor: pointer;
		color: #d1d5db;
		transition:
			transform 0.12s ease,
			color 0.12s ease;
	}
	.star-btn:hover {
		transform: scale(1.15);
	}
	.star-btn.active {
		color: #f59e0b;
	}
	.star-btn.active svg,
	.star-icon.filled {
		fill: #f59e0b;
		color: #d97706;
	}
	.star-icon {
		fill: currentColor;
		display: block;
	}
	.rating-label {
		font-size: 0.9rem;
		font-weight: 600;
		color: #92400e;
		margin: 0;
		min-height: 20px;
	}
	.comment-box {
		display: grid;
		gap: 6px;
	}
	.comment-box label {
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--color-text);
	}
	.comment-box textarea {
		width: 100%;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 10px;
		font-family: inherit;
		font-size: 0.92rem;
		resize: vertical;
		box-sizing: border-box;
	}
	.comment-box textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}
	.char-count {
		text-align: right;
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.rating-display {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.rating-num {
		font-size: 0.95rem;
		color: var(--color-text);
	}
	.review-quote {
		margin: 4px 0 8px;
		padding: 10px 14px;
		background: rgba(0, 0, 0, 0.03);
		border-left: 3px solid #f59e0b;
		border-radius: 4px;
		font-style: italic;
		color: var(--color-text);
		font-size: 0.92rem;
	}
	.review-thanks {
		display: flex;
		align-items: center;
		gap: 6px;
		color: #0e6b36;
		font-size: 0.88rem;
		font-weight: 600;
		margin: 0;
	}

	/* Nota Fiscal */
	.invoice-card {
		display: grid;
		gap: 14px;
	}
	.invoice-content {
		display: flex;
		align-items: flex-start;
		gap: 14px;
	}
	.invoice-icon {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-sm);
		background: rgba(173, 13, 60, 0.08);
		color: var(--color-primary);
		display: grid;
		place-items: center;
		flex-shrink: 0;
	}
	.invoice-content h3 {
		margin: 0 0 2px;
		font-size: 1.05rem;
		font-weight: 700;
	}
	.invoice-content p {
		margin: 0;
	}
	.btn-invoice {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: #f4f4f7;
		color: var(--color-text);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 12px;
		font-weight: 700;
		font-size: 0.95rem;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.15s ease;
	}
	.btn-invoice:hover:not(:disabled) {
		background: #e8e8ed;
		border-color: #ccc;
	}

	/* Botões e Badges */
	.badge {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 999px;
		background: var(--color-border);
		color: var(--color-muted);
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.badge-ok {
		background: rgba(31, 157, 85, 0.12);
		color: #0e6b36;
	}
	.badge-pending {
		background: rgba(234, 179, 8, 0.15);
		color: #854d0e;
	}
	.badge-progress {
		background: rgba(249, 115, 22, 0.15);
		color: #9a3412;
	}
	.badge-info {
		background: rgba(14, 165, 233, 0.12);
		color: #0369a1;
	}
	.badge-cancel {
		background: rgba(239, 68, 68, 0.12);
		color: #991b1b;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		border: none;
		border-radius: var(--radius-sm);
		padding: 13px 18px;
		font-weight: 700;
		text-align: center;
		text-decoration: none;
		font-size: 1rem;
		cursor: pointer;
		font-family: inherit;
		transition: opacity 0.15s ease;
		box-sizing: border-box;
		min-height: 48px;
	}
	.btn:hover:not(:disabled) {
		opacity: 0.92;
	}
	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.btn-primary {
		background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
		color: white;
	}
	.btn-secondary {
		background: #eef0f3;
		color: var(--color-text);
	}

	.notice {
		padding: 12px 14px;
		border-radius: 8px;
		font-size: 0.92rem;
		margin: 0;
	}
	.notice.error {
		background: #fde8e8;
		color: #9b1c1c;
		border: 1px solid #f8b4b4;
	}
	.notice.success {
		background: #def7ec;
		color: #03543f;
		border: 1px solid #bcf0da;
	}
	.notice.info {
		background: #e1effe;
		color: #1e429f;
		border: 1px solid #b4c6fc;
	}

	.skeleton-wrapper {
		display: grid;
		gap: 14px;
	}
	.skeleton-line,
	.skeleton-card {
		background: var(--color-surface);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius);
		animation: pulse 1.2s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}

	/* Modal de Foto */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		z-index: 1000;
		display: grid;
		place-items: center;
		padding: 16px;
	}
	.photo-dialog {
		background: white;
		border-radius: var(--radius);
		max-width: 520px;
		width: 100%;
		overflow: hidden;
		display: grid;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
	}
	.dialog-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
	}
	.btn-close {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		color: var(--color-muted);
		display: flex;
	}
	.dialog-body {
		background: #000;
		max-height: 70vh;
		display: grid;
		place-items: center;
	}
	.dialog-body img {
		max-width: 100%;
		max-height: 70vh;
		object-fit: contain;
		display: block;
	}

	.actions-footer {
		margin-top: 10px;
	}
</style>
