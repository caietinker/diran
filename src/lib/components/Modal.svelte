<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		color?: string;
		maxWidth?: string;
		maxHeight?: string;
		noPadding?: boolean;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
	}

	let {
		title,
		color,
		maxWidth = 'max-w-lg',
		maxHeight = 'min(90vh, 560px)',
		noPadding = false,
		onclose,
		children,
		footer
	}: Props = $props();

	function onBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).dataset.backdrop) onclose();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Backdrop -->
<div
	role="presentation"
	transition:fade={{ duration: 150 }}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
	data-backdrop="1"
	onclick={onBackdropClick}
>
	<!-- Panel -->
	<div
		transition:scale={{ duration: 200, start: 0.95 }}
		class="relative flex w-full {maxWidth} flex-col rounded-xl border border-border bg-card shadow-2xl"
		style="max-height: {maxHeight};"
	>
		<!-- Header -->
		<div class="flex items-center gap-3 border-b border-border px-5 py-4">
			{#if color}
				<div class="h-3 w-3 shrink-0 rounded-full" style="background-color: {color}"></div>
			{/if}
			<h2 class="flex-1 text-base font-semibold text-foreground">{title}</h2>
			<button
				onclick={() => onclose()}
				class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				aria-label="Close"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path
						d="M3 3l10 10M13 3L3 13"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
				</svg>
			</button>
		</div>

		<!-- Body (scrollable) -->
		<div
			class={noPadding
				? 'flex flex-1 flex-col overflow-hidden'
				: 'flex-1 overflow-y-auto px-5 py-4'}
		>
			{@render children()}
		</div>

		<!-- Footer (optional) -->
		{#if footer}
			<div class="flex items-center gap-2 border-t border-border px-5 py-4">
				{@render footer()}
			</div>
		{/if}
	</div>
</div>
