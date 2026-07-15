// The office nav, shared by the desktop rail (Sidebar) and the phone topbar
// (MobileTopbar) so both read one list, the way the design mock kept a single
// navItems array for its sidebar and its collapsed top bar.
import type { Screen } from '../state/harbor';

export const NAV_ITEMS: { id: Screen; glyph: string; label: string }[] = [
	{ id: 'dash', glyph: '✦', label: 'the watch room' },
	{ id: 'projects', glyph: '✺', label: 'the light list' },
	{ id: 'hobbies', glyph: '✳', label: 'the wandering chart' },
	{ id: 'notes', glyph: '✎', label: 'writing desk' },
	{ id: 'copy', glyph: '⚑', label: 'signal flags' },
	{ id: 'eggs', glyph: '✧', label: "smuggler's cove" },
	{ id: 'watch', glyph: '☉', label: 'the watch desk' },
	{ id: 'shop', glyph: '♆', label: 'the carving shop' },
	{ id: 'marginalia', glyph: '✒', label: 'marginalia' },
	{ id: 'bench', glyph: '⚒', label: 'the tool bench' },
	{ id: 'media', glyph: '❏', label: 'the darkroom' },
	{ id: 'keeper', glyph: '☸', label: 'the keeper' },
];
