<script lang="ts">
	import { categories } from '$lib/models/categories.svelte';
	import { tasks } from '$lib/models/tasks.svelte';
	import { sessions } from '$lib/models/sessions.svelte';
	import { progress } from '$lib/models/progress.svelte';
	import CategoryModal from '$lib/components/CategoryModal.svelte';
	import type { GoalType, GoalPeriod } from '$lib/types';

	let showAddModal = $state(false);

	$effect(() => {
		categories.fetch().then(async () => {
			await tasks.fetch();
			await progress.refresh();
		});
	});

	// Tick `now` every second only while a session is active, so the
	// categories page progress bars update in real-time.
	let now = $state(Math.floor(Date.now() / 1000));
	$effect(() => {
		if (!sessions.active) return;
		const interval = setInterval(() => {
			now = Math.floor(Date.now() / 1000);
		}, 1000);
		return () => clearInterval(interval);
	});

	// Overlay live elapsed time on the DB snapshot for the active session's category.
	const liveValues = $derived.by(() => {
		const result: Record<string, { current: number; target: number }> = {};
		for (const cat of categories.items) {
			const base = progress.values[cat.id];
			if (!base) continue;
			if (cat.goal_type === 'seconds' && sessions.active) {
				const activeTask = tasks.items.find((t) => t.id === sessions.active!.task_id);
				if (activeTask?.category_id === cat.id) {
					result[cat.id] = {
						current: base.current + (now - sessions.active.started_at),
						target: base.target
					};
					continue;
				}
			}
			result[cat.id] = base;
		}
		return result;
	});

	async function onModalClose(changed: boolean) {
		showAddModal = false;
		if (changed) await progress.refresh();
	}

	function progressPercent(catId: string): number {
		const p = liveValues[catId];
		if (!p || p.target === 0) return 0;
		return Math.min(Math.round((p.current / p.target) * 100), 100);
	}

	function formatGoal(type: GoalType, value: number, period: GoalPeriod): string {
		if (type === 'times') return `${value}× / ${period}`;
		const h = Math.floor(value / 3600);
		const m = Math.floor((value % 3600) / 60);
		if (h > 0 && m > 0) return `${h}h ${m}m / ${period}`;
		if (h > 0) return `${h}h / ${period}`;
		return `${m}m / ${period}`;
	}

	function formatCurrent(type: GoalType, current: number): string {
		if (type === 'times') return `${current}`;
		const h = Math.floor(current / 3600);
		const m = Math.floor((current % 3600) / 60);
		if (h > 0 && m > 0) return `${h}h ${m}m`;
		if (h > 0) return `${h}h`;
		return `${m}m`;
	}
</script>

<!-- ── Modal ── -->
{#if showAddModal}
	<CategoryModal mode="add" onclose={onModalClose} />
{/if}

<main class="mx-auto max-w-2xl px-4 py-6">
	<!-- ── Header ── -->
	<div class="mb-6 flex items-end justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight text-foreground">Categories</h1>
			<p class="mt-0.5 text-sm text-muted-foreground">Organise your tasks by area of focus</p>
		</div>
		<button
			onclick={() => (showAddModal = true)}
			class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
		>
			+ New cat
		</button>
	</div>

	{#if categories.loading}
		<!-- Loading skeletons -->
		<div class="space-y-2">
			{#each Array(3) as _, i (i)}
				<div class="animate-pulse rounded-xl border border-border bg-card px-4 py-4">
					<div class="flex items-center gap-3">
						<div class="h-3 w-3 rounded-full bg-muted"></div>
						<div class="h-4 w-32 rounded bg-muted"></div>
						<div class="ml-auto h-3 w-8 rounded bg-muted"></div>
					</div>
					<div class="mt-3 h-1.5 rounded-full bg-muted"></div>
				</div>
			{/each}
		</div>
	{:else if categories.items.length === 0}
		<!-- Empty state -->
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
						d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
					/>
				</svg>
			</div>
			<p class="text-base font-medium text-foreground">No categories yet</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Create a category to start organising your tasks and tracking goals.
			</p>
			<button
				onclick={() => (showAddModal = true)}
				class="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
			>
				Create your first category
			</button>
		</div>
	{:else}
		<div class="space-y-2">
			{#each categories.items as cat (cat.id)}
				{@const pct = progressPercent(cat.id)}
				{@const p = liveValues[cat.id]}
				<a
					href="/categories/{cat.id}"
					class="block rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-foreground/20"
				>
					<div class="flex items-center gap-3">
						<div class="h-3 w-3 shrink-0 rounded-full" style="background-color: {cat.color}"></div>
						<div class="min-w-0 flex-1">
							<span class="text-sm font-medium text-foreground">{cat.name}</span>
						</div>
						<div class="flex items-center gap-3">
							{#if p}
								<span class="text-xs text-muted-foreground">
									{formatCurrent(cat.goal_type, p.current)} / {formatGoal(
										cat.goal_type,
										cat.goal_value,
										cat.goal_period
									)}
								</span>
							{/if}
							<span class="text-xs font-medium text-muted-foreground">{pct}%</span>
						</div>
					</div>
					<div class="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
						<div
							class="h-full rounded-full bg-primary transition-all duration-500"
							style="width: {pct}%"
						></div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</main>
