// Keeper's-log time display. Activity timestamps arrive as fixed-width RFC3339
// strings; the log reads better in harbor time than ISO time.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(rfc3339: string, now: Date = new Date()): string {
	const then = Date.parse(rfc3339);
	if (Number.isNaN(then)) {
		return rfc3339;
	}

	const age = now.getTime() - then;
	if (age < MINUTE) return 'just now';
	if (age < HOUR) return `${Math.floor(age / MINUTE)}m ago`;
	if (age < DAY) return `${Math.floor(age / HOUR)}h ago`;
	if (age < 2 * DAY) return 'yesterday';
	if (age < 7 * DAY) return `${Math.floor(age / DAY)} days ago`;
	if (age < 14 * DAY) return 'last week';

	return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
}
