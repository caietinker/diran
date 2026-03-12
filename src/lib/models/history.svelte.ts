import { auth } from '$lib/auth.svelte';
import { supabase } from '$lib/supabase';
import type { Task, TaskWithCategory } from '$lib/types';

function getTodayUnix(): number {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return Math.floor(d.getTime() / 1000);
}

export function isUndated(task: Task): boolean {
	return !task.start_date && !task.end_date;
}

export function isDated(task: Task): boolean {
	return !!task.start_date || !!task.end_date;
}

/**
 * Determine if a task should fire on the given date.
 * Does NOT mutate the input Date object.
 */
export function shouldFireOnDate(task: Task, date: Date): boolean {
	// Work with a clean copy — never mutate the input
	const d = new Date(date.getTime());
	d.setHours(0, 0, 0, 0);
	const dateUnix = Math.floor(d.getTime() / 1000);
	const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon … 7=Sun
	const dayOfMonth = d.getDate(); // 1-31

	// ── Undated tasks ───────────────────────────────────────────────────────
	if (isUndated(task)) {
		if (task.repeat_freq === 'daily') {
			const interval = task.repeat_interval ?? 1;
			if (interval === 1) return true;
			// Use a fixed epoch (2024-01-01 00:00:00 UTC) as the reference start
			const epoch = 1704067200; // 2024-01-01
			return ((dateUnix - epoch) / 86400) % interval === 0;
		}
		if (task.repeat_freq === 'weekly') {
			const weekdayMask = task.repeat_weekdays ?? 0;
			const todayBit = 1 << (dayOfWeek - 1);
			return (weekdayMask & todayBit) !== 0;
		}
		if (task.repeat_freq === 'monthly') {
			const monthDayMask = task.repeat_month_days ?? 0;
			const todayBit = 1 << (dayOfMonth - 1);
			return (monthDayMask & todayBit) !== 0;
		}
		// One-off undated task: fire today only
		return dateUnix === getTodayUnix();
	}

	// ── One-off task with a specific date ───────────────────────────────────
	if (!task.repeat_freq) {
		if (task.start_date) {
			const startD = new Date(task.start_date * 1000);
			startD.setHours(0, 0, 0, 0);
			return dateUnix === Math.floor(startD.getTime() / 1000);
		}
		return dateUnix === getTodayUnix();
	}

	// ── Repeating task ───────────────────────────────────────────────────────
	// Not started yet
	if (task.start_date) {
		const startD = new Date(task.start_date * 1000);
		startD.setHours(0, 0, 0, 0);
		if (dateUnix < Math.floor(startD.getTime() / 1000)) return false;
	}

	// Already ended
	if (task.end_date) {
		const endD = new Date(task.end_date * 1000);
		endD.setHours(0, 0, 0, 0);
		if (dateUnix > Math.floor(endD.getTime() / 1000)) return false;
	}

	if (task.repeat_freq === 'daily') {
		const interval = task.repeat_interval ?? 1;
		if (interval === 1) return true;
		// Use task's start_date as reference if available, otherwise the epoch
		const refUnix = task.start_date
			? (() => {
					const sd = new Date(task.start_date * 1000);
					sd.setHours(0, 0, 0, 0);
					return Math.floor(sd.getTime() / 1000);
				})()
			: 1704067200;
		return ((dateUnix - refUnix) / 86400) % interval === 0;
	}

	if (task.repeat_freq === 'weekly') {
		const weekdayMask = task.repeat_weekdays ?? 0;
		const interval = task.repeat_interval ?? 1;
		const todayBit = 1 << (dayOfWeek - 1);
		if ((weekdayMask & todayBit) === 0) return false;
		if (interval === 1) return true;
		// Check week interval: use ISO week number from start_date (or epoch)
		const refUnix = task.start_date
			? (() => {
					const sd = new Date(task.start_date * 1000);
					sd.setHours(0, 0, 0, 0);
					return Math.floor(sd.getTime() / 1000);
				})()
			: 1704067200;
		const weeksDiff = Math.floor((dateUnix - refUnix) / (7 * 86400));
		return weeksDiff % interval === 0;
	}

	if (task.repeat_freq === 'monthly') {
		const monthDayMask = task.repeat_month_days ?? 0;
		const todayBit = 1 << (dayOfMonth - 1);
		if ((monthDayMask & todayBit) === 0) return false;
		const interval = task.repeat_interval ?? 1;
		if (interval === 1) return true;
		// Check month interval from start_date (or epoch month)
		const refDate = task.start_date
			? new Date(task.start_date * 1000)
			: new Date(1704067200 * 1000);
		const refYear = refDate.getFullYear();
		const refMonth = refDate.getMonth();
		const monthsDiff = (d.getFullYear() - refYear) * 12 + (d.getMonth() - refMonth);
		return monthsDiff % interval === 0;
	}

	return false;
}

export function getTaskStatusForDate(task: Task, dateUnix: number): 'pending' | 'done' | 'skipped' {
	if (task.done_dates?.includes(dateUnix)) return 'done';
	if (task.skipped_dates?.includes(dateUnix)) return 'skipped';
	return 'pending';
}

export interface TodayTask {
	task: TaskWithCategory;
	status: 'pending' | 'done' | 'skipped';
	totalSessions: number; // total time tracked in seconds (all time)
	todaySessions: number; // time tracked today in seconds
}

class HistoryStore {
	todayTasks = $state<TodayTask[]>([]);
	loading = $state(false);

	async fetchTodayTasks(
		tasks: Task[],
		categories: {
			id: string;
			name: string;
			color: string;
			goal_type: string;
			goal_value: number;
			goal_period: string;
		}[]
	) {
		if (!auth.user) return;
		this.loading = true;

		const today = getTodayUnix();
		const todayDate = new Date();
		const todayEnd = today + 86400; // start of tomorrow

		const { data: allSessions } = await supabase
			.from('session')
			.select('task_id, started_at, ended_at');

		const computed: TodayTask[] = [];

		for (const task of tasks) {
			const cat = categories.find((c) => c.id === task.category_id);
			if (!cat) continue;

			if (!shouldFireOnDate(task, todayDate)) continue;

			const status = getTaskStatusForDate(task, today);

			const taskSessions = (allSessions ?? []).filter((s) => s.task_id === task.id);
			let totalSessions = 0;
			let todaySessions = 0;

			for (const session of taskSessions) {
				const sessionEnd = session.ended_at ?? Math.floor(Date.now() / 1000);
				const duration = sessionEnd - session.started_at;
				totalSessions += duration;
				if (session.started_at >= today && session.started_at < todayEnd) {
					todaySessions += duration;
				}
			}

			computed.push({
				task: {
					...task,
					category: cat as unknown as import('$lib/types').Category
				},
				status,
				totalSessions,
				todaySessions
			});
		}

		computed.sort((a, b) => {
			const order = { pending: 0, done: 1, skipped: 2 };
			return order[a.status] - order[b.status];
		});

		this.todayTasks = computed;
		this.loading = false;
	}

	async markDone(taskId: string) {
		const today = getTodayUnix();

		// Single fetch to get both arrays (no race condition)
		const { data: task } = await supabase
			.from('task')
			.select('done_dates, skipped_dates')
			.eq('id', taskId)
			.single();

		if (!task) return;

		const currentDone: number[] = task.done_dates ?? [];
		const currentSkipped: number[] = task.skipped_dates ?? [];

		if (currentDone.includes(today)) return; // already done

		await supabase
			.from('task')
			.update({
				done_dates: [...currentDone, today],
				skipped_dates: currentSkipped.filter((d) => d !== today)
			})
			.eq('id', taskId);

		this.todayTasks = this.todayTasks.map((t) =>
			t.task.id === taskId ? { ...t, status: 'done' as const } : t
		);
	}

	async markSkipped(taskId: string) {
		const today = getTodayUnix();

		// Single fetch to get both arrays (no race condition)
		const { data: task } = await supabase
			.from('task')
			.select('done_dates, skipped_dates')
			.eq('id', taskId)
			.single();

		if (!task) return;

		const currentDone: number[] = task.done_dates ?? [];
		const currentSkipped: number[] = task.skipped_dates ?? [];

		if (currentSkipped.includes(today)) return; // already skipped

		await supabase
			.from('task')
			.update({
				done_dates: currentDone.filter((d) => d !== today),
				skipped_dates: [...currentSkipped, today]
			})
			.eq('id', taskId);

		this.todayTasks = this.todayTasks.map((t) =>
			t.task.id === taskId ? { ...t, status: 'skipped' as const } : t
		);
	}

	async restore(taskId: string) {
		const today = getTodayUnix();

		const { data: task } = await supabase
			.from('task')
			.select('done_dates, skipped_dates')
			.eq('id', taskId)
			.single();

		if (!task) return;

		const currentDone: number[] = task.done_dates ?? [];
		const currentSkipped: number[] = task.skipped_dates ?? [];

		await supabase
			.from('task')
			.update({
				done_dates: currentDone.filter((d) => d !== today),
				skipped_dates: currentSkipped.filter((d) => d !== today)
			})
			.eq('id', taskId);

		this.todayTasks = this.todayTasks.map((t) =>
			t.task.id === taskId ? { ...t, status: 'pending' as const } : t
		);
	}

	/**
	 * Derive history from done_dates / skipped_dates on the task itself.
	 * The dead `history` table is never queried.
	 * Returns entries sorted newest-first, limited to 60.
	 */
	async fetchForTask(taskId: string): Promise<{ id: string; date: string; status: string }[]> {
		const { data: task } = await supabase
			.from('task')
			.select('done_dates, skipped_dates')
			.eq('id', taskId)
			.single();

		if (!task) return [];

		const entries: { unix: number; status: 'done' | 'skipped' }[] = [];

		for (const unix of task.done_dates ?? []) {
			entries.push({ unix, status: 'done' });
		}
		for (const unix of task.skipped_dates ?? []) {
			entries.push({ unix, status: 'skipped' });
		}

		// Sort descending (newest first), cap at 60
		entries.sort((a, b) => b.unix - a.unix);
		const limited = entries.slice(0, 60);

		return limited.map((e) => ({
			// Use the unix timestamp as a stable id for keying in the UI
			id: String(e.unix),
			date: new Date(e.unix * 1000).toLocaleDateString('en-GB', {
				day: '2-digit',
				month: 'short',
				year: 'numeric'
			}),
			status: e.status
		}));
	}
}

export const history = new HistoryStore();
