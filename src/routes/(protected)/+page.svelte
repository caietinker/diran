<script lang="ts">
	import { categories } from '$lib/models/categories.svelte';
	import { tasks } from '$lib/models/tasks.svelte';
	import { history, type TodayTask } from '$lib/models/history.svelte';
	import { sessions } from '$lib/models/sessions.svelte';
	import { progress } from '$lib/models/progress.svelte';
	import TaskModal from '$lib/components/TaskModal.svelte';
	import { fly, fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';

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

	// Formatting
	function formatTime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	function formatShortTime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		if (h > 0) return `${h}h ${m}m`;
		if (m > 0) return `${m}m`;
		return '0m';
	}

	function todayFormatted(): string {
		return new Date().toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		});
	}

	// Schedule description helper
	function ordinal(n: number): string {
		const mod10 = n % 10;
		const mod100 = n % 100;
		if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
		if (mod10 === 1) return `${n}st`;
		if (mod10 === 2) return `${n}nd`;
		if (mod10 === 3) return `${n}rd`;
		return `${n}th`;
	}

	function joinDays(parts: string[]): string {
		if (parts.length === 0) return '';
		if (parts.length === 1) return parts[0];
		if (parts.length === 2) return `${parts[0]} & ${parts[1]}`;
		return parts.join(', ');
	}

	function describeSchedule(task: TodayTask['task']): string {
		if (task.repeat_freq === null && !task.start_date) return '';

		if (task.repeat_freq === null && task.start_date) {
			return new Date(task.start_date * 1000).toLocaleDateString('en-GB', {
				day: 'numeric',
				month: 'short'
			});
		}

		const interval = task.repeat_interval ?? 1;

		if (task.repeat_freq === 'daily') {
			return interval === 1 ? 'every day' : `every ${interval} days`;
		}

		if (task.repeat_freq === 'weekly') {
			const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
			const mask = task.repeat_weekdays ?? 0;
			const days: string[] = [];
			for (let i = 0; i < 7; i++) {
				if (mask & (1 << i)) days.push(dayNames[i]);
			}
			const base = joinDays(days);
			return interval === 1 ? base : `${base} · ${interval}wk`;
		}

		if (task.repeat_freq === 'monthly') {
			const mask = task.repeat_month_days ?? 0;
			const dayNums: number[] = [];
			for (let i = 0; i < 31; i++) {
				if (mask & (1 << i)) dayNums.push(i + 1);
			}
			let parts: string[];
			if (dayNums.length > 3) {
				const extra = dayNums.length - 2;
				parts = [ordinal(dayNums[0]), ordinal(dayNums[1]), `+${extra} more`];
			} else {
				parts = dayNums.map(ordinal);
			}
			const base = joinDays(parts);
			return interval === 1 ? base : `${base} · ${interval}mo`;
		}

		return '';
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

{#snippet taskSection(
	label: string,
	sectionType: 'undated' | 'recurring' | 'scheduled',
	pending: TodayTask[],
	done: TodayTask[],
	skipped: TodayTask[]
)}
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
						{@const schedule = describeSchedule(todayTask.task)}
						<div
							transition:fly={{ x: -12, duration: 200 }}
							animate:flip={{ duration: 200 }}
							class="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors {isActive
								? 'border-primary shadow-sm'
								: 'border-border hover:border-foreground/20'}"
						>
							<div
								class="h-2.5 w-2.5 shrink-0 rounded-full"
								style="background-color: {todayTask.task.category.color}"
							></div>
							<button
								class="min-w-0 flex-1 text-left"
								onclick={() => (modal = { mode: 'edit', task: todayTask })}
							>
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
								<span class="shrink-0 font-mono text-sm font-medium text-primary"
									>{formatTime(elapsed)}</span
								>
							{:else if todayTask.todaySessions > 0}
								<span class="shrink-0 text-xs text-muted-foreground"
									>{formatShortTime(todayTask.todaySessions)}</span
								>
							{/if}
							<div class="flex shrink-0 items-center gap-1">
								<button
									onclick={() => toggleSession(todayTask)}
									class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors {isActive
										? 'bg-primary text-white'
										: 'border border-border text-muted-foreground hover:border-foreground/30'}"
								>
									{isActive ? 'Stop' : 'Start'}
								</button>
								<button
									onclick={() => markDone(todayTask)}
									class="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:border-green-500/50 hover:text-green-600"
									>✓</button
								>
								<button
									onclick={() => markSkipped(todayTask)}
									class="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:border-amber-400/50 hover:text-amber-600"
									>–</button
								>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Done tasks -->
			{#if done.length > 0}
				<div class="mt-3 space-y-1.5" transition:fade={{ duration: 150 }}>
					{#each done as todayTask (todayTask.task.id)}
						<div
							transition:fly={{ x: 12, duration: 200 }}
							class="group flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5 opacity-60 hover:opacity-90"
						>
							<div
								class="h-2 w-2 shrink-0 rounded-full"
								style="background-color: {todayTask.task.category.color}"
							></div>
							<button
								class="min-w-0 flex-1 text-left"
								onclick={() => (modal = { mode: 'edit', task: todayTask })}
							>
								<p class="truncate text-sm text-muted-foreground line-through">
									{todayTask.task.name}
								</p>
							</button>
							{#if todayTask.totalSessions > 0}
								<span class="text-xs text-muted-foreground"
									>{formatShortTime(todayTask.totalSessions)}</span
								>
							{/if}
							<button
								onclick={() => restore(todayTask)}
								class="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
								>↩</button
							>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Skipped tasks -->
			{#if skipped.length > 0}
				<div class="mt-3 space-y-1.5" transition:fade={{ duration: 150 }}>
					{#each skipped as todayTask (todayTask.task.id)}
						<div
							transition:fly={{ x: 12, duration: 200 }}
							class="group flex items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-2.5 opacity-50 hover:opacity-80"
						>
							<div
								class="h-2 w-2 shrink-0 rounded-full opacity-50"
								style="background-color: {todayTask.task.category.color}"
							></div>
							<button
								class="min-w-0 flex-1 text-left"
								onclick={() => (modal = { mode: 'edit', task: todayTask })}
							>
								<p class="truncate text-sm text-muted-foreground">{todayTask.task.name}</p>
							</button>
							<button
								onclick={() => restore(todayTask)}
								class="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
								>↩</button
							>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

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
		{@render taskSection('Undated', 'undated', undatedPending, undatedDone, undatedSkipped)}
		{@render taskSection(
			'Recurring',
			'recurring',
			recurringPending,
			recurringDone,
			recurringSkipped
		)}
		{@render taskSection(
			'Scheduled',
			'scheduled',
			scheduledPending,
			scheduledDone,
			scheduledSkipped
		)}
	{/if}
</main>
