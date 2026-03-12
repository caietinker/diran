<script lang="ts">
	import type { TodayTask } from '$lib/models/history.svelte';
	import { fly } from 'svelte/transition';

	interface Props {
		todayTask: TodayTask;
		onRestore: () => void;
		onEdit: () => void;
	}

	let { todayTask, onRestore, onEdit }: Props = $props();
</script>

<div
	transition:fly={{ x: 12, duration: 200 }}
	class="group flex items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-2.5 opacity-50 hover:opacity-80"
>
	<div
		class="h-2 w-2 shrink-0 rounded-full opacity-50"
		style="background-color: {todayTask.task.category.color}"
	></div>
	<button class="min-w-0 flex-1 text-left" onclick={onEdit}>
		<p class="truncate text-sm text-muted-foreground">{todayTask.task.name}</p>
	</button>
	<button
		onclick={onRestore}
		class="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
		>↩</button
	>
</div>
