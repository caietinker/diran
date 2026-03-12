<script lang="ts">
	import { categories } from '$lib/models/categories.svelte';
	import { tasks } from '$lib/models/tasks.svelte';
	import { instances } from '$lib/models/instances.svelte';
	import { sessions } from '$lib/models/sessions.svelte';
	import TaskModal from '$lib/components/TaskModal.svelte';
	import type { InstanceWithTask } from '$lib/types';
	import { fly, fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';

	// ─── Timer ────────────────────────────────────────────────────────────────
	let elapsed = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		loadData();
		return () => {
			if (timerInterval) clearInterval(timerInterval);
		};
	});

	$effect(() => {
		if (sessions.active) {
			timerInterval = setInterval(() => {
				elapsed = Math.floor(Date.now() / 1000) - sessions.active!.started_at;
			}, 1000);
		} else {
			if (timerInterval) clearInterval(timerInterval);
			timerInterval = null;
			elapsed = 0;
		}
	});

	// ─── Modal state ──────────────────────────────────────────────────────────
	// null = closed; { mode: 'add' } = new task; { mode: 'edit', inst } = editing existing
	type ModalState = null | { mode: 'add' } | { mode: 'edit'; inst: InstanceWithTask };

	let modal = $state<ModalState>(null);

	// ─── Data loading ─────────────────────────────────────────────────────────
	async function loadData() {
		await categories.fetch();
		await tasks.fetch();
		await instances.ensureTodayInstances();
		await instances.fetchTimeline();
		await sessions.checkActive();
	}

	// ─── Session controls ─────────────────────────────────────────────────────
	async function toggleSession(inst: InstanceWithTask) {
		if (sessions.active?.instance_id === inst.id) {
			await sessions.stop();
		} else {
			if (sessions.active) await sessions.stop();
			await sessions.start(inst.id);
		}
	}

	async function markDone(inst: InstanceWithTask) {
		if (sessions.active?.instance_id === inst.id) await sessions.stop();
		await instances.markDone(inst.id);
	}

	async function markSkipped(inst: InstanceWithTask) {
		if (sessions.active?.instance_id === inst.id) await sessions.stop();
		await instances.markSkipped(inst.id);
	}

	async function restore(inst: InstanceWithTask) {
		await instances.restore(inst.id);
	}

	// ─── Modal close handler ──────────────────────────────────────────────────
	async function onModalClose(changed: boolean) {
		modal = null;
		if (changed) await loadData();
	}

	// ─── Formatting ──────────────────────────────────────────────────────────
	function formatTime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	function todayFormatted(): string {
		return new Date().toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		});
	}

	// ─── Derived lists ────────────────────────────────────────────────────────
	const pending = $derived(instances.items.filter((i) => i.status === 'pending'));
	const done = $derived(instances.items.filter((i) => i.status === 'done'));
	const skipped = $derived(instances.items.filter((i) => i.status === 'skipped'));
</script>

<!-- ── Modal (portal-style, mounted outside the page container) ── -->
{#if modal !== null}
	{#if modal.mode === 'add'}
		<TaskModal mode="add" {elapsed} onclose={onModalClose} />
	{:else}
		<TaskModal
			mode="edit"
			task={modal.inst.task}
			instance={modal.inst}
			{elapsed}
			onclose={onModalClose}
		/>
	{/if}
{/if}

<main class="mx-auto max-w-2xl px-4 py-6">
	<!-- ── Page header ── -->
	<div class="mb-6 flex items-end justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight text-foreground">Today</h1>
			<p class="mt-0.5 text-sm text-muted-foreground">{todayFormatted()}</p>
		</div>
		<button
			onclick={() => (modal = { mode: 'add' })}
			class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
		>
			+ New task
		</button>
	</div>

	{#if instances.loading}
		<!-- Loading skeletons -->
		<div class="space-y-2">
			{#each Array(4) as _, i (i)}
				<div class="animate-pulse rounded-xl border border-border bg-card px-4 py-3">
					<div class="flex items-center gap-3">
						<div class="h-2.5 w-2.5 rounded-full bg-muted"></div>
						<div class="flex-1 space-y-1.5">
							<div class="h-3.5 w-40 rounded bg-muted"></div>
							<div class="h-3 w-24 rounded bg-muted"></div>
						</div>
						<div class="h-7 w-16 rounded-lg bg-muted"></div>
						<div class="h-7 w-8 rounded-lg bg-muted"></div>
						<div class="h-7 w-8 rounded-lg bg-muted"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if instances.items.length === 0}
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
						d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
					/>
				</svg>
			</div>
			<p class="text-base font-medium text-foreground">Nothing scheduled for today</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Add a one-off task or
				<a href="/categories" class="text-primary hover:underline">set up repeating tasks</a> in a category.
			</p>
			<button
				onclick={() => (modal = { mode: 'add' })}
				class="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
			>
				+ Add a task
			</button>
		</div>
	{:else}
		<!-- ── Pending tasks ── -->
		{#if pending.length > 0}
			<div class="space-y-2">
				{#each pending as inst (inst.id)}
					{@const isActive = sessions.active?.instance_id === inst.id}
					<div
						transition:fly={{ x: -12, duration: 200 }}
						animate:flip={{ duration: 200 }}
						class="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors {isActive
							? 'border-primary shadow-sm'
							: 'border-border hover:border-foreground/20'}"
					>
						<!-- Color dot -->
						<div
							class="h-2.5 w-2.5 shrink-0 rounded-full"
							style="background-color: {inst.task.category.color}"
						></div>

						<!-- Task info — click to open edit modal -->
						<button
							class="min-w-0 flex-1 text-left"
							onclick={() => (modal = { mode: 'edit', inst })}
						>
							<p class="truncate text-sm font-medium text-foreground">{inst.task.name}</p>
							<p class="text-xs text-muted-foreground">{inst.task.category.name}</p>
						</button>

						<!-- Live timer display -->
						{#if isActive}
							<span class="shrink-0 font-mono text-sm font-medium text-primary">
								{formatTime(elapsed)}
							</span>
						{/if}

						<!-- Controls -->
						<div class="flex shrink-0 items-center gap-1">
							<!-- Start / Stop -->
							<button
								onclick={() => toggleSession(inst)}
								title={isActive ? 'Stop timer' : 'Start timer'}
								class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors {isActive
									? 'bg-primary text-white hover:bg-primary/90'
									: 'border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'}"
							>
								{isActive ? 'Stop' : 'Start'}
							</button>

							<!-- Done -->
							<button
								onclick={() => markDone(inst)}
								title="Mark done"
								class="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-green-500/50 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400"
							>
								✓
							</button>

							<!-- Skip -->
							<button
								onclick={() => markSkipped(inst)}
								title="Skip"
								class="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-amber-400/50 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-900/20 dark:hover:text-amber-400"
							>
								–
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- ── Done tasks ── -->
		{#if done.length > 0}
			<div class="mt-8" transition:fade={{ duration: 150 }}>
				<p class="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
					Done ({done.length})
				</p>
				<div class="space-y-1.5">
					{#each done as inst (inst.id)}
						<div
							transition:fly={{ x: 12, duration: 200 }}
							animate:flip={{ duration: 200 }}
							class="group flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5 opacity-60 transition-opacity hover:opacity-90"
						>
							<div
								class="h-2 w-2 shrink-0 rounded-full"
								style="background-color: {inst.task.category.color}"
							></div>
							<button
								class="min-w-0 flex-1 text-left"
								onclick={() => (modal = { mode: 'edit', inst })}
							>
								<p class="truncate text-sm text-muted-foreground line-through">{inst.task.name}</p>
							</button>
							<button
								onclick={() => restore(inst)}
								title="Restore to pending"
								class="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
							>
								↩ restore
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- ── Skipped tasks ── -->
		{#if skipped.length > 0}
			<div class="mt-6" transition:fade={{ duration: 150 }}>
				<p class="mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
					Skipped ({skipped.length})
				</p>
				<div class="space-y-1.5">
					{#each skipped as inst (inst.id)}
						<div
							transition:fly={{ x: 12, duration: 200 }}
							animate:flip={{ duration: 200 }}
							class="group flex items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-2.5 opacity-50 transition-opacity hover:opacity-80"
						>
							<div
								class="h-2 w-2 shrink-0 rounded-full opacity-50"
								style="background-color: {inst.task.category.color}"
							></div>
							<button
								class="min-w-0 flex-1 text-left"
								onclick={() => (modal = { mode: 'edit', inst })}
							>
								<p class="truncate text-sm text-muted-foreground">{inst.task.name}</p>
							</button>
							<button
								onclick={() => restore(inst)}
								title="Restore to pending"
								class="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
							>
								↩ restore
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</main>
