<script lang="ts">
	import type { TaskWithCategory } from '$lib/types';
	import { describeSchedule } from '$lib/utils/schedule';

	interface Props {
		task: TaskWithCategory;
		date?: string;
		showDate?: boolean;
		onEdit: () => void;
	}

	let { task, date, showDate = false, onEdit }: Props = $props();

	const schedule = $derived(describeSchedule(task));
</script>

<button
	type="button"
	onclick={onEdit}
	class="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-foreground/20"
>
	<div
		class="h-2.5 w-2.5 shrink-0 rounded-full"
		style="background-color: {task.category.color}"
	></div>
	<div class="min-w-0 flex-1">
		<p class="truncate text-sm font-medium text-foreground">{task.name}</p>
		<div class="mt-0.5 flex flex-wrap items-center gap-1.5">
			<span class="text-xs text-muted-foreground">{task.category.name}</span>
			{#if showDate && date}
				<span class="text-xs text-muted-foreground">·</span>
				<span class="text-xs text-muted-foreground">{date}</span>
			{/if}
			{#if schedule}
				<span class="text-xs text-muted-foreground">·</span>
				<span class="text-xs text-muted-foreground">{schedule}</span>
			{/if}
		</div>
	</div>
	<svg
		class="h-4 w-4 shrink-0 text-muted-foreground"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
	</svg>
</button>
