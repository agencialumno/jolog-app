<script lang="ts">
	import { page } from '$app/state';
	import { authErrorMessage, validateCredentials } from '../auth/errors';
	import { login, register, session } from '../auth/session.svelte';

	let { mode }: { mode: 'entrar' | 'cadastrar' } = $props();
	const signup = $derived(mode === 'cadastrar');

	let name = $state('');
	let phone = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = validateCredentials({ email, password, name }, mode) ?? '';
		if (error) return;
		busy = true;
		try {
			if (signup) await register(email, password, { name, phone });
			else await login(email, password);
			if (!session.role) {
				error = 'Não conseguimos carregar o seu perfil. Tente novamente.';
				return;
			}
			// o redirecionamento (inclusive ?next=) e feito pela guarda do layout
		} catch (err) {
			error = authErrorMessage(err);
		} finally {
			busy = false;
		}
	}
</script>

<main class="page">
	<img src="/logo.png" alt="Grupo Jolog" width="96" />
	<h1>{signup ? 'Criar conta' : 'Entrar'}</h1>
	<form onsubmit={submit} novalidate>
		{#if signup}
			<label>Nome<input bind:value={name} autocomplete="name" required /></label>
			<label>Telefone (opcional)<input bind:value={phone} type="tel" autocomplete="tel" inputmode="tel" /></label>
		{/if}
		<label>E-mail<input bind:value={email} type="email" autocomplete="email" inputmode="email" required /></label>
		<label
			>Senha<input
				bind:value={password}
				type="password"
				autocomplete={signup ? 'new-password' : 'current-password'}
				required
			/></label
		>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<button type="submit" disabled={busy}>{busy ? 'Aguarde…' : signup ? 'Criar conta' : 'Entrar'}</button>
	</form>
	<p class="alt">
		{#if signup}Já tem conta? <a href="/entrar{page.url.search}">Entrar</a>{:else}Ainda não tem conta?
			<a href="/cadastrar{page.url.search}">Cadastre-se</a>{/if}
	</p>
</main>

<style>
	.page {
		max-width: 480px;
		margin: 0 auto;
		padding: 24px 20px;
	}
	form {
		display: grid;
		gap: 14px;
		margin-top: 20px;
	}
	label {
		display: grid;
		gap: 6px;
		font-weight: 600;
		font-size: 14px;
	}
	input {
		min-height: 48px;
		padding: 0 14px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font: 400 16px var(--font-body);
	}
	.error {
		margin: 0;
		color: var(--color-primary-dark);
		font-weight: 600;
	}
	button:disabled {
		opacity: 0.6;
	}
	.alt {
		text-align: center;
		margin-top: 20px;
	}
	.alt a {
		color: var(--color-primary);
		font-weight: 600;
	}
</style>
