export type GoalType = 'times' | 'seconds';
export type GoalPeriod = 'week' | 'month' | 'year';
export type RepeatFreq = 'daily' | 'weekly' | 'monthly';

export interface Category {
	id: string;
	user_id: string;
	name: string;
	color: string;
	goal_type: GoalType;
	goal_value: number;
	goal_period: GoalPeriod;
}

export interface Task {
	id: string;
	category_id: string;
	name: string;
	description: string | null;
	repeat_freq: RepeatFreq | null;
	repeat_interval: number | null;
	repeat_weekdays: number | null; // 7-bit mask: bit0=Mon, bit6=Sun
	repeat_month_days: number | null; // 31-bit mask: bit0=day1, bit30=day31
	start_date: number | null; // Unix timestamp (midnight) for once-time or start of repeat
	end_date: number | null; // Unix timestamp (midnight) for end of repeat
	done_dates: number[]; // Unix timestamps (midnight) for completed dates
	skipped_dates: number[]; // Unix timestamps (midnight) for skipped dates
}

export interface Session {
	id: string;
	task_id: string;
	started_at: number;
	ended_at: number | null;
}

// Joined types for UI
export interface TaskWithCategory extends Task {
	category: Category;
}
