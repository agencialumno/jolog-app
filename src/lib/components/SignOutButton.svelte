<script lang="ts">
	import { goto } from '$app/navigation';
	import { logout } from '../auth/session.svelte';

	async function signOut() {
		await logout();
		await goto('/entrar', { replaceState: true });
	}
</script>

<button type="button" onclick={signOut} style="margin-top: 20px; background: var(--color-secondary)">Sair</button>
