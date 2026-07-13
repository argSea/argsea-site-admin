// Client-side whimsy, verbatim from the design. None of this touches the API;
// all of it sits behind the reduced-motion kill-switch where it moves.

export const PROVERBS = [
	'The keeper is also the intern.',
	'A tidy harbor is a suspicious harbor.',
	'Red sky at night, deploy delight.',
	'Never trust a quiet queue.',
	'Any port in a stack trace.',
	'The lighthouse shines both ways.',
	'Six drafts make a fleet.',
];

export const WEATHER_LINES = [
	'All quiet on the water. Mostly.',
	'Seas calm. Coffee strong.',
	'Light fog inland. Morale high.',
	'Winds from the west. Backlog from everywhere.',
	"Tide's out. So are the bugs. Probably.",
	'Small craft advisory: the home lab is tinkering again.',
];

export function pickWeatherLine(): string {
	return WEATHER_LINES[Math.floor(Math.random() * WEATHER_LINES.length)];
}

export function greeting(hour: number = new Date().getHours()): string {
	if (hour < 5) return 'Still up';
	if (hour < 12) return 'Good morning';
	if (hour < 18) return 'Good afternoon';
	return 'Good evening';
}

export function dateLine(): string {
	return new Date()
		.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
		.toLowerCase();
}
