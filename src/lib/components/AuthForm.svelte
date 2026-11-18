<script lang="ts">
	import { goto } from '$app/navigation';
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
	let show = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = validateCredentials({ email, password, name }, mode) ?? '';
		if (error) return;
		busy = true;
		try {
			if (signup) {
				await register(email, password, { name, phone });
				if (session.role) {
					await goto('/completar-cadastro', { replaceState: true });
					return;
				}
			} else {
				await login(email, password);
			}
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
	<h1>{signup ? 'Criar conta' : 'Entrar'}</h1>
	<form onsubmit={submit} novalidate>
		{#if signup}
			<label>Nome<input bind:value={name} autocomplete="name" required /></label>
			<label>Telefone (opcional)<input bind:value={phone} type="tel" autocomplete="tel" inputmode="tel" /></label>
		{/if}
		<label>E-mail<input bind:value={email} type="email" autocomplete="email" inputmode="email" required /></label>
		<label for="pw">Senha</label>
		<div class="pw">
			<input
				id="pw"
				bind:value={password}
				type={show ? 'text' : 'password'}
				autocomplete={signup ? 'new-password' : 'current-password'}
				required
			/>
			<button type="button" class="toggle" onclick={() => (show = !show)} aria-pressed={show}>
				{show ? 'Ocultar' : 'Mostrar'}
			</button>
		</div>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if signup}
			<p class="terms-notice">
				Ao criar uma conta, você concorda com nossos <a href="/termos">Termos de Uso</a> e
				<a href="/privacidade">Política de Privacidade</a>.
			</p>
		{/if}
		<button type="submit" disabled={busy}>{busy ? 'Aguarde…' : signup ? 'Criar conta' : 'Entrar'}</button>
	</form>
	<p class="alt">
		{#if signup}Já tem conta? <a href="/entrar{page.url.search}">Entrar</a>{:else}Ainda não tem conta?
			<a href="/cadastrar{page.url.search}">Cadastre-se</a>{/if}
	</p>
</main>

<style>
	.terms-notice {
		font-size: 12px;
		color: var(--color-muted);
		text-align: center;
		margin: 2px 0 0;
		line-height: 1.4;
	}
	.terms-notice a {
		color: var(--color-primary);
		text-decoration: underline;
		font-weight: 600;
	}

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
	.pw {
		position: relative;
		display: grid;
	}
	.pw input {
		padding-right: 96px;
	}
	.toggle {
		position: absolute;
		right: 4px;
		top: 2px;
		bottom: 2px;
		min-height: 44px;
		background: transparent;
		color: var(--color-primary);
		box-shadow: none;
		font-size: 14px;
	}
</style>
