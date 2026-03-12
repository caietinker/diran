<script lang="ts">
	import { categories } from '$lib/models/categories.svelte';
	import { getGoalProgress } from '$lib/models/progress';
	import Button from '$lib/components/ui/button/index.svelte';
	import type { GoalType, GoalPeriod } from '$lib/types';

	let showForm = $state(false);
	let name = $state('');
	let color = $state('#ff6600');
	let goalType = $state<GoalType>('times');
	let goalTimes = $state(1);
	let goalHours = $state(0);
	let goalMinutes = $state(30);
	let goalPeriod = $state<GoalPeriod>('week');

	let progress = $state<Record<string, { current: number; target: number }>>({});

	$effect(() => {
		categories.fetch().then(() => loadProgress());
	});

	async function loadProgress() {
		const result: Record<string, { current: number; target: number }> = {};
		for (const cat of categories.items) {
			result[cat.id] = await getGoalProgress(cat);
		}
		progress = result;
	}

	function getGoalValue(): number {
		if (goalType === 'times') return goalTimes;
		return goalHours * 3600 + goalMinutes * 60;
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		await categories.add({
			name,
			color,
			goal_type: goalType,
			goal_value: getGoalValue(),
			goal_period: goalPeriod
		});
		name = '';
		color = '#ff6600';
		goalType = 'times';
		goalTimes = 1;
		goalHours = 0;
		goalMinutes = 30;
		goalPeriod = 'week';
		showForm = false;
		await loadProgress();
	}

	function formatGoal(type: GoalType, value: number, period: GoalPeriod): string {
		if (type === 'times') return `${value} time${value !== 1 ? 's' : ''} / ${period}`;
		const h = Math.floor(value / 3600);
		const m = Math.floor((value % 3600) / 60);
		if (h > 0 && m > 0) return `${h}h ${m}m / ${period}`;
		if (h > 0) return `${h}h / ${period}`;
		return `${m}m / ${period}`;
	}

	function progressPercent(catId: string): number {
		const p = progress[catId];
		if (!p || p.target === 0) return 0;
		return Math.min(Math.round((p.current / p.target) * 100), 100);
	}

	function formatCurrentProgress(type: GoalType, current: number): string {
		if (type === 'times') return `${current}`;
		const h = Math.floor(current / 3600);
		const m = Math.floor((current % 3600) / 60);
		if (h > 0 && m > 0) return `${h}h ${m}m`;
		if (h > 0) return `${h}h`;
		return `${m}m`;
	}
</script>

<main class="mx-auto max-w-xl p-6">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Categories</h1>
			<p class="mt-1 text-sm text-muted-foreground">Group tasks and track your goals</p>
		</div>
		<Button onclick={() => (showForm = !showForm)}>
			{showForm ? 'Cancel' : '+ New'}
		</Button>
	</div>

	{#if showForm}
		<form
			onsubmit={handleCreate}
			class="mb-8 space-y-5 rounded-xl border border-border bg-card p-5"
		>
			<div>
				<label for="cat-name" class="mb-2 block text-sm font-medium text-foreground"
					>Category Name</label
				>
				<input
					id="cat-name"
					type="text"
					bind:value={name}
					required
					class="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground transition-colors outline-none focus:border-ring"
					placeholder="e.g. Exercise, Reading, Meditation..."
				/>
			</div>

			<div class="space-y-2">
				<span class="text-sm font-medium text-foreground">Color</span>
				<div class="flex gap-2">
					{#each ['#ff6600', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#eab308', '#ec4899', '#14b8a6'] as c}
						<button
							type="button"
							onclick={() => (color = c)}
							aria-label="Select color {c}"
							class="h-7 w-7 rounded-full transition-transform hover:scale-110 {color === c
								? 'ring-2 ring-ring ring-offset-2'
								: ''}"
							style="background-color: {c}"
						></button>
					{/each}
				</div>
			</div>

			<div class="space-y-3 rounded-lg bg-muted/50 p-4">
				<fieldset class="space-y-2">
					<legend class="text-sm font-medium text-foreground">Goal Type</legend>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={() => (goalType = 'times')}
							class="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors {goalType ===
							'times'
								? 'bg-primary text-primary-foreground'
								: 'bg-background text-muted-foreground hover:bg-accent'}"
						>
							Times
						</button>
						<button
							type="button"
							onclick={() => (goalType = 'seconds')}
							class="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors {goalType ===
							'seconds'
								? 'bg-primary text-primary-foreground'
								: 'bg-background text-muted-foreground hover:bg-accent'}"
						>
							Duration
						</button>
					</div>
				</fieldset>

				{#if goalType === 'times'}
					<div class="flex items-center gap-3">
						<div class="flex-1">
							<label for="goal-times" class="mb-1.5 block text-sm text-muted-foreground"
								>Target</label
							>
							<input
								id="goal-times"
								type="number"
								min="1"
								bind:value={goalTimes}
								class="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground transition-colors outline-none focus:border-ring"
							/>
						</div>
						<div class="flex-1">
							<label for="goal-period-times" class="mb-1.5 block text-sm text-muted-foreground"
								>Per</label
							>
							<select
								id="goal-period-times"
								bind:value={goalPeriod}
								class="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground transition-colors outline-none focus:border-ring"
							>
								<option value="week">Week</option>
								<option value="month">Month</option>
								<option value="year">Year</option>
							</select>
						</div>
					</div>
				{:else}
					<div class="space-y-3">
						<div class="flex items-center gap-3">
							<div class="flex-1">
								<label for="goal-hours" class="mb-1.5 block text-sm text-muted-foreground"
									>Hours</label
								>
								<input
									id="goal-hours"
									type="number"
									min="0"
									bind:value={goalHours}
									class="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground transition-colors outline-none focus:border-ring"
								/>
							</div>
							<div class="flex-1">
								<label for="goal-minutes" class="mb-1.5 block text-sm text-muted-foreground"
									>Minutes</label
								>
								<input
									id="goal-minutes"
									type="number"
									min="0"
									max="59"
									bind:value={goalMinutes}
									class="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground transition-colors outline-none focus:border-ring"
								/>
							</div>
						</div>
						<div>
							<label for="goal-period-duration" class="mb-1.5 block text-sm text-muted-foreground"
								>Per</label
							>
							<select
								id="goal-period-duration"
								bind:value={goalPeriod}
								class="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground transition-colors outline-none focus:border-ring"
							>
								<option value="week">Week</option>
								<option value="month">Month</option>
								<option value="year">Year</option>
							</select>
						</div>
					</div>
				{/if}
			</div>

			<Button type="submit" class="w-full">Create Category</Button>
		</form>
	{/if}

	{#if categories.loading}
		<div class="flex justify-center py-12">
			<div
				class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
			></div>
		</div>
	{:else if categories.items.length === 0}
		<div class="rounded-xl border border-border bg-card p-12 text-center">
			<div class="mb-3 text-4xl">📁</div>
			<p class="font-medium text-foreground">No categories yet</p>
			<p class="mt-1 text-sm text-muted-foreground">Create your first category to get started</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each categories.items as cat (cat.id)}
				{@const pct = progressPercent(cat.id)}
				{@const p = progress[cat.id]}
				<a
					href="/categories/{cat.id}"
					class="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
				>
					<div class="flex items-start justify-between">
						<div class="flex items-center gap-3">
							<div
								class="h-10 w-10 rounded-xl shadow-sm"
								style="background-color: {cat.color}"
							></div>
							<div>
								<p class="font-semibold text-foreground">{cat.name}</p>
								<p class="text-sm text-muted-foreground">
									{formatGoal(cat.goal_type, cat.goal_value, cat.goal_period)}
								</p>
							</div>
						</div>
						<div class="text-right">
							<p class="text-2xl font-bold text-foreground">{pct}%</p>
							<p class="text-xs text-muted-foreground">
								{p ? formatCurrentProgress(cat.goal_type, p.current) : '0'} / {cat.goal_type ===
								'times'
									? cat.goal_value
									: formatCurrentProgress(cat.goal_type, cat.goal_value)}
							</p>
						</div>
					</div>
					<div class="mt-3 h-2 overflow-hidden rounded-full bg-muted">
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
