<script lang="ts">
	interface Props {
		src?: string | null;
		alt?: string;
		class?: string;
	}

	let { src, alt = 'User', class: className = '' }: Props = $props();
</script>

<a href="/profile" class="block {className}">
	{#if src}
		<img {src} {alt} class="h-8 w-8 rounded-full object-cover" />
	{:else}
		<div class="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200">
			<svg class="h-5 w-5 text-neutral-500" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"
				/>
			</svg>
		</div>
	{/if}
</a>
