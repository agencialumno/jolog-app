<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { api } from '../../lib/api';
	import { logout, session } from '../../lib/auth/session.svelte';
	import { sacUrl } from '../../lib/whatsapp';

	interface Property {
		id: string;
		address: string;
		condominium: string | null;
		block?: string | null;
		apartment?: string | null;
		bedrooms: 2 | 3;
	}

	let name = $state('');
	let phone = $state<string | null>(null);
	let property = $state<Property | null>(null);
	let showDeleteModal = $state(false);
	let deletingAccount = $state(false);
	let deleteError = $state('');

	const sac = sacUrl();
	const roleLabel = { cliente: 'Cliente', equipe: 'Equipe', admin: 'Administrador' } as const;

	onMount(async () => {
		try {
			const me = await api<{ name: string; phone: string | null }>('/api/me');
			name = me.name;
			phone = me.phone;
		} catch {
			/* mostra só o e-mail */
		}
		try {
			const props = await api<Property[]>('/api/properties');
			if (props.length) property = props[0];
		} catch {
			/* ignora */
		}
	});

	async function signOut() {
		await logout();
		await goto('/entrar', { replaceState: true });
	}

	async function handleDeleteAccount() {
		if (deletingAccount) return;
		deletingAccount = true;
		deleteError = '';
		try {
			await api('/api/me', { method: 'DELETE' });
			await logout();
			await goto('/entrar', { replaceState: true });
		} catch (e) {
			deleteError = e instanceof Error ? e.message : 'Não foi possível excluir a conta. Tente novamente.';
			deletingAccount = false;
		}
	}
</script>

<svelte:head><title>Minha Conta · Jolog</title></svelte:head>

<section class="conta">
	<h1>Minha conta</h1>

	<div class="card-section">
		<h2>Dados pessoais</h2>
		<dl class="details">
			{#if name}
				<dt>Nome</dt>
				<dd>{name}</dd>
			{/if}
			<dt>E-mail</dt>
			<dd>{session.email}</dd>
			{#if phone}
				<dt>Telefone</dt>
				<dd>{phone}</dd>
			{/if}
			{#if session.role}
				<dt>Tipo de conta</dt>
				<dd>{roleLabel[session.role]}</dd>
			{/if}
		</dl>
	</div>

	<div class="card-section">
		<div class="section-head">
			<h2>Meu imóvel</h2>
			<a href="/completar-cadastro?next=/conta" class="edit-btn">
				{property ? 'Alterar' : 'Cadastrar'}
			</a>
		</div>

		{#if property}
			<div class="property-box">
				<strong>{property.condominium ? `Condomínio ${property.condominium}` : property.address}</strong>
				<span class="subtext">
					{[property.block && `Bloco ${property.block}`, property.apartment && `Apto ${property.apartment}`]
						.filter(Boolean)
						.join(' · ') || property.address}
				</span>
				<span class="subtext">{property.bedrooms} quartos</span>
			</div>
		{:else}
			<p class="empty-text">Nenhum imóvel cadastrado ainda.</p>
		{/if}
	</div>

	<div class="card-section">
		<h2>Informações legais</h2>
		<div class="legal-links">
			<a href="/termos" class="legal-item">
				<span>Termos e Condições de Uso</span>
				<span class="arrow">→</span>
			</a>
			<a href="/privacidade" class="legal-item">
				<span>Política de Privacidade (LGPD)</span>
				<span class="arrow">→</span>
			</a>
		</div>
	</div>

	<div class="actions">
		{#if sac}
			<a class="btn sac" href={sac} target="_blank" rel="noopener noreferrer">Falar com o SAC pelo WhatsApp</a>
		{/if}
		<button type="button" class="btn btn-signout" onclick={signOut}>Sair da conta</button>

		{#if session.role === 'cliente'}
			<button type="button" class="btn-delete" onclick={() => (showDeleteModal = true)}> Excluir minha conta </button>
		{/if}
	</div>
</section>

<!-- Modal de Confirmação de Exclusão de Conta -->
{#if showDeleteModal}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		onclick={() => (showDeleteModal = false)}
		onkeydown={(e) => e.key === 'Escape' && (showDeleteModal = false)}
	>
		<div
			class="modal-dialog"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="modal-header">
				<h3>Excluir conta</h3>
			</div>
			<div class="modal-body">
				<p>Tem certeza de que deseja excluir permanentemente sua conta Jolog?</p>
				<p class="delete-warning">
					Esta ação removerá seus dados cadastrais, imóveis salvos e histórico do aplicativo de forma definitiva.
				</p>
				{#if deleteError}
					<p class="error-msg">{deleteError}</p>
				{/if}
			</div>
			<div class="modal-footer">
				<button type="button" class="btn-cancel" onclick={() => (showDeleteModal = false)} disabled={deletingAccount}>
					Cancelar
				</button>
				<button type="button" class="btn-confirm-delete" onclick={handleDeleteAccount} disabled={deletingAccount}>
					{deletingAccount ? 'Excluindo…' : 'Sim, excluir'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.conta {
		display: grid;
		gap: 18px;
	}
	h1 {
		font-size: 1.45rem;
		margin: 0;
		color: var(--color-text);
		font-weight: 700;
	}
	.card-section {
		display: grid;
		gap: 10px;
		padding: 16px;
		background: var(--color-surface);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius);
	}
	.card-section h2 {
		font-size: 1.05rem;
		color: var(--color-text);
		margin: 0;
		font-weight: 700;
	}
	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.edit-btn {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--color-primary);
		text-decoration: underline;
	}
	.details {
		display: grid;
		grid-template-columns: 100px 1fr;
		gap: 8px 14px;
		margin: 4px 0 0;
	}
	.details dt {
		font-size: 0.85rem;
		color: var(--color-muted);
	}
	.details dd {
		margin: 0;
		font-weight: 600;
		font-size: 0.92rem;
		color: var(--color-text);
	}
	.property-box {
		display: grid;
		gap: 2px;
		margin-top: 4px;
	}
	.property-box strong {
		font-size: 0.95rem;
		color: var(--color-text);
	}
	.subtext {
		font-size: 0.85rem;
		color: var(--color-muted);
	}
	.empty-text {
		font-size: 0.88rem;
		color: var(--color-muted);
		margin: 0;
	}

	.legal-links {
		display: grid;
		gap: 6px;
	}
	.legal-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-text);
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 600;
		border: 1px solid var(--color-border);
		transition: background 0.15s ease;
	}
	.legal-item:hover {
		background: #f0f0f4;
	}
	.arrow {
		color: var(--color-muted);
	}

	.actions {
		display: grid;
		gap: 10px;
		margin-top: 8px;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 12px;
		border-radius: var(--radius-sm);
		font-weight: 700;
		font-size: 0.95rem;
		cursor: pointer;
		font-family: inherit;
		text-decoration: none;
		min-height: 44px;
		box-sizing: border-box;
	}
	.sac {
		background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
		color: white;
	}
	.btn-signout {
		background: #f4f4f7;
		color: var(--color-text);
		border: 1.5px solid var(--color-border);
	}
	.btn-delete {
		background: none;
		border: none;
		color: #991b1b;
		font-size: 0.85rem;
		font-weight: 600;
		padding: 8px;
		cursor: pointer;
		text-decoration: underline;
		margin-top: 6px;
	}

	/* Modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: grid;
		place-items: center;
		padding: 16px;
		z-index: 1000;
	}
	.modal-dialog {
		background: white;
		border-radius: var(--radius);
		padding: 20px;
		max-width: 400px;
		width: 100%;
		display: grid;
		gap: 14px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
	}
	.modal-header h3 {
		margin: 0;
		font-size: 1.2rem;
		color: #991b1b;
	}
	.modal-body p {
		margin: 0 0 8px;
		font-size: 0.92rem;
		line-height: 1.4;
	}
	.delete-warning {
		color: var(--color-muted);
		font-size: 0.85rem !important;
	}
	.error-msg {
		color: #991b1b;
		font-size: 0.85rem;
	}
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 6px;
	}
	.btn-cancel {
		background: #e5e7eb;
		border: none;
		border-radius: var(--radius-sm);
		padding: 10px 16px;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-confirm-delete {
		background: #991b1b;
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		padding: 10px 16px;
		font-weight: 700;
		cursor: pointer;
	}
</style>
