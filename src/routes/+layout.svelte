<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { user, initAuth } from '$lib/auth';
	import { onMount } from 'svelte';
	import Avatar from '$lib/components/ui/avatar/index.svelte';

	let { children } = $props();

	onMount(() => {
		initAuth();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if $user}
	<nav class="flex h-14 items-center justify-between border-b border-neutral-100 px-4">
		<a href="/" class="text-lg font-medium">Todo</a>
		<Avatar src={$user.user_metadata?.avatar_url} />
	</nav>
{/if}

{@render children()}
