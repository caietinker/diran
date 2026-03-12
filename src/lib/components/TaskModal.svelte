<script lang="ts">
	import { untrack } from 'svelte';
	import { categories } from '$lib/models/categories.svelte';
	import { tasks } from '$lib/models/tasks.svelte';
	import { sessions } from '$lib/models/sessions.svelte';
	import { history } from '$lib/models/history.svelte';
	import type { Task, Session, RepeatFreq } from '$lib/types';
	import Modal from '$lib/components/Modal.svelte';

	/**
	 * Props:
	 *  - mode: 'add' | 'edit'
	 *  - task: existing Task when mode='edit'
	 *  - defaultCategoryId: pre-select a category (used when opening from a category page)
	 *  - onclose: called after close/save (so parent can refresh)
	 */
	interface Props {
		mode: 'add' | 'edit';
		task?: Task | null;
		defaultCategoryId?: string;
		elapsed?: number;
		onclose: (changed: boolean) => void;
	}

	let { mode, task = null, defaultCategoryId = '', elapsed = 0, onclose }: Props = $props();

	// ─── Tabs ──────────────────────────────────────────────────────────────────
	type Tab = 'edit' | 'sessions' | 'history';
	let activeTab = $state<Tab>('edit');

	// ─── Edit form state ───────────────────────────────────────────────────────
	let editName = $state(untrack(() => task?.name ?? ''));
	let editDescription = $state(untrack(() => task?.description ?? ''));
	let editCategoryId = $state(untrack(() => task?.category_id ?? defaultCategoryId));
	let editRepeatFreq = $state<RepeatFreq | ''>(untrack(() => task?.repeat_freq ?? ''));
	let editRepeatInterval = $state(untrack(() => task?.repeat_interval ?? 1));
	let editRepeatWeekdays = $state(untrack(() => task?.repeat_weekdays ?? 0));
	let editRepeatMonthDays = $state(untrack(() => task?.repeat_month_days ?? 0));
	// Date inputs (stored as YYYY-MM-DD strings for input fields)
	let editStartDate = $state(
		untrack(() => {
			if (!task?.start_date) return '';
			const d = new Date(task.start_date * 1000);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		})
	);
	let editEndDate = $state(
		untrack(() => {
			if (!task?.end_date) return '';
			const d = new Date(task.end_date * 1000);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		})
	);
	let saving = $state(false);
	let saveError = $state('');
	let deleting = $state(false);

	// ─── Sessions tab state ────────────────────────────────────────────────────
	let activeTaskId = $state<string | null>(untrack(() => task?.id ?? null));
	let drawerSessions = $state<Session[]>([]);
	let selectedHistoryItemId = $state<string | null>(null);
	let sessionsLoading = $state(false);

	// ─── History tab state ─────────────────────────────────────────────────────
	let historyItems = $state<{ id: string; date: string; status: string }[]>([]);
	let historyLoading = $state(false);

	// ─── Constants ─────────────────────────────────────────────────────────────
	const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const DAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

	// ─── Load sessions / history on mount if in edit mode ─────────────────────
	$effect(() => {
		if (mode === 'edit' && task) {
			loadSessions(task.id);
			loadHistory(task.id);
		}
	});

	async function loadSessions(taskId: string, filterDateUnix?: number) {
		sessionsLoading = true;
		let allSessions = await sessions.fetchForTask(taskId);

		// If a date is provided, filter sessions to that specific date
		if (filterDateUnix !== undefined) {
			const dayStart = filterDateUnix;
			const dayEnd = filterDateUnix + 86400; // next day's midnight
			allSessions = allSessions.filter(
				(s: { started_at: number }) => s.started_at >= dayStart && s.started_at < dayEnd
			);
		}

		drawerSessions = allSessions;
		sessionsLoading = false;
	}

	async function loadHistory(taskId: string) {
		historyLoading = true;
		historyItems = await history.fetchForTask(taskId);
		historyLoading = false;
	}

	async function selectHistoryItem(itemId: string) {
		selectedHistoryItemId = itemId;
		activeTab = 'sessions';
		// itemId is the Unix timestamp (e.g. "1709539200") — parse and filter sessions to that date
		const filterDateUnix = parseInt(itemId, 10);
		if (task) await loadSessions(task.id, filterDateUnix);
	}

	// ─── Re-fetch sessions when active session changes ────────────────────────
	$effect(() => {
		const _active = sessions.active;
		if (activeTaskId && activeTab === 'sessions') {
			loadSessions(activeTaskId);
		}
	});

	// ─── Weekday / month-day helpers ──────────────────────────────────────────
	function toggleWeekday(bit: number) {
		editRepeatWeekdays ^= 1 << (bit - 1);
	}
	function weekdayOn(bit: number): boolean {
		return (editRepeatWeekdays & (1 << (bit - 1))) !== 0;
	}
	function toggleMonthDay(bit: number) {
		editRepeatMonthDays ^= 1 << (bit - 1);
	}
	function monthDayOn(bit: number): boolean {
		return (editRepeatMonthDays & (1 << (bit - 1))) !== 0;
	}

	// ─── Save ─────────────────────────────────────────────────────────────────
	async function handleSave() {
		if (!editName.trim()) {
			saveError = 'Task name is required.';
			return;
		}
		if (!editCategoryId) {
			saveError = 'Please select a category.';
			return;
		}
		saveError = '';
		saving = true;

		const freq = editRepeatFreq === '' ? null : (editRepeatFreq as RepeatFreq);

		// Convert date strings to Unix timestamps (midnight)
		const startDateUnix = editStartDate
			? Math.floor(new Date(editStartDate + 'T00:00:00').getTime() / 1000)
			: null;
		const endDateUnix = editEndDate
			? Math.floor(new Date(editEndDate + 'T00:00:00').getTime() / 1000)
			: null;

		if (mode === 'add') {
			await tasks.add({
				category_id: editCategoryId,
				name: editName.trim(),
				description: editDescription.trim() || null,
				repeat_freq: freq,
				repeat_interval: freq ? editRepeatInterval : null,
				repeat_weekdays: freq === 'weekly' ? editRepeatWeekdays : null,
				repeat_month_days: freq === 'monthly' ? editRepeatMonthDays : null,
				start_date: startDateUnix,
				end_date: endDateUnix,
				completed_at: null
			});
		} else if (task) {
			await tasks.update(task.id, {
				category_id: editCategoryId,
				name: editName.trim(),
				description: editDescription.trim() || null,
				repeat_freq: freq,
				repeat_interval: freq ? editRepeatInterval : null,
				repeat_weekdays: freq === 'weekly' ? editRepeatWeekdays : null,
				repeat_month_days: freq === 'monthly' ? editRepeatMonthDays : null,
				start_date: startDateUnix,
				end_date: endDateUnix
			});
		}

		saving = false;
		onclose(true);
	}

	// ─── Delete task ──────────────────────────────────────────────────────────
	async function handleDelete() {
		if (!task) return;
		deleting = true;
		await tasks.remove(task.id);
		deleting = false;
		onclose(true);
	}

	// ─── Format helpers ───────────────────────────────────────────────────────
	function fmtClock(unix: number): string {
		return new Date(unix * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function fmtDuration(secs: number): string {
		const h = Math.floor(secs / 3600);
		const m = Math.floor((secs % 3600) / 60);
		const s = secs % 60;
		if (h > 0) return `${h}h ${m}m`;
		if (m > 0) return `${m}m ${s}s`;
		return `${s}s`;
	}

	function sessionDuration(s: Session): number {
		return (s.ended_at ?? Math.floor(Date.now() / 1000)) - s.started_at;
	}

	// ─── Total (live when active session is open) ─────────────────────────────
	const totalSeconds = $derived(
		drawerSessions.reduce((acc, s) => {
			if (s.ended_at === null && sessions.active?.id === s.id) return acc + elapsed;
			return acc + (s.ended_at ?? 0) - s.started_at;
		}, 0)
	);

	// ─── Derived display helpers ──────────────────────────────────────────────
	const hasExistingTask = $derived(mode === 'edit' && task !== null);
	const selectedCategory = $derived(categories.items.find((c) => c.id === editCategoryId));
</script>

<Modal
	title={mode === 'add' ? 'New task' : (task?.name ?? 'Task')}
	color={selectedCategory?.color}
	maxWidth="max-w-xl"
	maxHeight="min(90vh, 680px)"
	noPadding
	onclose={() => onclose(false)}
>
	{#snippet footer()}
		{#if mode === 'edit' && activeTab === 'edit'}
			<button
				type="button"
				onclick={handleDelete}
				disabled={deleting}
				class="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
			>
				{deleting ? 'Deleting…' : 'Delete task'}
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
		{#if activeTab === 'edit'}
			<button
				type="button"
				onclick={handleSave}
				disabled={saving}
				class="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
			>
				{saving ? 'Saving…' : mode === 'add' ? 'Create task' : 'Save changes'}
			</button>
		{/if}
	{/snippet}

	<!-- ── Tabs (only show Sessions + History in edit mode with an existing task) ── -->
	{#if hasExistingTask}
		<div class="flex border-b border-border px-5">
			{#each ['edit', 'sessions', 'history'] as Tab[] as tab (tab)}
				<button
					onclick={() => (activeTab = tab)}
					class="relative mr-5 pt-3 pb-3 text-sm font-medium transition-colors {activeTab === tab
						? 'text-foreground after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					{tab.charAt(0).toUpperCase() + tab.slice(1)}
				</button>
			{/each}
		</div>
	{/if}

	<!-- ── Scrollable body ── -->
	<div class="flex-1 overflow-y-auto px-5 py-4">
		<!-- ════════════════ EDIT TAB ════════════════ -->
		{#if activeTab === 'edit'}
			<div class="space-y-4">
				<!-- Task name -->
				<div class="space-y-1.5">
					<label
						for="task-name"
						class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
						>Task name</label
					>
					<input
						id="task-name"
						type="text"
						bind:value={editName}
						placeholder="e.g. Morning run"
						class="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
					/>
				</div>

				<!-- Description -->
				<div class="space-y-1.5">
					<label
						for="task-desc"
						class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
						>Description <span class="font-normal normal-case">(optional)</span></label
					>
					<textarea
						id="task-desc"
						bind:value={editDescription}
						rows={3}
						placeholder="Notes, context, links…"
						class="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
					></textarea>
				</div>

				<!-- Category picker -->
				<div class="space-y-1.5">
					<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Category</p>
					<div class="flex flex-wrap gap-2">
						{#each categories.items as cat (cat.id)}
							<button
								type="button"
								onclick={() => (editCategoryId = cat.id)}
								class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all {editCategoryId ===
								cat.id
									? 'border-transparent text-white shadow-sm'
									: 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}"
								style={editCategoryId === cat.id ? `background-color: ${cat.color}` : ''}
							>
								<span
									class="h-1.5 w-1.5 rounded-full {editCategoryId === cat.id ? 'bg-white/70' : ''}"
									style={editCategoryId !== cat.id ? `background-color: ${cat.color}` : ''}
								></span>
								{cat.name}
							</button>
						{/each}
					</div>
				</div>

				<!-- Repeat frequency -->
				<div class="space-y-3">
					<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Repeat</p>
					<div class="grid grid-cols-4 gap-1.5">
						{#each [{ v: '', l: 'Once' }, { v: 'daily', l: 'Daily' }, { v: 'weekly', l: 'Weekly' }, { v: 'monthly', l: 'Monthly' }] as opt (opt.v)}
							<button
								type="button"
								onclick={() => (editRepeatFreq = opt.v as RepeatFreq | '')}
								class="rounded-lg border py-2 text-sm font-medium transition-all {editRepeatFreq ===
								opt.v
									? 'border-primary bg-primary/10 text-primary'
									: 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'}"
							>
								{opt.l}
							</button>
						{/each}
					</div>

					<!-- Daily sub-options -->
					{#if editRepeatFreq === 'daily'}
						<div class="flex items-center gap-3 rounded-lg bg-muted px-4 py-3 text-sm">
							<span class="text-muted-foreground">Every</span>
							<input
								type="number"
								min="1"
								max="365"
								bind:value={editRepeatInterval}
								class="w-16 rounded-md border border-border bg-background px-2 py-1 text-center text-sm text-foreground focus:border-primary focus:outline-none"
							/>
							<span class="text-muted-foreground">{editRepeatInterval === 1 ? 'day' : 'days'}</span>
						</div>
					{/if}

					<!-- Weekly sub-options -->
					{#if editRepeatFreq === 'weekly'}
						<div class="space-y-3 rounded-lg bg-muted px-4 py-3">
							<div class="flex items-center gap-3 text-sm">
								<span class="text-muted-foreground">Every</span>
								<input
									type="number"
									min="1"
									max="52"
									bind:value={editRepeatInterval}
									class="w-16 rounded-md border border-border bg-background px-2 py-1 text-center text-sm text-foreground focus:border-primary focus:outline-none"
								/>
								<span class="text-muted-foreground"
									>{editRepeatInterval === 1 ? 'week' : 'weeks'} on</span
								>
							</div>
							<div class="flex gap-1.5">
								{#each DAY_SHORT as label, i (i)}
									{@const day = i + 1}
									<button
										type="button"
										onclick={() => toggleWeekday(day)}
										title={DAY_LABELS[i]}
										class="flex-1 rounded-md py-1.5 text-xs font-medium transition-all {weekdayOn(
											day
										)
											? 'bg-primary text-white shadow-sm'
											: 'border border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'}"
										>{label}</button
									>
								{/each}
							</div>
							{#if editRepeatWeekdays === 0}
								<p class="text-xs text-amber-500">Select at least one day.</p>
							{/if}
						</div>
					{/if}

					<!-- Monthly sub-options -->
					{#if editRepeatFreq === 'monthly'}
						<div class="space-y-3 rounded-lg bg-muted px-4 py-3">
							<div class="flex items-center gap-3 text-sm">
								<span class="text-muted-foreground">Every</span>
								<input
									type="number"
									min="1"
									max="12"
									bind:value={editRepeatInterval}
									class="w-16 rounded-md border border-border bg-background px-2 py-1 text-center text-sm text-foreground focus:border-primary focus:outline-none"
								/>
								<span class="text-muted-foreground"
									>{editRepeatInterval === 1 ? 'month' : 'months'} on days</span
								>
							</div>
							<div class="grid grid-cols-7 gap-1">
								{#each Array(31) as _, i (i)}
									{@const day = i + 1}
									<button
										type="button"
										onclick={() => toggleMonthDay(day)}
										class="aspect-square rounded text-xs font-medium transition-all {monthDayOn(day)
											? 'bg-primary text-white shadow-sm'
											: 'border border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'}"
										>{day}</button
									>
								{/each}
							</div>
							{#if editRepeatMonthDays === 0}
								<p class="text-xs text-amber-500">Select at least one day.</p>
							{/if}
						</div>
					{/if}

					<!-- Once: specific date picker -->
					{#if editRepeatFreq === ''}
						<div class="rounded-lg bg-muted px-4 py-3">
							<label class="flex items-center gap-3 text-sm">
								<span class="text-muted-foreground">Date</span>
								<input
									type="date"
									bind:value={editStartDate}
									class="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
								/>
							</label>
						</div>
					{/if}

					<!-- Start/End date for repeating tasks -->
					{#if editRepeatFreq !== ''}
						<div class="grid grid-cols-2 gap-3 rounded-lg bg-muted px-4 py-3">
							<div class="space-y-1">
								<label for="repeat-start-date" class="text-xs text-muted-foreground"
									>Start date</label
								>
								<input
									id="repeat-start-date"
									type="date"
									bind:value={editStartDate}
									class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
							<div class="space-y-1">
								<label for="repeat-end-date" class="text-xs text-muted-foreground">End date</label>
								<input
									id="repeat-end-date"
									type="date"
									bind:value={editEndDate}
									class="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						</div>
					{/if}
				</div>

				{#if saveError}
					<p class="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{saveError}
					</p>
				{/if}
			</div>

			<!-- ════════════════ SESSIONS TAB ════════════════ -->
		{:else if activeTab === 'sessions'}
			{#if sessionsLoading}
				<div class="py-8 text-center text-sm text-muted-foreground">Loading sessions…</div>
			{:else if drawerSessions.length === 0}
				<div class="py-8 text-center">
					<p class="text-sm text-muted-foreground">No sessions recorded for this task.</p>
					<p class="mt-1 text-xs text-muted-foreground">
						Start a timer from the Today view to log time.
					</p>
				</div>
			{:else}
				<div class="space-y-1">
					{#each drawerSessions as s, idx (s.id)}
						{@const isLive = s.ended_at === null && sessions.active?.id === s.id}
						{@const dur = isLive ? elapsed : sessionDuration(s)}
						<div
							class="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3"
						>
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<span class="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
									<span class="text-sm text-foreground">{fmtClock(s.started_at)}</span>
									<span class="text-muted-foreground">→</span>
									{#if s.ended_at}
										<span class="text-sm text-foreground">{fmtClock(s.ended_at)}</span>
									{:else}
										<span class="text-sm font-medium text-primary">active</span>
									{/if}
								</div>
							</div>
							<span class="font-mono text-sm {isLive ? 'text-primary' : 'text-foreground'}"
								>{fmtDuration(dur)}</span
							>
						</div>
					{/each}
				</div>
				<div class="mt-4 flex items-center justify-between rounded-lg bg-muted px-4 py-3">
					<span class="text-sm font-medium text-muted-foreground">Total</span>
					<span class="font-mono text-sm font-semibold text-foreground"
						>{fmtDuration(totalSeconds)}</span
					>
				</div>
			{/if}

			<!-- ════════════════ HISTORY TAB ════════════════ -->
		{:else if activeTab === 'history'}
			{#if historyLoading}
				<div class="py-8 text-center text-sm text-muted-foreground">Loading history…</div>
			{:else if historyItems.length === 0}
				<div class="py-8 text-center">
					<p class="text-sm text-muted-foreground">No history yet.</p>
				</div>
			{:else}
				<div class="space-y-1">
					{#each historyItems as item (item.id)}
						{@const isCurrent = selectedHistoryItemId === item.id}
						<button
							onclick={() => selectHistoryItem(item.id)}
							class="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors {isCurrent
								? 'border-primary bg-primary/5'
								: 'border-border bg-background hover:border-foreground/20 hover:bg-accent/30'}"
						>
							<div class="flex-1">
								<span class="text-sm font-medium text-foreground">{item.date}</span>
							</div>
							<span
								class="rounded-full px-2 py-0.5 text-xs font-medium {item.status === 'done'
									? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
									: item.status === 'skipped'
										? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
										: 'bg-muted text-muted-foreground'}"
							>
								{item.status}
							</span>
							{#if isCurrent}
								<span class="text-xs text-primary">viewing</span>
							{:else}
								<span class="text-xs text-muted-foreground">view sessions →</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</Modal>
