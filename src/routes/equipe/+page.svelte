<script lang="ts">
	import { onMount } from 'svelte';
	import { api, ApiError, getAuthUser, photoObjectUrl, uploadBookingPhoto } from '../../lib/api';
	import { session } from '../../lib/auth/session.svelte';
	import { timeLabel } from '../../lib/ui/dates';

	interface PropertyInfo {
		address: string;
		condominium: string | null;
		block: string | null;
		apartment: string | null;
		street: string | null;
		number: string | null;
		bedrooms: number;
	}

	interface CustomerInfo {
		name: string;
		phone: string | null;
	}

	interface ChecklistItem {
		itemId: string | null;
		customLabel: string | null;
		result: 'ok' | 'problem' | null;
		resultNote: string | null;
	}

	interface Booking {
		id: string;
		serviceType: 'cleaning' | 'laundry' | 'inspection';
		status: 'scheduled' | 'in_progress' | 'completed' | 'canceled' | string;
		startsAt: string | null;
		endsAt: string | null;
		notes: string | null;
		property: PropertyInfo | null;
		customer?: CustomerInfo | null;
		laundry?: { cycles: number; desiredDate: string; contactPhone: string | null } | null;
		inspection?: { items: ChecklistItem[] } | null;
	}

	interface PhotoItem {
		id: string;
		kind: 'before' | 'after';
		url?: string;
	}

	const names = {
		cleaning: 'Limpeza',
		laundry: 'Lavanderia',
		inspection: 'Vistoria de check-in'
	};

	let bookings = $state<Booking[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');

	// Pedido em atendimento
	let activeBooking = $state<Booking | null>(null);
	let activeTab = $state<'info' | 'photos' | 'checklist'>('info');

	// Fotos do pedido ativo
	let photos = $state<PhotoItem[]>([]);
	let loadingPhotos = $state(false);
	let uploadingPhoto = $state(false);
	let photoError = $state('');

	// Checklist
	let checklistItems = $state<ChecklistItem[]>([]);
	let savingChecklist = $state(false);
	let checklistSuccess = $state(false);

	// Ações de status
	let updatingStatus = $state(false);
	let statusSuccess = $state('');

	async function loadBookings() {
		loading = true;
		errorMsg = '';
		try {
			await getAuthUser();
			bookings = await api<Booking[]>('/api/bookings');
		} catch (err) {
			errorMsg = 'Não foi possível carregar os serviços atribuídos.';
		} finally {
			loading = false;
		}
	}

	async function selectBooking(b: Booking) {
		activeBooking = b;
		activeTab = 'info';
		photoError = '';
		statusSuccess = '';
		checklistSuccess = false;

		// Copia os itens do checklist para edição
		checklistItems = (b.inspection?.items ?? []).map((it) => ({ ...it }));

		await loadPhotos(b.id);
	}

	async function loadPhotos(bookingId: string) {
		loadingPhotos = true;
		try {
			const list = await api<{ id: string; kind: 'before' | 'after' }[]>(`/api/bookings/${bookingId}/photos`);
			// Gera as URLs locais autenticadas
			const loaded = await Promise.all(
				list.map(async (p) => {
					try {
						const url = await photoObjectUrl(bookingId, p.id);
						return { ...p, url };
					} catch {
						return p;
					}
				})
			);
			photos = loaded;
		} catch {
			photos = [];
		} finally {
			loadingPhotos = false;
		}
	}

	async function handleUpload(kind: 'before' | 'after', e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file || !activeBooking) return;

		uploadingPhoto = true;
		photoError = '';
		try {
			await uploadBookingPhoto(activeBooking.id, kind, file);
			await loadPhotos(activeBooking.id);
			target.value = '';
		} catch (err) {
			photoError = err instanceof Error ? err.message : 'Falha ao enviar a foto.';
		} finally {
			uploadingPhoto = false;
		}
	}

	async function changeStatus(newStatus: 'in_progress' | 'completed') {
		if (!activeBooking || updatingStatus) return;
		updatingStatus = true;
		statusSuccess = '';
		try {
			await api(`/api/bookings/${activeBooking.id}/status`, {
				method: 'POST',
				body: JSON.stringify({ status: newStatus })
			});
			activeBooking.status = newStatus;
			statusSuccess =
				newStatus === 'in_progress'
					? 'Atendimento iniciado! Registre as fotos do local.'
					: 'Serviço concluído com sucesso!';
			await loadBookings();
		} catch (err) {
			alert('Não foi possível atualizar o status do serviço.');
		} finally {
			updatingStatus = false;
		}
	}

	async function saveChecklist() {
		if (!activeBooking || savingChecklist) return;
		savingChecklist = true;
		checklistSuccess = false;
		try {
			await api(`/api/bookings/${activeBooking.id}/inspection`, {
				method: 'POST',
				body: JSON.stringify({ items: checklistItems })
			});
			checklistSuccess = true;
			setTimeout(() => (checklistSuccess = false), 3000);
		} catch {
			alert('Falha ao salvar o checklist da vistoria.');
		} finally {
			savingChecklist = false;
		}
	}

	function formatDate(iso: string | null): string {
		if (!iso) return 'Data a combinar';
		const d = new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString();
		return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} às ${timeLabel(iso)}`;
	}

	const beforePhotos = $derived(photos.filter((p) => p.kind === 'before'));
	const afterPhotos = $derived(photos.filter((p) => p.kind === 'after'));

	onMount(loadBookings);
</script>

<svelte:head>
	<title>Painel da Equipe · Jolog</title>
</svelte:head>

<section class="equipe-page">
	{#if activeBooking}
		<!-- Visão de Execução do Serviço -->
		<div class="header-action">
			<button type="button" class="btn-back" onclick={() => (activeBooking = null)}> ← Voltar aos serviços </button>
			<span class="badge status-{activeBooking.status}">
				{activeBooking.status === 'scheduled'
					? 'Agendado'
					: activeBooking.status === 'in_progress'
						? 'Em andamento'
						: activeBooking.status === 'completed'
							? 'Concluído'
							: activeBooking.status}
			</span>
		</div>

		<div class="active-card">
			<div class="service-meta">
				<span class="service-type-tag tag-{activeBooking.serviceType}">
					{names[activeBooking.serviceType]}
				</span>
				<h2>{names[activeBooking.serviceType]}</h2>
				<p class="service-date">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
						<line x1="16" y1="2" x2="16" y2="6"></line>
						<line x1="8" y1="2" x2="8" y2="6"></line>
						<line x1="3" y1="10" x2="21" y2="10"></line>
					</svg>
					{formatDate(activeBooking.startsAt)}
				</p>
			</div>

			<!-- Tabs de Controle -->
			<div class="tabs">
				<button type="button" class="tab" class:active={activeTab === 'info'} onclick={() => (activeTab = 'info')}>
					Imóvel & Cliente
				</button>
				<button type="button" class="tab" class:active={activeTab === 'photos'} onclick={() => (activeTab = 'photos')}>
					Fotos ({photos.length})
				</button>
				{#if activeBooking.serviceType === 'inspection'}
					<button
						type="button"
						class="tab"
						class:active={activeTab === 'checklist'}
						onclick={() => (activeTab = 'checklist')}
					>
						Checklist
					</button>
				{/if}
			</div>

			{#if statusSuccess}
				<div class="alert alert-success" role="status">{statusSuccess}</div>
			{/if}

			<!-- Tab 1: Info do Imóvel & Cliente -->
			{#if activeTab === 'info'}
				<div class="tab-content">
					<div class="section-box">
						<h3>Local do Atendimento</h3>
						{#if activeBooking.property}
							<p class="property-condo">
								<b>Condomínio:</b>
								{activeBooking.property.condominium || 'Não informado'}
							</p>
							<div class="property-units">
								{#if activeBooking.property.block}
									<span class="unit-badge">Bloco {activeBooking.property.block}</span>
								{/if}
								{#if activeBooking.property.apartment}
									<span class="unit-badge">Apto {activeBooking.property.apartment}</span>
								{/if}
								{#if activeBooking.property.bedrooms}
									<span class="unit-badge">{activeBooking.property.bedrooms} Quartos</span>
								{/if}
							</div>
							<p class="property-address">{activeBooking.property.address}</p>
						{:else}
							<p class="muted">Endereço não cadastrado.</p>
						{/if}
					</div>

					<div class="section-box">
						<h3>Cliente</h3>
						{#if activeBooking.customer}
							<p class="customer-name">{activeBooking.customer.name}</p>
							{#if activeBooking.customer.phone}
								<div class="customer-actions">
									<a class="btn-tel" href="tel:{activeBooking.customer.phone}">
										Ligar: {activeBooking.customer.phone}
									</a>
									<a
										class="btn-wpp"
										href="https://wa.me/55{activeBooking.customer.phone.replace(/\D/g, '')}"
										target="_blank"
										rel="noreferrer"
									>
										WhatsApp
									</a>
								</div>
							{/if}
						{:else}
							<p class="muted">Dados do cliente não disponíveis.</p>
						{/if}
					</div>

					{#if activeBooking.notes}
						<div class="section-box">
							<h3>Observações do Pedido</h3>
							<p class="notes-text">{activeBooking.notes}</p>
						</div>
					{/if}

					<!-- Botões de Ação de Status -->
					<div class="status-action-box">
						{#if activeBooking.status === 'scheduled'}
							<button
								type="button"
								class="btn btn-primary"
								disabled={updatingStatus}
								onclick={() => changeStatus('in_progress')}
							>
								{updatingStatus ? 'Iniciando…' : 'Iniciar Serviço Agora'}
							</button>
						{:else if activeBooking.status === 'in_progress'}
							<button
								type="button"
								class="btn btn-complete"
								disabled={updatingStatus}
								onclick={() => changeStatus('completed')}
							>
								{updatingStatus ? 'Concluindo…' : 'Concluir e Finalizar Serviço'}
							</button>
						{:else if activeBooking.status === 'completed'}
							<div class="completed-badge">✓ Serviço concluído e registrado</div>
						{/if}
					</div>
				</div>

				<!-- Tab 2: Fotos Antes e Depois -->
			{:else if activeTab === 'photos'}
				<div class="tab-content">
					{#if photoError}
						<div class="alert alert-error">{photoError}</div>
					{/if}

					<!-- Fotos ANTES -->
					<div class="photos-group">
						<div class="group-header">
							<div>
								<h4>Fotos do Local (Antes)</h4>
								<span class="hint">Tire fotos antes de iniciar o trabalho</span>
							</div>
							<label class="btn-add-photo">
								+ Foto Antes
								<input
									type="file"
									accept="image/jpeg,image/png,image/webp"
									capture="environment"
									disabled={uploadingPhoto}
									onchange={(e) => handleUpload('before', e)}
								/>
							</label>
						</div>

						<div class="photo-grid">
							{#each beforePhotos as p (p.id)}
								<div class="photo-card">
									{#if p.url}
										<img src={p.url} alt="Foto antes" />
									{:else}
										<div class="photo-placeholder">Carregando…</div>
									{/if}
									<span class="photo-kind">Antes</span>
								</div>
							{:else}
								<p class="empty-photos">Nenhuma foto "antes" enviada.</p>
							{/each}
						</div>
					</div>

					<!-- Fotos DEPOIS -->
					<div class="photos-group">
						<div class="group-header">
							<div>
								<h4>Fotos do Local (Depois)</h4>
								<span class="hint">Tire fotos do serviço finalizado</span>
							</div>
							<label class="btn-add-photo">
								+ Foto Depois
								<input
									type="file"
									accept="image/jpeg,image/png,image/webp"
									capture="environment"
									disabled={uploadingPhoto}
									onchange={(e) => handleUpload('after', e)}
								/>
							</label>
						</div>

						<div class="photo-grid">
							{#each afterPhotos as p (p.id)}
								<div class="photo-card">
									{#if p.url}
										<img src={p.url} alt="Foto depois" />
									{:else}
										<div class="photo-placeholder">Carregando…</div>
									{/if}
									<span class="photo-kind after">Depois</span>
								</div>
							{:else}
								<p class="empty-photos">Nenhuma foto "depois" enviada.</p>
							{/each}
						</div>
					</div>
				</div>

				<!-- Tab 3: Checklist da Vistoria -->
			{:else if activeTab === 'checklist' && activeBooking.serviceType === 'inspection'}
				<div class="tab-content">
					<p class="hint">Avalie cada item da vistoria e adicione notas de problemas se houver.</p>

					{#if checklistSuccess}
						<div class="alert alert-success">Checklist salvo com sucesso!</div>
					{/if}

					<div class="checklist-items">
						{#each checklistItems as item, idx}
							<div class="check-row">
								<span class="check-title">{item.customLabel || `Item ${idx + 1}`}</span>

								<div class="check-options">
									<button
										type="button"
										class="opt-btn opt-ok"
										class:selected={item.result === 'ok'}
										onclick={() => (item.result = 'ok')}
									>
										Em ordem
									</button>
									<button
										type="button"
										class="opt-btn opt-problem"
										class:selected={item.result === 'problem'}
										onclick={() => (item.result = 'problem')}
									>
										Problema
									</button>
								</div>

								{#if item.result === 'problem'}
									<input
										type="text"
										class="note-input"
										placeholder="Descreva o problema/avaria observada…"
										bind:value={item.resultNote}
									/>
								{/if}
							</div>
						{:else}
							<p class="empty-photos">Nenhum item de vistoria cadastrado.</p>
						{/each}
					</div>

					<button type="button" class="btn btn-primary" disabled={savingChecklist} onclick={saveChecklist}>
						{savingChecklist ? 'Salvando…' : 'Salvar Checklist da Vistoria'}
					</button>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Lista de Serviços Atribuídos -->
		<div class="page-title-row">
			<div>
				<h1>Serviços Atribuídos</h1>
				<p class="subtitle">Atendimentos designados para sua equipe.</p>
			</div>
			<button type="button" class="btn-refresh" onclick={loadBookings} title="Atualizar"> ↻ </button>
		</div>

		{#if loading}
			<div class="card status-box">
				<p>Carregando atendimentos…</p>
			</div>
		{:else if errorMsg}
			<div class="card alert-error">
				<p>{errorMsg}</p>
				<button class="btn btn-secondary" onclick={loadBookings}>Tentar novamente</button>
			</div>
		{:else if bookings.length === 0}
			<div class="card empty-box">
				<div class="empty-icon">📋</div>
				<h3>Nenhum serviço atribuído</h3>
				<p>Você não possui atendimentos na sua fila no momento.</p>
			</div>
		{:else}
			<div class="services-list">
				{#each bookings as b (b.id)}
					<div
						class="service-item card"
						role="button"
						tabindex="0"
						onclick={() => selectBooking(b)}
						onkeydown={(e) => e.key === 'Enter' && selectBooking(b)}
					>
						<div class="item-top">
							<span class="service-type-tag tag-{b.serviceType}">
								{names[b.serviceType]}
							</span>
							<span class="badge status-{b.status}">
								{b.status === 'scheduled'
									? 'Agendado'
									: b.status === 'in_progress'
										? 'Em andamento'
										: b.status === 'completed'
											? 'Concluído'
											: b.status}
							</span>
						</div>

						<div class="item-time">
							<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
								<line x1="16" y1="2" x2="16" y2="6"></line>
								<line x1="8" y1="2" x2="8" y2="6"></line>
								<line x1="3" y1="10" x2="21" y2="10"></line>
							</svg>
							<strong>{formatDate(b.startsAt)}</strong>
						</div>

						{#if b.property}
							<div class="item-loc">
								<p class="loc-condo">
									<b>{b.property.condominium || 'Condomínio'}</b>
									{#if b.property.block}
										· Bloco {b.property.block}{/if}
									{#if b.property.apartment}
										· Apto {b.property.apartment}{/if}
								</p>
								<p class="loc-addr">{b.property.address}</p>
							</div>
						{/if}

						{#if b.customer}
							<div class="item-client">
								<span>Cliente: {b.customer.name}</span>
							</div>
						{/if}

						<div class="item-arrow">
							<span>Abrir atendimento →</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</section>

<style>
	.equipe-page {
		max-width: 560px;
		margin: 0 auto;
	}

	.page-title-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 20px;
	}

	h1 {
		font-size: 1.5rem;
		color: var(--color-primary);
		margin: 0 0 4px;
	}

	.subtitle {
		font-size: 0.9rem;
		color: var(--color-muted);
		margin: 0;
	}

	.btn-refresh {
		background: #f4f4f6;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		width: 38px;
		height: 38px;
		font-size: 1.2rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.services-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.service-item {
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
		border: 1px solid var(--color-border);
		padding: 16px;
		border-radius: var(--radius-md);
		background: #fff;
	}

	.service-item:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
	}

	.item-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}

	.service-type-tag {
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 3px 8px;
		border-radius: 4px;
	}

	.tag-cleaning {
		background: #fde8ee;
		color: var(--color-primary);
	}

	.tag-laundry {
		background: #e3f2fd;
		color: #1976d2;
	}

	.tag-inspection {
		background: #ede7f6;
		color: #5e35b1;
	}

	.badge {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		padding: 3px 8px;
		border-radius: 4px;
	}

	.status-scheduled {
		background: #e8f4fd;
		color: #0277bd;
	}

	.status-in_progress {
		background: #fff3e0;
		color: #ef6c00;
	}

	.status-completed {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.item-time {
		display: flex;
		align-items: center;
		gap: 6px;
		color: #222;
		font-size: 0.95rem;
		margin-bottom: 8px;
	}

	.loc-condo {
		margin: 0;
		font-size: 0.92rem;
		color: #222;
	}

	.loc-addr {
		margin: 2px 0 0;
		font-size: 0.84rem;
		color: var(--color-muted);
	}

	.item-client {
		margin-top: 8px;
		font-size: 0.85rem;
		color: #444;
	}

	.item-arrow {
		margin-top: 12px;
		padding-top: 8px;
		border-top: 1px dashed var(--color-border);
		text-align: right;
		font-size: 0.86rem;
		font-weight: 600;
		color: var(--color-primary);
	}

	.header-action {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.btn-back {
		background: none;
		border: none;
		color: var(--color-primary);
		font-weight: 700;
		font-size: 0.95rem;
		cursor: pointer;
		padding: 0;
	}

	.active-card {
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 20px;
	}

	.service-meta h2 {
		margin: 6px 0 4px;
		color: #222;
		font-size: 1.35rem;
	}

	.service-date {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 16px;
		color: var(--color-muted);
		font-size: 0.9rem;
	}

	.tabs {
		display: flex;
		border-bottom: 2px solid var(--color-border);
		margin-bottom: 18px;
	}

	.tab {
		flex: 1;
		background: none;
		border: none;
		padding: 10px 4px;
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--color-muted);
		cursor: pointer;
		border-bottom: 3px solid transparent;
		margin-bottom: -2px;
		transition: all 0.2s ease;
	}

	.tab.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}

	.section-box {
		background: #fbfbfb;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 14px;
		margin-bottom: 14px;
	}

	.section-box h3 {
		font-size: 0.88rem;
		text-transform: uppercase;
		color: var(--color-muted);
		margin: 0 0 8px;
	}

	.property-units {
		display: flex;
		gap: 6px;
		margin: 6px 0;
	}

	.unit-badge {
		background: #eef2f5;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.customer-actions {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}

	.btn-tel,
	.btn-wpp {
		display: inline-block;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		font-weight: 700;
		text-decoration: none;
		text-align: center;
	}

	.btn-tel {
		background: #f0f0f2;
		color: #222;
	}

	.btn-wpp {
		background: #25d366;
		color: #fff;
	}

	.status-action-box {
		margin-top: 20px;
	}

	.btn {
		display: block;
		width: 100%;
		border: none;
		border-radius: var(--radius-sm);
		padding: 14px;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		text-align: center;
	}

	.btn-primary {
		background: var(--gradient-btn);
		color: #fff;
	}

	.btn-complete {
		background: linear-gradient(135deg, #2e7d32, #1b5e20);
		color: #fff;
	}

	.completed-badge {
		background: #e8f5e9;
		color: #2e7d32;
		padding: 14px;
		text-align: center;
		font-weight: 700;
		border-radius: var(--radius-sm);
	}

	.photos-group {
		margin-bottom: 24px;
	}

	.group-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}

	.group-header h4 {
		margin: 0;
		font-size: 0.98rem;
		color: #222;
	}

	.hint {
		font-size: 0.8rem;
		color: var(--color-muted);
	}

	.btn-add-photo {
		background: var(--color-primary);
		color: white;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
	}

	.btn-add-photo input {
		display: none;
	}

	.photo-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.photo-card {
		position: relative;
		aspect-ratio: 1;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: #eee;
	}

	.photo-card img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.photo-kind {
		position: absolute;
		bottom: 4px;
		left: 4px;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		padding: 2px 6px;
		font-size: 0.65rem;
		border-radius: 3px;
		text-transform: uppercase;
	}

	.photo-kind.after {
		background: rgba(46, 125, 50, 0.85);
	}

	.empty-photos {
		grid-column: 1 / -1;
		font-size: 0.85rem;
		color: var(--color-muted);
		padding: 12px 0;
		margin: 0;
	}

	.check-row {
		background: #fbfbfb;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 12px;
		margin-bottom: 10px;
	}

	.check-title {
		display: block;
		font-weight: 600;
		font-size: 0.92rem;
		margin-bottom: 8px;
	}

	.check-options {
		display: flex;
		gap: 8px;
		margin-bottom: 6px;
	}

	.opt-btn {
		flex: 1;
		padding: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: #fff;
		cursor: pointer;
	}

	.opt-ok.selected {
		background: #e8f5e9;
		color: #2e7d32;
		border-color: #a5d6a7;
	}

	.opt-problem.selected {
		background: #ffebee;
		color: #c62828;
		border-color: #ef9a9a;
	}

	.note-input {
		width: 100%;
		margin-top: 6px;
		padding: 8px;
		font-size: 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		box-sizing: border-box;
	}

	.alert {
		padding: 10px 14px;
		border-radius: var(--radius-sm);
		font-size: 0.88rem;
		margin-bottom: 14px;
	}

	.alert-success {
		background: #e8f5e9;
		color: #2e7d32;
		border: 1px solid #c8e6c9;
	}

	.alert-error {
		background: #ffebee;
		color: #c62828;
		border: 1px solid #ffcdd2;
	}

	.empty-box {
		text-align: center;
		padding: 40px 20px;
		color: var(--color-muted);
	}

	.empty-icon {
		font-size: 2.5rem;
		margin-bottom: 10px;
	}
</style>
