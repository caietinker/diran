import { supabase } from '$lib/supabase';
import type { Category } from '$lib/types';

/**
 * Calculate goal progress for a category within its goal period.
 * Returns a number between 0 and 1 (or > 1 if exceeded).
 */
export async function getGoalProgress(
	category: Category
): Promise<{ current: number; target: number }> {
	const now = new Date();
	let periodStart: string;

	if (category.goal_period === 'week') {
		const day = now.getDay() === 0 ? 7 : now.getDay();
		const monday = new Date(now);
		monday.setDate(now.getDate() - (day - 1));
		periodStart = monday.toISOString().slice(0, 10);
	} else if (category.goal_period === 'month') {
		periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
	} else {
		// year
		periodStart = `${now.getFullYear()}-01-01`;
	}

	const today = now.toISOString().slice(0, 10);

	if (category.goal_type === 'times') {
		const { count } = await supabase
			.from('instance')
			.select('id', { count: 'exact', head: true })
			.eq('status', 'done')
			.gte('date', periodStart)
			.lte('date', today)
			.in(
				'task_id',
				(await supabase.from('task').select('id').eq('category_id', category.id)).data?.map(
					(t) => t.id
				) ?? []
			);
		return { current: count ?? 0, target: category.goal_value };
	} else {
		// seconds: sum (ended_at - started_at) for all sessions in period
		const taskIds =
			(await supabase.from('task').select('id').eq('category_id', category.id)).data?.map(
				(t) => t.id
			) ?? [];

		if (taskIds.length === 0) return { current: 0, target: category.goal_value };

		const { data: sessionData } = await supabase
			.from('session')
			.select('started_at, ended_at, instance!inner(task_id, date)')
			.gte('instance.date', periodStart)
			.lte('instance.date', today)
			.in('instance.task_id', taskIds)
			.not('ended_at', 'is', null);

		const totalSeconds = (sessionData ?? []).reduce((sum, s) => {
			const row = s as { started_at: number; ended_at: number };
			return sum + (row.ended_at - row.started_at);
		}, 0);

		return { current: totalSeconds, target: category.goal_value };
	}
}
