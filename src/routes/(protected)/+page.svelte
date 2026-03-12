<script lang="ts">
	import { categories } from '$lib/models/categories.svelte';
	import { tasks } from '$lib/models/tasks.svelte';
	import { history, type TodayTask, type AllTasksItem } from '$lib/models/history.svelte';
	import { sessions } from '$lib/models/sessions.svelte';
	import { progress } from '$lib/models/progress.svelte';
	import TaskModal from '$lib/components/TaskModal.svelte';
	import TaskSection from '$lib/components/TaskSection.svelte';
	import TaskCardSimple from '$lib/components/TaskCardSimple.svelte';
	import { describeSchedule, formatTime, formatShortTime } from '$lib/utils/schedule';

	type ViewTab = 'today' | 'past' | 'future';

	// Timer
	let elapsed = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let activeTab = $state<ViewTab>('today');

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

	// Load all tasks when switching to past/future tabs
	$effect(() => {
		if (activeTab !== 'today' && history.allTasks.length === 0 && !history.loading) {
			history.fetchAllTasks(tasks.items, categories.items);
		}
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

	function handleEditPastTask(item: {
		task: AllTasksItem['task'];
		date: string;
		status: AllTasksItem['status'];
		totalSessions: number;
	}) {
		modal = {
			mode: 'edit',
			task: {
				task: item.task,
				status: item.status,
				totalSessions: item.totalSessions,
				todaySessions: 0
			}
		};
	}

	function handleEditFutureTask(task: AllTasksItem['task']) {
		modal = {
			mode: 'edit',
			task: {
				task,
				status: 'pending',
				totalSessions: 0,
				todaySessions: 0
			}
		};
	}

	function todayFormatted(): string {
		return new Date().toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		});
	}

	function getTodayDateStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	// Section groupings for Today view
	const undatedTasks = $derived(
		history.todayTasks.filter((t) => !t.task.repeat_freq && !t.task.start_date)
	);
	const recurringTasks = $derived(history.todayTasks.filter((t) => !!t.task.repeat_freq));
	const scheduledTasks = $derived(
		history.todayTasks.filter((t) => !t.task.repeat_freq && !!t.task.start_date)
	);

	const undatedPending = $derived(undatedTasks.filter((t) => t.status === 'pending'));
	const undatedDone = $derived(undatedTasks.filter((t) => t.status === 'done'));
	const undatedSkipped = $derived(undatedTasks.filter((t) => t.status === 'skipped'));

	const recurringPending = $derived(recurringTasks.filter((t) => t.status === 'pending'));
	const recurringDone = $derived(recurringTasks.filter((t) => t.status === 'done'));
	const recurringSkipped = $derived(recurringTasks.filter((t) => t.status === 'skipped'));

	const scheduledPending = $derived(scheduledTasks.filter((t) => t.status === 'pending'));
	const scheduledDone = $derived(scheduledTasks.filter((t) => t.status === 'done'));
	const scheduledSkipped = $derived(scheduledTasks.filter((t) => t.status === 'skipped'));

	// Past/Future filtering - group by unique task
	const todayStr = $derived(getTodayDateStr());

	const pastTasks = $derived.by(() => {
		const grouped = new Map<
			string,
			{
				task: AllTasksItem['task'];
				date: string;
				status: AllTasksItem['status'];
				totalSessions: number;
			}
		>();
		for (const t of history.allTasks) {
			if (t.date >= todayStr) continue;
			// Keep the most recent entry for each task
			if (!grouped.has(t.task.id) || t.date > grouped.get(t.task.id)!.date) {
				grouped.set(t.task.id, {
					task: t.task,
					date: t.date,
					status: t.status,
					totalSessions: t.totalSessions
				});
			}
		}
		return Array.from(grouped.values()).sort((a, b) => b.date.localeCompare(a.date));
	});

	const futureTasks = $derived.by(() => {
		// For future, just show each unique task once with its schedule
		const unique = new Map<string, AllTasksItem['task']>();
		for (const t of history.allTasks) {
			if (t.date <= todayStr) continue;
			if (!unique.has(t.task.id)) {
				unique.set(t.task.id, t.task);
			}
		}
		return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
	});
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
			<h1 class="text-2xl font-semibold tracking-tight text-foreground">Tasks</h1>
			<p class="mt-0.5 text-sm text-muted-foreground">{todayFormatted()}</p>
		</div>
		<button
			onclick={() => (modal = { mode: 'add' })}
			class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
		>
			+ New task
		</button>
	</div>

	<!-- Tab switcher -->
	<div class="mb-6 flex gap-1 rounded-lg bg-muted p-1">
		{#each [{ v: 'today', l: 'Today' }, { v: 'past', l: 'Past' }, { v: 'future', l: 'Future' }] as tab (tab.v)}
			<button
				onclick={() => (activeTab = tab.v as ViewTab)}
				class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {activeTab ===
				tab.v
					? 'bg-background text-foreground shadow-sm'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				{tab.l}
			</button>
		{/each}
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
	{:else if activeTab === 'today'}
		{#if history.todayTasks.length === 0}
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
	{:else if activeTab === 'past'}
		{#if pastTasks.length === 0}
			<div class="rounded-xl border border-border bg-card px-6 py-16 text-center">
				<p class="text-base font-medium text-foreground">No past tasks</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Completed and skipped tasks will appear here.
				</p>
			</div>
		{:else}
			<div class="space-y-1">
				{#each pastTasks as item (item.task.id)}
					<div class="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
						<TaskCardSimple
							task={item.task}
							date={item.date}
							showDate
							onEdit={() => handleEditPastTask(item)}
						/>
						<span
							class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {item.status === 'done'
								? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
								: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}"
						>
							{item.status}
						</span>
						{#if item.totalSessions > 0}
							<span class="shrink-0 text-xs text-muted-foreground"
								>{formatShortTime(item.totalSessions)}</span
							>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{:else if activeTab === 'future'}
		{#if futureTasks.length === 0}
			<div class="rounded-xl border border-border bg-card px-6 py-16 text-center">
				<p class="text-base font-medium text-foreground">No upcoming tasks</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Repeating tasks will appear here when scheduled.
				</p>
			</div>
		{:else}
			<div class="space-y-1">
				{#each futureTasks as task (task.id)}
					<TaskCardSimple {task} onEdit={() => handleEditFutureTask(task)} />
				{/each}
			</div>
		{/if}
	{/if}
</main>
