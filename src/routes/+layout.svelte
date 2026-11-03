<script lang="ts">
	import '@fontsource/barlow-condensed/600.css';
	import '@fontsource/barlow-condensed/700.css';
	import '@fontsource/inter/400.css';
	import '@fontsource/inter/600.css';
	import '../lib/styles/tokens.css';
	let { children } = $props();
</script>

<div class="safe">{@render children()}</div>
