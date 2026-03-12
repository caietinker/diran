<script lang="ts">
	import type { TodayTask } from '$lib/models/history.svelte';
	import { fly, fade } from 'svelte/transition';

	interface Props {
		todayTask: TodayTask;
		formatShortTime: (seconds: number) => string;
		onRestore: () => void;
		onEdit: () => void;
	}

	let { todayTask, formatShortTime, onRestore, onEdit }: Props = $props();
</script>

<div
	transition:fly={{ x: 12, duration: 200 }}
	class="group flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5 opacity-60 hover:opacity-90"
>
	<div
		class="h-2 w-2 shrink-0 rounded-full"
		style="background-color: {todayTask.task.category.color}"
	></div>
	<button class="min-w-0 flex-1 text-left" onclick={onEdit}>
		<p class="truncate text-sm text-muted-foreground line-through">
			{todayTask.task.name}
		</p>
	</button>
	{#if todayTask.totalSessions > 0}
		<span class="text-xs text-muted-foreground">{formatShortTime(todayTask.totalSessions)}</span>
	{/if}
	<button
		onclick={onRestore}
		class="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
		>↩</button
	>
</div>
