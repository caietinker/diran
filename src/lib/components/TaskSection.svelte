<script lang="ts">
	import type { TodayTask } from '$lib/models/history.svelte';
	import TaskCard from './TaskCard.svelte';
	import TaskCardDone from './TaskCardDone.svelte';
	import TaskCardSkipped from './TaskCardSkipped.svelte';
	import { sessions } from '$lib/models/sessions.svelte';

	interface Props {
		label: string;
		sectionType: 'undated' | 'recurring' | 'scheduled';
		pending: TodayTask[];
		done: TodayTask[];
		skipped: TodayTask[];
		onToggleSession: (todayTask: TodayTask) => void;
		onMarkDone: (todayTask: TodayTask) => void;
		onMarkSkipped: (todayTask: TodayTask) => void;
		onRestore: (todayTask: TodayTask) => void;
		onEdit: (todayTask: TodayTask) => void;
		elapsed: number;
		formatTime: (seconds: number) => string;
		formatShortTime: (seconds: number) => string;
		describeSchedule: (task: TodayTask['task']) => string;
	}

	let {
		label,
		sectionType,
		pending,
		done,
		skipped,
		onToggleSession,
		onMarkDone,
		onMarkSkipped,
		onRestore,
		onEdit,
		elapsed,
		formatTime,
		formatShortTime,
		describeSchedule
	}: Props = $props();
</script>

{#if pending.length + done.length + skipped.length > 0}
	<div class="mb-8">
		<!-- Section header -->
		<div class="mb-3 flex items-center gap-2">
			<!-- Icon container -->
			<div
				class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full {sectionType ===
				'undated'
					? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
					: sectionType === 'recurring'
						? 'bg-primary/10 text-primary'
						: 'bg-violet-500/10 text-violet-600 dark:text-violet-400'}"
			>
				{#if sectionType === 'undated'}
					<svg class="h-2.5 w-2.5" viewBox="0 0 10 10" fill="currentColor">
						<circle cx="5" cy="5" r="4" />
					</svg>
				{:else if sectionType === 'recurring'}
					<svg
						class="h-2.5 w-2.5"
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
				{:else}
					<svg
						class="h-2.5 w-2.5"
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
			</div>

			<!-- Label -->
			<span class="shrink-0 text-xs font-semibold tracking-widest text-muted-foreground uppercase"
				>{label}</span
			>

			<!-- Pending count badge -->
			{#if pending.length > 0}
				<span
					class="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums"
					>{pending.length}</span
				>
			{/if}

			<!-- Divider -->
			<hr class="flex-1 border-t border-border/60" />
		</div>

		<!-- Pending tasks -->
		{#if pending.length > 0}
			<div class="space-y-2">
				{#each pending as todayTask (todayTask.task.id)}
					{@const isActive = sessions.active?.task_id === todayTask.task.id}
					<TaskCard
						{todayTask}
						{isActive}
						schedule={describeSchedule(todayTask.task)}
						{sectionType}
						{elapsed}
						{formatTime}
						{formatShortTime}
						onToggle={() => onToggleSession(todayTask)}
						onMarkDone={() => onMarkDone(todayTask)}
						onMarkSkipped={() => onMarkSkipped(todayTask)}
						onEdit={() => onEdit(todayTask)}
					/>
				{/each}
			</div>
		{/if}

		<!-- Done tasks -->
		{#if done.length > 0}
			<div class="mt-3 space-y-1.5">
				{#each done as todayTask (todayTask.task.id)}
					<TaskCardDone
						{todayTask}
						{formatShortTime}
						onRestore={() => onRestore(todayTask)}
						onEdit={() => onEdit(todayTask)}
					/>
				{/each}
			</div>
		{/if}

		<!-- Skipped tasks -->
		{#if skipped.length > 0}
			<div class="mt-3 space-y-1.5">
				{#each skipped as todayTask (todayTask.task.id)}
					<TaskCardSkipped
						{todayTask}
						onRestore={() => onRestore(todayTask)}
						onEdit={() => onEdit(todayTask)}
					/>
				{/each}
			</div>
		{/if}
	</div>
{/if}
