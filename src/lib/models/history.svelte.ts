import { auth } from '$lib/auth.svelte';
import { supabase } from '$lib/supabase';
import type { Task, TaskWithCategory } from '$lib/types';

function getTodayUnix(): number {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return Math.floor(d.getTime() / 1000);
}

/** Returns today's date as a YYYY-MM-DD string in the local timezone. */
function getTodayDateStr(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

	// ── Once task (no repeat_freq) ───────────────────────────────────────────
	if (!task.repeat_freq) {
		// Already globally completed on a previous day — gone forever
		if (task.completed_at !== null && task.completed_at < getTodayUnix()) return false;

		if (task.start_date) {
			// Once with a specific date: show only on that date
			const startD = new Date(task.start_date * 1000);
			startD.setHours(0, 0, 0, 0);
			return dateUnix === Math.floor(startD.getTime() / 1000);
		}
		// Once, undated: show every day until completed
		return true;
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
		const todayDateStr = getTodayDateStr();

		// Fetch today's history entries for all tasks in one query
		const { data: todayHistory } = await supabase
			.from('history')
			.select('task_id, status')
			.eq('date', todayDateStr);

		const statusMap = new Map<string, 'done' | 'skipped'>();
		for (const row of todayHistory ?? []) {
			statusMap.set(row.task_id, row.status as 'done' | 'skipped');
		}

		const { data: allSessions } = await supabase
			.from('session')
			.select('task_id, started_at, ended_at');

		const computed: TodayTask[] = [];

		for (const task of tasks) {
			const cat = categories.find((c) => c.id === task.category_id);
			if (!cat) continue;

			if (!shouldFireOnDate(task, todayDate)) continue;

			const status: 'pending' | 'done' | 'skipped' = statusMap.get(task.id) ?? 'pending';

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

	async markDone(taskId: string, isOnce: boolean) {
		const todayDateStr = getTodayDateStr();

		// Upsert into history
		await supabase
			.from('history')
			.upsert(
				{ task_id: taskId, date: todayDateStr, status: 'done' },
				{ onConflict: 'task_id,date' }
			);

		// For once tasks, also set completed_at so they disappear tomorrow
		if (isOnce) {
			await supabase.from('task').update({ completed_at: getTodayUnix() }).eq('id', taskId);
		}

		this.todayTasks = this.todayTasks.map((t) =>
			t.task.id === taskId ? { ...t, status: 'done' as const } : t
		);
	}

	async markSkipped(taskId: string, isOnce: boolean) {
		const todayDateStr = getTodayDateStr();

		// Upsert into history
		await supabase
			.from('history')
			.upsert(
				{ task_id: taskId, date: todayDateStr, status: 'skipped' },
				{ onConflict: 'task_id,date' }
			);

		// For once tasks, also set completed_at so they disappear tomorrow
		if (isOnce) {
			await supabase.from('task').update({ completed_at: getTodayUnix() }).eq('id', taskId);
		}

		this.todayTasks = this.todayTasks.map((t) =>
			t.task.id === taskId ? { ...t, status: 'skipped' as const } : t
		);
	}

	async restore(taskId: string, isOnce: boolean) {
		const todayDateStr = getTodayDateStr();

		// Delete today's history entry
		await supabase.from('history').delete().eq('task_id', taskId).eq('date', todayDateStr);

		// For once tasks, clear completed_at so they reappear
		if (isOnce) {
			await supabase.from('task').update({ completed_at: null }).eq('id', taskId);
		}

		this.todayTasks = this.todayTasks.map((t) =>
			t.task.id === taskId ? { ...t, status: 'pending' as const } : t
		);
	}

	/**
	 * Fetch task history from the history table.
	 * Returns entries sorted newest-first, limited to 60.
	 */
	async fetchForTask(taskId: string): Promise<{ id: string; date: string; status: string }[]> {
		const { data } = await supabase
			.from('history')
			.select('id, date, status')
			.eq('task_id', taskId)
			.order('date', { ascending: false })
			.limit(60);

		if (!data) return [];

		return data.map((row) => ({
			id: row.id,
			date: new Date(row.date).toLocaleDateString('en-GB', {
				day: '2-digit',
				month: 'short',
				year: 'numeric',
				timeZone: 'UTC'
			}),
			status: row.status
		}));
	}
}

export const history = new HistoryStore();
