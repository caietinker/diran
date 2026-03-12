<script lang="ts">
	import { untrack } from 'svelte';
	import { categories } from '$lib/models/categories.svelte';
	import type { Category, GoalType, GoalPeriod } from '$lib/types';
	import Modal from '$lib/components/Modal.svelte';

	interface Props {
		mode: 'add' | 'edit';
		category?: Category | null;
		onclose: (changed: boolean) => void;
	}

	let { mode, category = null, onclose }: Props = $props();

	// ─── Colour palette ───────────────────────────────────────────────────────
	const COLOR_SWATCHES = [
		'#ff6600',
		'#22c55e',
		'#3b82f6',
		'#a855f7',
		'#ef4444',
		'#eab308',
		'#06b6d4',
		'#f97316'
	];

	// ─── Form state (captured at mount) ──────────────────────────────────────
	// Use untrack to read the initial prop values without creating a reactive
	// dependency, avoiding the state_referenced_locally warning.
	let editName = $state(untrack(() => category?.name ?? ''));
	let editColor = $state(untrack(() => category?.color ?? '#ff6600'));
	let editGoalType = $state<GoalType>(untrack(() => category?.goal_type ?? 'times'));
	let editGoalTimes = $state(
		untrack(() => (category?.goal_type === 'times' ? (category?.goal_value ?? 1) : 1))
	);
	let editGoalHours = $state(
		untrack(() =>
			category?.goal_type === 'seconds' ? Math.floor((category?.goal_value ?? 0) / 3600) : 0
		)
	);
	let editGoalMinutes = $state(
		untrack(() =>
			category?.goal_type === 'seconds' ? Math.floor(((category?.goal_value ?? 0) % 3600) / 60) : 30
		)
	);
	let editGoalPeriod = $state<GoalPeriod>(untrack(() => category?.goal_period ?? 'week'));

	let saving = $state(false);
	let deleting = $state(false);
	let saveError = $state('');

	// ─── Save ─────────────────────────────────────────────────────────────────
	async function handleSave() {
		if (!editName.trim()) {
			saveError = 'Category name is required.';
			return;
		}
		saveError = '';
		saving = true;

		const goal_value =
			editGoalType === 'times' ? editGoalTimes : editGoalHours * 3600 + editGoalMinutes * 60;

		const payload = {
			name: editName.trim(),
			color: editColor,
			goal_type: editGoalType,
			goal_value,
			goal_period: editGoalPeriod
		};

		if (mode === 'add') {
			await categories.add(payload);
		} else if (category) {
			await categories.update(category.id, payload);
		}

		saving = false;
		onclose(true);
	}

	// ─── Delete ───────────────────────────────────────────────────────────────
	async function handleDelete() {
		if (!category) return;
		deleting = true;
		await categories.remove(category.id);
		deleting = false;
		onclose(true);
	}
</script>

<Modal
	title={mode === 'add' ? 'New category' : (category?.name ?? 'Category')}
	color={editColor}
	maxHeight="min(90vh, 560px)"
	onclose={() => onclose(false)}
>
	{#snippet footer()}
		{#if mode === 'edit'}
			<button
				type="button"
				onclick={handleDelete}
				disabled={deleting}
				class="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
			>
				{deleting ? 'Deleting…' : 'Delete category'}
			</button>
		{/if}
		<div class="flex-1"></div>
		<button
			type="button"
			onclick={() => onclose(false)}
			class="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
		>
			Cancel
		</button>
		<button
			type="button"
			onclick={handleSave}
			disabled={saving}
			class="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
		>
			{saving ? 'Saving…' : mode === 'add' ? 'Create category' : 'Save changes'}
		</button>
	{/snippet}

	<div class="space-y-4">
		<!-- Name -->
		<div class="space-y-1.5">
			<label
				for="cat-name"
				class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
			>
				Name
			</label>
			<input
				id="cat-name"
				type="text"
				bind:value={editName}
				placeholder="e.g. Fitness"
				class="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
			/>
		</div>

		<!-- Color swatches -->
		<div class="space-y-1.5">
			<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Color</p>
			<div class="flex flex-wrap gap-2">
				{#each COLOR_SWATCHES as swatch (swatch)}
					<button
						type="button"
						onclick={() => (editColor = swatch)}
						class="h-7 w-7 rounded-full transition-all {editColor === swatch
							? 'ring-2 ring-foreground/60 ring-offset-2'
							: 'hover:scale-110'}"
						style="background-color: {swatch}"
						aria-label="Select color {swatch}"
					></button>
				{/each}
			</div>
		</div>

		<!-- Goal type toggle -->
		<div class="space-y-1.5">
			<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Goal type</p>
			<div class="grid grid-cols-2 gap-1.5">
				{#each [{ v: 'times', l: 'Times' }, { v: 'seconds', l: 'Duration' }] as opt (opt.v)}
					<button
						type="button"
						onclick={() => (editGoalType = opt.v as GoalType)}
						class="rounded-lg border py-2 text-sm font-medium transition-all {editGoalType === opt.v
							? 'border-primary bg-primary/10 text-primary'
							: 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}"
					>
						{opt.l}
					</button>
				{/each}
			</div>
		</div>

		<!-- Goal value -->
		<div class="space-y-1.5">
			<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Goal</p>

			{#if editGoalType === 'times'}
				<!-- Times + period -->
				<div class="flex items-center gap-2">
					<input
						type="number"
						min="1"
						bind:value={editGoalTimes}
						class="w-20 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
					/>
					<span class="text-sm text-muted-foreground">per</span>
					<select
						bind:value={editGoalPeriod}
						class="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
					>
						<option value="week">Week</option>
						<option value="month">Month</option>
						<option value="year">Year</option>
					</select>
				</div>
			{:else}
				<!-- Hours + minutes + period -->
				<div class="flex items-center gap-2">
					<input
						type="number"
						min="0"
						bind:value={editGoalHours}
						placeholder="0"
						class="w-16 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
					/>
					<span class="text-sm text-muted-foreground">h</span>
					<input
						type="number"
						min="0"
						max="59"
						bind:value={editGoalMinutes}
						placeholder="30"
						class="w-16 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
					/>
					<span class="text-sm text-muted-foreground">m per</span>
					<select
						bind:value={editGoalPeriod}
						class="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
					>
						<option value="week">Week</option>
						<option value="month">Month</option>
						<option value="year">Year</option>
					</select>
				</div>
			{/if}
		</div>

		<!-- Error message -->
		{#if saveError}
			<p class="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{saveError}
			</p>
		{/if}
	</div>
</Modal>
