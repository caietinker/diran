<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import { goto } from '$app/navigation';

	let { children } = $props();

	$effect(() => {
		if (auth.ready && auth.user) {
			void goto('/');
		}
	});
</script>

{#if auth.ready && !auth.user}
	{@render children()}
{/if}
