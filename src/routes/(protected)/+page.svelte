<script lang="ts">
	import { categories } from '$lib/models/categories.svelte';
	import { tasks } from '$lib/models/tasks.svelte';
	import { history, type TodayTask } from '$lib/models/history.svelte';
	import { sessions } from '$lib/models/sessions.svelte';
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
		await history.markDone(todayTask.task.id);
	}

	async function markSkipped(todayTask: TodayTask) {
		await history.markSkipped(todayTask.task.id);
	}

	async function restore(todayTask: TodayTask) {
		await history.restore(todayTask.task.id);
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

	// Derived lists
	const pending = $derived(history.todayTasks.filter((t) => t.status === 'pending'));
	const done = $derived(history.todayTasks.filter((t) => t.status === 'done'));
	const skipped = $derived(history.todayTasks.filter((t) => t.status === 'skipped'));

	// Separate undated vs dated
	const undatedPending = $derived(pending.filter((t) => !t.task.start_date && !t.task.end_date));
	const datedPending = $derived(pending.filter((t) => t.task.start_date || t.task.end_date));

	const undatedDone = $derived(done.filter((t) => !t.task.start_date && !t.task.end_date));
	const datedDone = $derived(done.filter((t) => t.task.start_date || t.task.end_date));

	const undatedSkipped = $derived(skipped.filter((t) => !t.task.start_date && !t.task.end_date));
	const datedSkipped = $derived(skipped.filter((t) => t.task.start_date || t.task.end_date));
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
			{#each Array(4) as _, i}
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
		<!-- UNDATED TASKS -->
		{#if undatedPending.length > 0 || undatedDone.length > 0 || undatedSkipped.length > 0}
			<div class="mb-8">
				<h2 class="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
					Always
				</h2>

				{#if undatedPending.length > 0}
					<div class="space-y-2">
						{#each undatedPending as todayTask (todayTask.task.id)}
							{@const isActive = sessions.active?.task_id === todayTask.task.id}
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
									<p class="text-xs text-muted-foreground">{todayTask.task.category.name}</p>
								</button>
								{#if isActive}
									<span class="shrink-0 font-mono text-sm font-medium text-primary"
										>{formatTime(elapsed)}</span
									>
								{/if}
								{#if todayTask.todaySessions > 0}
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

				{#if undatedDone.length > 0}
					<div class="mt-6" transition:fade={{ duration: 150 }}>
						<p class="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
							Done ({undatedDone.length})
						</p>
						<div class="space-y-1.5">
							{#each undatedDone as todayTask (todayTask.task.id)}
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
					</div>
				{/if}

				{#if undatedSkipped.length > 0}
					<div class="mt-4" transition:fade={{ duration: 150 }}>
						<p class="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
							Skipped ({undatedSkipped.length})
						</p>
						<div class="space-y-1.5">
							{#each undatedSkipped as todayTask (todayTask.task.id)}
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
					</div>
				{/if}
			</div>
		{/if}

		<!-- DATED TASKS -->
		{#if datedPending.length > 0 || datedDone.length > 0 || datedSkipped.length > 0}
			<div>
				<h2 class="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
					Dated
				</h2>

				{#if datedPending.length > 0}
					<div class="space-y-2">
						{#each datedPending as todayTask (todayTask.task.id)}
							{@const isActive = sessions.active?.task_id === todayTask.task.id}
							{@const startStr = todayTask.task.start_date
								? new Date(todayTask.task.start_date * 1000).toLocaleDateString('en-GB', {
										day: '2-digit',
										month: 'short'
									})
								: ''}
							{@const endStr = todayTask.task.end_date
								? new Date(todayTask.task.end_date * 1000).toLocaleDateString('en-GB', {
										day: '2-digit',
										month: 'short'
									})
								: ''}
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
									<p class="text-xs text-muted-foreground">
										{todayTask.task.category.name}
										{#if startStr || endStr}
											<span class="ml-1 text-primary/70"
												>({startStr}{startStr && endStr ? ' → ' : ''}{endStr})</span
											>
										{/if}
									</p>
								</button>
								{#if isActive}
									<span class="shrink-0 font-mono text-sm font-medium text-primary"
										>{formatTime(elapsed)}</span
									>
								{/if}
								{#if todayTask.todaySessions > 0}
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

				{#if datedDone.length > 0}
					<div class="mt-6" transition:fade={{ duration: 150 }}>
						<p class="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
							Done ({datedDone.length})
						</p>
						<div class="space-y-1.5">
							{#each datedDone as todayTask (todayTask.task.id)}
								{@const startStr = todayTask.task.start_date
									? new Date(todayTask.task.start_date * 1000).toLocaleDateString('en-GB', {
											day: '2-digit',
											month: 'short'
										})
									: ''}
								{@const endStr = todayTask.task.end_date
									? new Date(todayTask.task.end_date * 1000).toLocaleDateString('en-GB', {
											day: '2-digit',
											month: 'short'
										})
									: ''}
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
										{#if startStr || endStr}
											<p class="text-xs text-primary/70">
												{startStr}{startStr && endStr ? ' → ' : ''}{endStr}
											</p>
										{/if}
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
					</div>
				{/if}

				{#if datedSkipped.length > 0}
					<div class="mt-4" transition:fade={{ duration: 150 }}>
						<p class="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
							Skipped ({datedSkipped.length})
						</p>
						<div class="space-y-1.5">
							{#each datedSkipped as todayTask (todayTask.task.id)}
								{@const startStr = todayTask.task.start_date
									? new Date(todayTask.task.start_date * 1000).toLocaleDateString('en-GB', {
											day: '2-digit',
											month: 'short'
										})
									: ''}
								{@const endStr = todayTask.task.end_date
									? new Date(todayTask.task.end_date * 1000).toLocaleDateString('en-GB', {
											day: '2-digit',
											month: 'short'
										})
									: ''}
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
										{#if startStr || endStr}
											<p class="text-xs text-primary/70">
												{startStr}{startStr && endStr ? ' → ' : ''}{endStr}
											</p>
										{/if}
									</button>
									<button
										onclick={() => restore(todayTask)}
										class="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
										>↩</button
									>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</main>
