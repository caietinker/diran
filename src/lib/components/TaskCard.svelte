<script lang="ts">
	import type { TodayTask } from '$lib/models/history.svelte';
	import { fly } from 'svelte/transition';

	interface Props {
		todayTask: TodayTask;
		isActive: boolean;
		schedule: string;
		sectionType: 'undated' | 'recurring' | 'scheduled';
		elapsed: number;
		formatTime: (seconds: number) => string;
		formatShortTime: (seconds: number) => string;
		onToggle: () => void;
		onMarkDone: () => void;
		onMarkSkipped: () => void;
		onEdit: () => void;
	}

	let {
		todayTask,
		isActive,
		schedule,
		sectionType,
		elapsed,
		formatTime,
		formatShortTime,
		onToggle,
		onMarkDone,
		onMarkSkipped,
		onEdit
	}: Props = $props();
</script>

<div
	transition:fly={{ x: -12, duration: 200 }}
	class="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors {isActive
		? 'border-primary shadow-sm'
		: 'border-border hover:border-foreground/20'}"
>
	<div
		class="h-2.5 w-2.5 shrink-0 rounded-full"
		style="background-color: {todayTask.task.category.color}"
	></div>
	<button class="min-w-0 flex-1 text-left" onclick={onEdit}>
		<p class="truncate text-sm font-medium text-foreground">{todayTask.task.name}</p>
		<div class="mt-0.5 flex flex-wrap items-center gap-1.5">
			<span class="text-xs text-muted-foreground">{todayTask.task.category.name}</span>
			{#if schedule}
				<span
					class="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground/80"
				>
					{#if sectionType === 'recurring'}
						<svg
							class="h-2.5 w-2.5 shrink-0"
							fill="none"
							viewBox="0 0 14 14"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M12.5 4C11.1 2 9.2 1 7 1a6 6 0 100 12c2.2 0 4.1-1 5.5-3" />
							<polyline points="10.5 1.5 12.5 4 10.5 6.5" />
						</svg>
					{:else if sectionType === 'scheduled'}
						<svg
							class="h-2.5 w-2.5 shrink-0"
							fill="none"
							viewBox="0 0 14 14"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<rect x="1.5" y="2.5" width="11" height="10" rx="1.5" />
							<path d="M4.5 1v3M9.5 1v3M1.5 6.5h11" />
						</svg>
					{/if}
					{schedule}
				</span>
			{/if}
		</div>
	</button>
	{#if isActive}
		<span class="shrink-0 font-mono text-sm font-medium text-primary">{formatTime(elapsed)}</span>
	{:else if todayTask.todaySessions > 0}
		<span class="shrink-0 text-xs text-muted-foreground"
			>{formatShortTime(todayTask.todaySessions)}</span
		>
	{/if}
	<div class="flex shrink-0 items-center gap-1">
		<button
			onclick={onToggle}
			class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors {isActive
				? 'bg-primary text-white'
				: 'border border-border text-muted-foreground hover:border-foreground/30'}"
		>
			{isActive ? 'Stop' : 'Start'}
		</button>
		<button
			onclick={onMarkDone}
			class="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:border-green-500/50 hover:text-green-600"
			>✓</button
		>
		<button
			onclick={onMarkSkipped}
			class="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:border-amber-400/50 hover:text-amber-600"
			>–</button
		>
	</div>
</div>
