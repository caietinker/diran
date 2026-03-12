<script lang="ts">
	import { categories } from '$lib/models/categories.svelte';
	import { tasks } from '$lib/models/tasks.svelte';
	import { history, type TodayTask } from '$lib/models/history.svelte';
	import { sessions } from '$lib/models/sessions.svelte';
	import { progress } from '$lib/models/progress.svelte';
	import TaskModal from '$lib/components/TaskModal.svelte';
	import TaskSection from '$lib/components/TaskSection.svelte';
	import { describeSchedule, formatTime, formatShortTime } from '$lib/utils/schedule';

	// Timer
	let elapsed = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		loadData();
	});

	$effect(() => {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}

		if (sessions.active) {
			elapsed = Math.floor(Date.now() / 1000) - sessions.active.started_at;
			timerInterval = setInterval(() => {
				elapsed = Math.floor(Date.now() / 1000) - sessions.active!.started_at;
			}, 1000);
		} else {
			elapsed = 0;
		}

		return () => {
			if (timerInterval) {
				clearInterval(timerInterval);
				timerInterval = null;
			}
		};
	});

	// Modal state
	type ModalState = null | { mode: 'add' } | { mode: 'edit'; task: TodayTask };
	let modal = $state<ModalState>(null);

	// Data loading
	async function loadData() {
		await categories.fetch();
		await tasks.fetch();
		await history.fetchTodayTasks(tasks.items, categories.items);
		await sessions.checkActive();
	}

	// Session controls
	async function toggleSession(todayTask: TodayTask) {
		if (sessions.active?.task_id === todayTask.task.id) {
			await sessions.stop();
		} else {
			if (sessions.active) await sessions.stop();
			await sessions.start(todayTask.task.id);
		}
	}

	async function markDone(todayTask: TodayTask) {
		await history.markDone(todayTask.task.id, todayTask.task.repeat_freq === null);
		await progress.refreshCategory(todayTask.task.category_id);
	}

	async function markSkipped(todayTask: TodayTask) {
		await history.markSkipped(todayTask.task.id, todayTask.task.repeat_freq === null);
		await progress.refreshCategory(todayTask.task.category_id);
	}

	async function restore(todayTask: TodayTask) {
		await history.restore(todayTask.task.id, todayTask.task.repeat_freq === null);
		await progress.refreshCategory(todayTask.task.category_id);
	}

	async function onModalClose(changed: boolean) {
		modal = null;
		if (changed) await loadData();
	}

	function handleEditTask(todayTask: TodayTask) {
		modal = { mode: 'edit', task: todayTask };
	}

	function todayFormatted(): string {
		return new Date().toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		});
	}

	// Section groupings — split into Undated / Recurring / Scheduled
	const undatedTasks = $derived(
		history.todayTasks.filter((t) => !t.task.repeat_freq && !t.task.start_date)
	);
	const recurringTasks = $derived(history.todayTasks.filter((t) => !!t.task.repeat_freq));
	const scheduledTasks = $derived(
		history.todayTasks.filter((t) => !t.task.repeat_freq && !!t.task.start_date)
	);

	// Sub-groups per section
	const undatedPending = $derived(undatedTasks.filter((t) => t.status === 'pending'));
	const undatedDone = $derived(undatedTasks.filter((t) => t.status === 'done'));
	const undatedSkipped = $derived(undatedTasks.filter((t) => t.status === 'skipped'));

	const recurringPending = $derived(recurringTasks.filter((t) => t.status === 'pending'));
	const recurringDone = $derived(recurringTasks.filter((t) => t.status === 'done'));
	const recurringSkipped = $derived(recurringTasks.filter((t) => t.status === 'skipped'));

	const scheduledPending = $derived(scheduledTasks.filter((t) => t.status === 'pending'));
	const scheduledDone = $derived(scheduledTasks.filter((t) => t.status === 'done'));
	const scheduledSkipped = $derived(scheduledTasks.filter((t) => t.status === 'skipped'));
</script>

{#if modal !== null}
	{#if modal.mode === 'add'}
		<TaskModal mode="add" {elapsed} onclose={onModalClose} />
	{:else}
		<TaskModal mode="edit" task={modal.task.task} {elapsed} onclose={onModalClose} />
	{/if}
{/if}

<main class="mx-auto max-w-2xl px-4 py-6">
	<div class="mb-6 flex items-end justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight text-foreground">Today</h1>
			<p class="mt-0.5 text-sm text-muted-foreground">{todayFormatted()}</p>
		</div>
		<button
			onclick={() => (modal = { mode: 'add' })}
			class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
		>
			+ New task
		</button>
	</div>

	{#if history.loading}
		<div class="space-y-2">
			{#each Array(4) as _, i (i)}
				<div class="animate-pulse rounded-xl border border-border bg-card px-4 py-3">
					<div class="flex items-center gap-3">
						<div class="h-2.5 w-2.5 rounded-full bg-muted"></div>
						<div class="flex-1 space-y-1.5">
							<div class="h-3.5 w-40 rounded bg-muted"></div>
							<div class="h-3 w-24 rounded bg-muted"></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if history.todayTasks.length === 0}
		<div class="rounded-xl border border-border bg-card px-6 py-16 text-center">
			<div
				class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"
			>
				<svg
					class="h-7 w-7 text-primary"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
					/>
				</svg>
			</div>
			<p class="text-base font-medium text-foreground">Nothing scheduled for today</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Add a one-off task or <a href="/categories" class="text-primary hover:underline"
					>set up repeating tasks</a
				> in a category.
			</p>
			<button
				onclick={() => (modal = { mode: 'add' })}
				class="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
			>
				+ Add a task
			</button>
		</div>
	{:else}
		<TaskSection
			label="Undated"
			sectionType="undated"
			pending={undatedPending}
			done={undatedDone}
			skipped={undatedSkipped}
			onToggleSession={toggleSession}
			onMarkDone={markDone}
			onMarkSkipped={markSkipped}
			onRestore={restore}
			onEdit={handleEditTask}
			{elapsed}
			{formatTime}
			{formatShortTime}
			{describeSchedule}
		/>
		<TaskSection
			label="Recurring"
			sectionType="recurring"
			pending={recurringPending}
			done={recurringDone}
			skipped={recurringSkipped}
			onToggleSession={toggleSession}
			onMarkDone={markDone}
			onMarkSkipped={markSkipped}
			onRestore={restore}
			onEdit={handleEditTask}
			{elapsed}
			{formatTime}
			{formatShortTime}
			{describeSchedule}
		/>
		<TaskSection
			label="Scheduled"
			sectionType="scheduled"
			pending={scheduledPending}
			done={scheduledDone}
			skipped={scheduledSkipped}
			onToggleSession={toggleSession}
			onMarkDone={markDone}
			onMarkSkipped={markSkipped}
			onRestore={restore}
			onEdit={handleEditTask}
			{elapsed}
			{formatTime}
			{formatShortTime}
			{describeSchedule}
		/>
	{/if}
</main>
