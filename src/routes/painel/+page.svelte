<script lang="ts">
	import { onMount } from 'svelte';
	import { api, getAuthUser, photoObjectUrl } from '../../lib/api';
	import { logout } from '../../lib/auth/session.svelte';
	import { formatBRL, timeLabel } from '../../lib/ui/dates';

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
		customerId: string;
		serviceType: 'cleaning' | 'laundry' | 'inspection';
		status: string;
		startsAt: string | null;
		endsAt: string | null;
		priceCents: number;
		assignedStaff: string | null;
		notes: string | null;
		property: PropertyInfo | null;
		customer?: CustomerInfo | null;
		laundry?: {
			cycles: number;
			desiredDate: string;
			contactPhone: string | null;
			contactStatus: string;
			confirmedDate: string | null;
		} | null;
		inspection?: { items: ChecklistItem[] } | null;
	}

	interface StaffUser {
		uid: string;
		name: string;
		phone: string | null;
		role: string;
	}

	interface ChecklistCatalogItem {
		id: string;
		label: string;
		active: boolean;
		position: number;
	}

	interface PhotoItem {
		id: string;
		kind: 'before' | 'after';
		url?: string;
	}

	const serviceNames = {
		cleaning: 'Limpeza',
		laundry: 'Lavanderia',
		inspection: 'Vistoria'
	};

	let tab = $state<'bookings' | 'laundry' | 'team' | 'checklist'>('bookings');

	let bookings = $state<Booking[]>([]);
	let staffList = $state<StaffUser[]>([]);
	let checklistCatalog = $state<ChecklistCatalogItem[]>([]);

	let loading = $state(true);
	let errorMsg = $state('');

	// Filtros de pedidos
	let filterService = $state<'all' | 'cleaning' | 'laundry' | 'inspection'>('all');
	let filterStatus = $state<'all' | 'pending_payment' | 'scheduled' | 'in_progress' | 'completed' | 'unassigned'>(
		'all'
	);

	// Modal de detalhes
	let selectedBooking = $state<Booking | null>(null);
	let modalPhotos = $state<PhotoItem[]>([]);
	let loadingPhotos = $state(false);
	let assigning = $state(false);
	let changingStatus = $state(false);

	// Formulário de novo item no checklist
	let newChecklistLabel = $state('');
	let savingChecklist = $state(false);

	// Formulário de promoção de usuário
	let promoUid = $state('');
	let promoRole = $state<'equipe' | 'cliente' | 'admin'>('equipe');
	let savingRole = $state(false);
	let roleSuccess = $state('');

	async function loadAll() {
		loading = true;
		errorMsg = '';
		try {
			await getAuthUser();
			const [bRes, uRes, cRes] = await Promise.all([
				api<Booking[]>('/api/bookings'),
				api<StaffUser[]>('/api/admin/users'),
				api<ChecklistCatalogItem[]>('/api/admin/checklist')
			]);
			bookings = bRes;
			staffList = uRes;
			checklistCatalog = cRes;
		} catch (err) {
			errorMsg = 'Não foi possível carregar os dados administrativos.';
		} finally {
			loading = false;
		}
	}

	const filteredBookings = $derived(
		bookings.filter((b) => {
			if (filterService !== 'all' && b.serviceType !== filterService) return false;
			if (filterStatus === 'unassigned') return !b.assignedStaff && b.status !== 'canceled';
			if (filterStatus !== 'all' && b.status !== filterStatus) return false;
			return true;
		})
	);

	const laundryBookings = $derived(bookings.filter((b) => b.serviceType === 'laundry'));
	const staffMembers = $derived(staffList.filter((u) => u.role === 'equipe'));

	async function openDetails(b: Booking) {
		selectedBooking = b;
		modalPhotos = [];
		loadingPhotos = true;
		try {
			const list = await api<{ id: string; kind: 'before' | 'after' }[]>(`/api/bookings/${b.id}/photos`);
			modalPhotos = await Promise.all(
				list.map(async (p) => {
					try {
						const url = await photoObjectUrl(b.id, p.id);
						return { ...p, url };
					} catch {
						return p;
					}
				})
			);
		} catch {
			modalPhotos = [];
		} finally {
			loadingPhotos = false;
		}
	}

	async function handleAssign(staffUid: string | null) {
		if (!selectedBooking || assigning) return;
		assigning = true;
		try {
			await api(`/api/bookings/${selectedBooking.id}/assign`, {
				method: 'POST',
				body: JSON.stringify({ staffUid })
			});
			selectedBooking.assignedStaff = staffUid;
			// Atualiza na lista geral
			const target = bookings.find((x) => x.id === selectedBooking?.id);
			if (target) target.assignedStaff = staffUid;
		} catch {
			alert('Falha ao atribuir funcionária.');
		} finally {
			assigning = false;
		}
	}

	async function handleStatusChange(status: string) {
		if (!selectedBooking || changingStatus) return;
		changingStatus = true;
		try {
			await api(`/api/bookings/${selectedBooking.id}/status`, {
				method: 'POST',
				body: JSON.stringify({ status })
			});
			selectedBooking.status = status;
			const target = bookings.find((x) => x.id === selectedBooking?.id);
			if (target) target.status = status;
		} catch {
			alert('Falha ao alterar status.');
		} finally {
			changingStatus = false;
		}
	}

	async function updateLaundry(b: Booking, contactStatus: string, confirmedDate?: string | null) {
		try {
			await api(`/api/bookings/${b.id}/laundry`, {
				method: 'POST',
				body: JSON.stringify({ contactStatus, confirmedDate })
			});
			if (b.laundry) {
				b.laundry.contactStatus = contactStatus;
				if (confirmedDate) b.laundry.confirmedDate = confirmedDate;
			}
			await loadAll();
		} catch {
			alert('Falha ao atualizar lavanderia.');
		}
	}

	async function addChecklistItem(e: SubmitEvent) {
		e.preventDefault();
		if (!newChecklistLabel.trim() || savingChecklist) return;
		savingChecklist = true;
		try {
			await api('/api/admin/checklist', {
				method: 'POST',
				body: JSON.stringify({
					label: newChecklistLabel.trim(),
					active: true,
					position: checklistCatalog.length
				})
			});
			newChecklistLabel = '';
			const cRes = await api<ChecklistCatalogItem[]>('/api/admin/checklist');
			checklistCatalog = cRes;
		} catch {
			alert('Falha ao cadastrar item.');
		} finally {
			savingChecklist = false;
		}
	}

	async function toggleChecklistItem(item: ChecklistCatalogItem) {
		try {
			await api('/api/admin/checklist', {
				method: 'POST',
				body: JSON.stringify({ id: item.id, label: item.label, active: !item.active })
			});
			item.active = !item.active;
		} catch {
			alert('Falha ao alterar item.');
		}
	}

	async function handlePromoteUser(e: SubmitEvent) {
		e.preventDefault();
		if (!promoUid.trim() || savingRole) return;
		savingRole = true;
		roleSuccess = '';
		try {
			await api(`/api/admin/users/${promoUid.trim()}/role`, {
				method: 'POST',
				body: JSON.stringify({ role: promoRole })
			});
			roleSuccess = `Papel alterado para "${promoRole}" com sucesso!`;
			promoUid = '';
			const uRes = await api<StaffUser[]>('/api/admin/users');
			staffList = uRes;
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Falha ao alterar papel do usuário.');
		} finally {
			savingRole = false;
		}
	}

	function staffName(uid: string | null): string {
		if (!uid) return 'Não atribuído';
		const u = staffList.find((x) => x.uid === uid);
		return u ? u.name : 'Equipe';
	}

	function formatDate(iso: string | null): string {
		if (!iso) return 'A combinar';
		const d = new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString();
		return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} às ${timeLabel(iso)}`;
	}

	onMount(loadAll);
</script>

<svelte:head>
	<title>Painel Administrativo · Grupo Jolog</title>
</svelte:head>

<section class="admin-panel">
	<div class="panel-header">
		<div>
			<h1>Painel de Controle</h1>
			<p class="subtitle">Gestão operacional, agendamentos e equipe do Grupo Jolog.</p>
		</div>
		<div class="header-btns">
			<button type="button" class="btn-refresh" onclick={loadAll} title="Recarregar">↻</button>
			<button type="button" class="btn-exit" onclick={logout}>Sair</button>
		</div>
	</div>

	<!-- Navegação Principal -->
	<nav class="main-tabs">
		<button type="button" class="tab-btn" class:active={tab === 'bookings'} onclick={() => (tab = 'bookings')}>
			📋 Pedidos & Agenda ({bookings.length})
		</button>
		<button type="button" class="tab-btn" class:active={tab === 'laundry'} onclick={() => (tab = 'laundry')}>
			🧺 Lavanderia ({laundryBookings.length})
		</button>
		<button type="button" class="tab-btn" class:active={tab === 'team'} onclick={() => (tab = 'team')}>
			👥 Equipe & Acessos ({staffMembers.length})
		</button>
		<button type="button" class="tab-btn" class:active={tab === 'checklist'} onclick={() => (tab = 'checklist')}>
			✓ Itens de Vistoria
		</button>
	</nav>

	{#if loading}
		<div class="loading-box">
			<p>Carregando dados operacionais…</p>
		</div>
	{:else if errorMsg}
		<div class="alert alert-error">
			<p>{errorMsg}</p>
			<button class="btn btn-secondary" onclick={loadAll}>Tentar novamente</button>
		</div>

		<!-- TAB 1: PEDIDOS & AGENDA -->
	{:else if tab === 'bookings'}
		<div class="filter-bar">
			<div class="filter-group">
				<label for="filter-srv">Serviço:</label>
				<select id="filter-srv" bind:value={filterService}>
					<option value="all">Todos os serviços</option>
					<option value="cleaning">Limpeza</option>
					<option value="inspection">Vistoria</option>
					<option value="laundry">Lavanderia</option>
				</select>
			</div>

			<div class="filter-group">
				<label for="filter-st">Status:</label>
				<select id="filter-st" bind:value={filterStatus}>
					<option value="all">Todos os status</option>
					<option value="unassigned">⚠️ Sem atribuição</option>
					<option value="scheduled">Agendados</option>
					<option value="in_progress">Em andamento</option>
					<option value="completed">Concluídos</option>
					<option value="pending_payment">Aguardando pagamento</option>
				</select>
			</div>
		</div>

		<div class="table-container">
			<table class="data-table">
				<thead>
					<tr>
						<th>Serviço / Data</th>
						<th>Imóvel</th>
						<th>Cliente</th>
						<th>Atribuição</th>
						<th>Status</th>
						<th>Valor</th>
						<th>Ações</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredBookings as b (b.id)}
						<tr>
							<td>
								<span class="tag tag-{b.serviceType}">{serviceNames[b.serviceType]}</span>
								<div class="date-txt">{formatDate(b.startsAt)}</div>
							</td>
							<td>
								{#if b.property}
									<div class="bold">{b.property.condominium || 'Condomínio'}</div>
									<div class="sub-txt">
										{#if b.property.block}Bloco {b.property.block} ·
										{/if}
										{#if b.property.apartment}Apto {b.property.apartment}{/if}
									</div>
								{:else}
									<span class="muted">-</span>
								{/if}
							</td>
							<td>
								{#if b.customer}
									<div>{b.customer.name}</div>
									{#if b.customer.phone}
										<a class="phone-link" href="tel:{b.customer.phone}">{b.customer.phone}</a>
									{/if}
								{:else}
									<span class="muted">-</span>
								{/if}
							</td>
							<td>
								<span class="staff-tag" class:unassigned={!b.assignedStaff}>
									{staffName(b.assignedStaff)}
								</span>
							</td>
							<td>
								<span class="badge status-{b.status}">
									{b.status === 'scheduled'
										? 'Agendado'
										: b.status === 'in_progress'
											? 'Em andamento'
											: b.status === 'completed'
												? 'Concluído'
												: b.status === 'pending_payment'
													? 'Pendente'
													: b.status}
								</span>
							</td>
							<td class="bold">{formatBRL(b.priceCents)}</td>
							<td>
								<button type="button" class="btn-detail" onclick={() => openDetails(b)}> Ver detalhes </button>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7" class="empty-cell">Nenhum pedido encontrado para os filtros selecionados.</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- TAB 2: FILA DA LAVANDERIA -->
	{:else if tab === 'laundry'}
		<div class="section-desc">
			<p>
				Os pedidos de lavanderia são solicitados pelo dia desejado. Combine com o morador e confirme a data do
				atendimento.
			</p>
		</div>

		<div class="laundry-cards">
			{#each laundryBookings as b (b.id)}
				<div class="laundry-card">
					<div class="laundry-header">
						<div>
							<span class="tag tag-laundry">Lavanderia ({b.laundry?.cycles || 1} Ciclos)</span>
							<h3>{b.customer?.name || 'Cliente'}</h3>
						</div>
						<span class="badge status-{b.status}">
							{b.status === 'awaiting_contact'
								? 'Aguardando contato'
								: b.status === 'scheduled'
									? 'Confirmado'
									: b.status}
						</span>
					</div>

					<div class="laundry-body">
						<p><b>Dia Desejado:</b> {b.laundry?.desiredDate || 'Não informado'}</p>
						{#if b.laundry?.contactPhone}
							<p><b>Telefone informado:</b> {b.laundry.contactPhone}</p>
						{/if}
						{#if b.property}
							<p><b>Imóvel:</b> {b.property.condominium} - Apto {b.property.apartment}</p>
						{/if}
					</div>

					<div class="laundry-actions">
						{#if b.customer?.phone}
							<a
								class="btn-wpp"
								href="https://wa.me/55{(b.laundry?.contactPhone || b.customer.phone).replace(/\D/g, '')}"
								target="_blank"
								rel="noreferrer"
							>
								Falar no WhatsApp
							</a>
						{/if}

						{#if b.laundry?.contactStatus === 'pending'}
							<button type="button" class="btn-act" onclick={() => updateLaundry(b, 'contacted')}>
								Marcar como "Em contato"
							</button>
						{/if}

						<button
							type="button"
							class="btn-act btn-confirm"
							onclick={() => {
								const d = prompt('Digite a data final combinada (YYYY-MM-DD):', b.laundry?.desiredDate || '');
								if (d) updateLaundry(b, 'confirmed', d);
							}}
						>
							Confirmar Data
						</button>
					</div>
				</div>
			{:else}
				<p class="muted">Nenhum pedido de lavanderia registrado.</p>
			{/each}
		</div>

		<!-- TAB 3: EQUIPE & ACESSOS -->
	{:else if tab === 'team'}
		<div class="team-layout">
			<div class="team-list-box">
				<h2>Profissionais da Equipe</h2>
				<div class="staff-cards">
					{#each staffMembers as s (s.uid)}
						<div class="staff-card">
							<div class="avatar">👤</div>
							<div class="staff-info">
								<strong>{s.name}</strong>
								<span class="staff-role">{s.role}</span>
								{#if s.phone}<small>{s.phone}</small>{/if}
							</div>
						</div>
					{:else}
						<p class="muted">Nenhuma funcionária cadastrada no papel "equipe".</p>
					{/each}
				</div>
			</div>

			<div class="promote-box">
				<h2>Gerenciar Papel de Usuário</h2>
				<p class="sub-txt">Promova uma conta existente para o papel de "equipe" ou "admin".</p>

				{#if roleSuccess}
					<div class="alert alert-success">{roleSuccess}</div>
				{/if}

				<form onsubmit={handlePromoteUser} class="promo-form">
					<label for="uid-input">UID ou E-mail da conta:</label>
					<input id="uid-input" type="text" placeholder="Ex: H5oarHwPGVbIRIxH2lc7..." bind:value={promoUid} required />

					<label for="role-select">Atribuir Papel:</label>
					<select id="role-select" bind:value={promoRole}>
						<option value="equipe">Equipe (acesso mobile a serviços atribuídos)</option>
						<option value="admin">Administrador (acesso a este painel)</option>
						<option value="cliente">Cliente (usuário padrão)</option>
					</select>

					<button type="submit" class="btn btn-primary" disabled={savingRole}>
						{savingRole ? 'Salvando…' : 'Atualizar Papel'}
					</button>
				</form>
			</div>
		</div>

		<!-- TAB 4: ITENS DE VISTORIA -->
	{:else if tab === 'checklist'}
		<div class="checklist-mgmt">
			<div class="checklist-form-box">
				<h2>Novo Item de Vistoria</h2>
				<form onsubmit={addChecklistItem} class="inline-form">
					<input
						type="text"
						placeholder="Ex: Condições da Pintura, Chaves entregues, Torneiras…"
						bind:value={newChecklistLabel}
						required
					/>
					<button type="submit" class="btn btn-primary" disabled={savingChecklist}>
						{savingChecklist ? 'Adicionando…' : 'Adicionar Item'}
					</button>
				</form>
			</div>

			<div class="catalog-list">
				<h2>Catálogo de Itens Ativos</h2>
				{#each checklistCatalog as item (item.id)}
					<div class="catalog-item" class:inactive={!item.active}>
						<span>{item.label}</span>
						<button type="button" class="btn-toggle" onclick={() => toggleChecklistItem(item)}>
							{item.active ? 'Desativar' : 'Ativar'}
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- MODAL DE DETALHES DO PEDIDO -->
	{#if selectedBooking}
		<div
			class="modal-backdrop"
			onclick={() => (selectedBooking = null)}
			onkeydown={(e) => e.key === 'Escape' && (selectedBooking = null)}
			role="button"
			tabindex="0"
			aria-label="Fechar detalhes"
		>
			<div
				class="modal-content"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				tabindex="-1"
			>
				<div class="modal-header">
					<div>
						<span class="tag tag-{selectedBooking.serviceType}">
							{serviceNames[selectedBooking.serviceType]}
						</span>
						<h2>Detalhes do Atendimento</h2>
					</div>
					<button type="button" class="btn-close" onclick={() => (selectedBooking = null)}>✕</button>
				</div>

				<div class="modal-body">
					<div class="detail-grid">
						<div>
							<h4>Imóvel</h4>
							<p><b>Condomínio:</b> {selectedBooking.property?.condominium || '-'}</p>
							<p>
								<b>Unidade:</b>
								Bloco {selectedBooking.property?.block || '-'}, Apto {selectedBooking.property?.apartment || '-'}
							</p>
							<p><b>Endereço:</b> {selectedBooking.property?.address || '-'}</p>
						</div>

						<div>
							<h4>Cliente</h4>
							<p><b>Nome:</b> {selectedBooking.customer?.name || '-'}</p>
							<p><b>Telefone:</b> {selectedBooking.customer?.phone || '-'}</p>
							<p><b>Data:</b> {formatDate(selectedBooking.startsAt)}</p>
							<p><b>Valor:</b> {formatBRL(selectedBooking.priceCents)}</p>
						</div>
					</div>

					<!-- Atribuição da Equipe -->
					<div class="assign-box">
						<label for="staff-sel"><b>Funcionária Designada:</b></label>
						<div class="assign-row">
							<select
								id="staff-sel"
								value={selectedBooking.assignedStaff ?? ''}
								onchange={(e) => handleAssign(e.currentTarget.value || null)}
								disabled={assigning}
							>
								<option value="">Nenhuma (Não atribuído)</option>
								{#each staffMembers as s (s.uid)}
									<option value={s.uid}>{s.name} ({s.phone || 'Sem tel'})</option>
								{/each}
							</select>
							{#if assigning}<span class="spin">Salvando…</span>{/if}
						</div>
					</div>

					<!-- Alteração de Status Manual -->
					<div class="assign-box">
						<label for="status-sel"><b>Status do Atendimento:</b></label>
						<select
							id="status-sel"
							value={selectedBooking.status}
							onchange={(e) => handleStatusChange(e.currentTarget.value)}
							disabled={changingStatus}
						>
							<option value="pending_payment">Pendente de pagamento</option>
							<option value="scheduled">Agendado</option>
							<option value="in_progress">Em andamento</option>
							<option value="completed">Concluído</option>
							<option value="canceled">Cancelado</option>
						</select>
					</div>

					<!-- Galeria de Fotos Antes / Depois -->
					<div class="photos-section">
						<h4>Fotos Registradas pela Equipe</h4>
						{#if loadingPhotos}
							<p class="muted">Carregando fotos do atendimento…</p>
						{:else if modalPhotos.length === 0}
							<p class="muted">Nenhuma foto enviada até o momento.</p>
						{:else}
							<div class="photos-gallery">
								{#each modalPhotos as p (p.id)}
									<div class="photo-thumb">
										{#if p.url}
											<img src={p.url} alt="Foto {p.kind}" />
										{/if}
										<span class="photo-badge {p.kind}">{p.kind === 'before' ? 'Antes' : 'Depois'}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Itens de Vistoria -->
					{#if selectedBooking.inspection?.items?.length}
						<div class="inspection-results">
							<h4>Resultado da Vistoria</h4>
							<ul>
								{#each selectedBooking.inspection.items as it}
									<li>
										<span class="it-title">{it.customLabel || 'Item'}:</span>
										<span class="it-res {it.result}"
											>{it.result === 'ok'
												? '✓ Em ordem'
												: it.result === 'problem'
													? '⚠ Problema'
													: 'Não avaliado'}</span
										>
										{#if it.resultNote}<small class="it-note">({it.resultNote})</small>{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.admin-panel {
		max-width: 1080px;
		margin: 0 auto;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 16px;
		margin-bottom: 18px;
	}

	h1 {
		color: var(--color-primary);
		font-size: 1.6rem;
		margin: 0 0 4px;
	}

	.subtitle {
		color: var(--color-muted);
		font-size: 0.92rem;
		margin: 0;
	}

	.header-btns {
		display: flex;
		gap: 8px;
	}

	.btn-refresh {
		background: #f4f4f6;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		width: 36px;
		height: 36px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
	}

	.btn-exit {
		background: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
		padding: 6px 14px;
		border-radius: var(--radius-sm);
		font-weight: 700;
		cursor: pointer;
	}

	.main-tabs {
		display: flex;
		gap: 8px;
		border-bottom: 2px solid var(--color-border);
		margin-bottom: 20px;
		overflow-x: auto;
	}

	.tab-btn {
		background: none;
		border: none;
		padding: 10px 16px;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--color-muted);
		cursor: pointer;
		border-bottom: 3px solid transparent;
		margin-bottom: -2px;
		white-space: nowrap;
	}

	.tab-btn.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}

	.filter-bar {
		display: flex;
		gap: 16px;
		background: #fafafa;
		padding: 12px 16px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		margin-bottom: 16px;
		flex-wrap: wrap;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.88rem;
		font-weight: 600;
	}

	.filter-group select {
		padding: 6px 10px;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		font-size: 0.88rem;
	}

	.table-container {
		overflow-x: auto;
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
		text-align: left;
	}

	.data-table th {
		background: #f4f4f6;
		padding: 12px 14px;
		font-weight: 700;
		color: #444;
		border-bottom: 1px solid var(--color-border);
	}

	.data-table td {
		padding: 12px 14px;
		border-bottom: 1px solid var(--color-border);
		vertical-align: middle;
	}

	.bold {
		font-weight: 700;
	}

	.date-txt {
		font-size: 0.82rem;
		color: var(--color-muted);
		margin-top: 4px;
	}

	.sub-txt {
		font-size: 0.82rem;
		color: var(--color-muted);
	}

	.phone-link {
		color: var(--color-primary);
		text-decoration: none;
		font-size: 0.82rem;
	}

	.tag {
		display: inline-block;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		padding: 2px 6px;
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

	.staff-tag {
		display: inline-block;
		background: #e8f5e9;
		color: #1b5e20;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.staff-tag.unassigned {
		background: #fff3e0;
		color: #e65100;
	}

	.badge {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 4px;
		text-transform: uppercase;
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

	.status-pending_payment {
		background: #fff8e1;
		color: #f57f17;
	}

	.btn-detail {
		background: #f0f0f2;
		border: 1px solid var(--color-border);
		padding: 6px 12px;
		border-radius: 4px;
		font-weight: 600;
		font-size: 0.82rem;
		cursor: pointer;
	}

	.laundry-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 16px;
	}

	.laundry-card {
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 16px;
	}

	.laundry-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.laundry-header h3 {
		margin: 6px 0 0;
		font-size: 1.1rem;
	}

	.laundry-body {
		font-size: 0.88rem;
		margin-bottom: 14px;
	}

	.laundry-body p {
		margin: 4px 0;
	}

	.laundry-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.btn-wpp {
		background: #25d366;
		color: #fff;
		padding: 8px 12px;
		border-radius: 4px;
		font-size: 0.85rem;
		font-weight: 700;
		text-decoration: none;
	}

	.btn-act {
		background: #f0f0f2;
		border: 1px solid var(--color-border);
		padding: 8px 12px;
		border-radius: 4px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-confirm {
		background: var(--color-primary);
		color: white;
		border: none;
	}

	.team-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
	}

	@media (max-width: 768px) {
		.team-layout {
			grid-template-columns: 1fr;
		}
	}

	.staff-cards {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 12px;
	}

	.staff-card {
		display: flex;
		align-items: center;
		gap: 12px;
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 12px;
	}

	.avatar {
		font-size: 1.8rem;
	}

	.staff-info {
		display: flex;
		flex-direction: column;
	}

	.staff-role {
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--color-primary);
		font-weight: 700;
	}

	.promote-box {
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 18px;
	}

	.promo-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 12px;
	}

	.promo-form input,
	.promo-form select {
		padding: 10px;
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}

	.checklist-mgmt {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.checklist-form-box {
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 18px;
	}

	.inline-form {
		display: flex;
		gap: 8px;
		margin-top: 10px;
	}

	.inline-form input {
		flex: 1;
		padding: 10px;
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}

	.catalog-list {
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 18px;
	}

	.catalog-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid var(--color-border);
	}

	.catalog-item.inactive {
		opacity: 0.5;
		text-decoration: line-through;
	}

	.btn-toggle {
		background: #f0f0f2;
		border: 1px solid var(--color-border);
		padding: 4px 10px;
		border-radius: 4px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn {
		border: none;
		border-radius: 4px;
		padding: 10px 16px;
		font-weight: 700;
		cursor: pointer;
	}

	.btn-primary {
		background: var(--gradient-btn);
		color: white;
	}

	/* MODAL */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 999;
		padding: 16px;
	}

	.modal-content {
		background: #fff;
		border-radius: var(--radius-lg);
		max-width: 650px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		padding: 24px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 14px;
		margin-bottom: 16px;
	}

	.btn-close {
		background: none;
		border: none;
		font-size: 1.3rem;
		cursor: pointer;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		background: #fafafa;
		padding: 14px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		margin-bottom: 16px;
		font-size: 0.88rem;
	}

	.detail-grid h4 {
		margin: 0 0 8px;
		text-transform: uppercase;
		color: var(--color-muted);
		font-size: 0.78rem;
	}

	.detail-grid p {
		margin: 4px 0;
	}

	.assign-box {
		margin-bottom: 16px;
	}

	.assign-box label {
		display: block;
		margin-bottom: 6px;
		font-size: 0.88rem;
	}

	.assign-box select {
		width: 100%;
		padding: 10px;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.photos-section {
		margin-top: 18px;
		border-top: 1px solid var(--color-border);
		padding-top: 14px;
	}

	.photos-section h4 {
		margin: 0 0 10px;
	}

	.photos-gallery {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 8px;
	}

	.photo-thumb {
		position: relative;
		aspect-ratio: 1;
		border-radius: 4px;
		overflow: hidden;
		background: #eee;
	}

	.photo-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.photo-badge {
		position: absolute;
		bottom: 4px;
		left: 4px;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		font-size: 0.65rem;
		padding: 2px 4px;
		border-radius: 2px;
	}

	.photo-badge.after {
		background: rgba(46, 125, 50, 0.85);
	}

	.inspection-results {
		margin-top: 18px;
		border-top: 1px solid var(--color-border);
		padding-top: 14px;
	}

	.inspection-results ul {
		list-style: none;
		padding: 0;
		margin: 8px 0;
	}

	.inspection-results li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 0;
		border-bottom: 1px dashed var(--color-border);
		font-size: 0.88rem;
	}

	.it-res.ok {
		color: #2e7d32;
		font-weight: 700;
	}

	.it-res.problem {
		color: #c62828;
		font-weight: 700;
	}

	.alert {
		padding: 10px 14px;
		border-radius: 4px;
		margin-bottom: 14px;
		font-size: 0.88rem;
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

	.muted {
		color: var(--color-muted);
	}
</style>
