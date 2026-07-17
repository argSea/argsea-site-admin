// The office nav, shared by the desktop rail (Sidebar) and the phone topbar
// (MobileTopbar) so both read one list, the way the design mock kept a single
// navItems array for its sidebar and its collapsed top bar. `rule` marks the
// first row of a group; each consumer draws a thin divider above that row.
import type { Screen } from '../state/harbor';

export const NAV_ITEMS: { id: Screen; glyph: string; label: string; rule?: true }[] = [
	{ id: 'dash', glyph: '✦', label: 'the watch room' },
	{ id: 'watch', glyph: '☉', label: 'the watch desk', rule: true },
	{ id: 'projects', glyph: '✺', label: 'the light list' },
	{ id: 'hobbies', glyph: '✳', label: 'the wandering chart' },
	{ id: 'notes', glyph: '✎', label: 'writing desk' },
	{ id: 'bench', glyph: '⚒', label: 'the tool bench' },
	{ id: 'marginalia', glyph: '✐', label: 'marginalia', rule: true },
	{ id: 'shop', glyph: '♞', label: 'the carving shop' },
	{ id: 'media', glyph: '❏', label: 'the darkroom' },
	{ id: 'copy', glyph: '⚑', label: 'signal flags', rule: true },
	{ id: 'keeper', glyph: '⌂', label: 'the keeper' },
	{ id: 'eggs', glyph: '✧', label: "smuggler's cove" },
];
