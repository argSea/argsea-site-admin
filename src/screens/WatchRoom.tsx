// The watch room. The greeting, the tiles, and the harbor-traffic card all read
// live now: ships-sighted, the flares tally, and the traffic card ride the
// sightings API, while notes, lights, and the off-fairway count come off the
// harbor store. Only the weather line stays local whimsy, reporting on no real
// sea. Every read fails soft, so a report that is still loading, errored, or
// served by an API too old to know the route or the flare fields leaves quiet
// placeholders instead of a broken board.
import { useMemo } from 'react';
import { useHarbor } from '../state/harbor';
import { onWatch } from '../lib/api';
import { dateLine, greeting, pickWeatherLine } from '../lib/whimsy';
import { relativeTime } from '../lib/time';
import { Boat, Fish } from '../components/art';
import CatPerch from '../components/CatPerch';

const STAT_TILTS = ['-.6deg', '.4deg', '-.3deg', '.5deg', '-.4deg'];

const CAT_QUIPS = [
	'almost had it.', 'the fish owes me money.', 'the traffic can wait. the fish cannot.', 'two jumped. zero landed. rigged.',
];

// Each log family wears its screen's glyph so the keeper's log reads at a
// glance; the figurehead and carving lines arrive from the API and get a
// face here.
const LOG_GLYPHS: Record<string, string> = {
	project: '✉', note: '✎', hobby: '✳', sitecopy: '⚑', media: '❏',
	user: '⌂', lantern: '☀', figurehead: '♆', carving: '⚒',
};

// A stat with no number to show yet reads quiet, not blank.
const QUIET_VALUE = '· · ·';

// The day the API dates in the traffic window, worn as a weekday on the bar's
// hover; parsed as a local date so the label never slides across a timezone.
function weekdayOf(isoDay: string): string {
	const [y, m, d] = isoDay.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}

export default function WatchRoom() {
	const h = useHarbor();
	const weather = useMemo(pickWeatherLine, []);

	const pubProjects = h.projects.filter((p) => p.status === 'published').length;
	const pubNotes = h.notes.filter((n) => n.status === 'published').length;
	const offFairway = h.hobbies.filter((x) => !onWatch(x)).length;

	const t = h.traffic;
	const maxSails = t ? Math.max(1, ...t.days.map((d) => d.sails)) : 1;
	const lightTitle = (id: string): string => h.projects.find((p) => p.id === id)?.title ?? 'an unlisted light';
	const noteTitle = (id: string): string => h.notes.find((n) => n.id === id)?.title ?? 'a stray note';
	const plotName = (id: string): string => h.hobbies.find((x) => x.id === id)?.name ?? 'an unmarked plot';

	// the flare tally rides the traffic report; an API from before it omits the
	// field, which reads quiet, distinct from a present count of zero
	const flares = t?.flares;
	const hasFlareField = t != null && flares !== undefined;
	const topFlare = t?.flareRolls?.[0];
	const flareSub = !hasFlareField || flares === 0 || !topFlare
		? 'the coast is quiet. no flares yet.'
		: `most wanted back: ${plotName(topFlare.subject).toLowerCase()}`;

	const stats = [
		{
			label: 'ships sighted', value: t ? t.uniques.toLocaleString() : QUIET_VALUE,
			sub: t ? 'visitors this week. one was mom.' : 'the sea is quiet. no count yet.',
		},
		{ label: 'notes posted', value: `${pubNotes} / ${h.notes.length}`, sub: 'posted / at the desk' },
		{ label: 'lights burning', value: `${pubProjects} / ${h.projects.length}`, sub: 'lit / on the list' },
		{ label: 'off the fairway', value: String(offFairway), sub: 'adrift. none sunk.' },
	];

	const errands = [
		{ label: 'kindle a light', run: () => { h.goTo('projects'); h.openEdit('project', null); } },
		{ label: 'draft a note', run: () => { h.goTo('notes'); h.openEdit('note', null); } },
		{ label: 'pick up a hobby (again)', run: () => { h.goTo('hobbies'); h.openEdit('hobby', null); } },
		{ label: 'hoist the lantern', run: () => { void h.hoistLantern(); } },
	];

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">the watch room · {dateLine()}</span>
				<span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px, 4.5vw, 42px)', color: 'var(--text-strong)', lineHeight: 1.15 }}>
					{greeting()}, {h.keeperName}.
				</span>
				<span style={{ fontSize: 16.5, color: 'var(--text-body)', fontStyle: 'italic' }}>{weather}</span>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18, animation: 'fadeUp .7s ease .15s both' }}>
				{stats.map((stat, i) => (
					<div key={stat.label} className="card tilt" style={{
						'--tilt': STAT_TILTS[i], padding: '20px 22px',
						display: 'flex', flexDirection: 'column', gap: 7,
					} as React.CSSProperties}>
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.13em', color: 'var(--periwinkle)', textTransform: 'uppercase' }}>{stat.label}</span>
						<span style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--text-strong)' }}>{stat.value}</span>
						<span style={{ fontSize: 13.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>{stat.sub}</span>
					</div>
				))}
				<div className="tilt" onClick={h.openFlareRoll} style={{
					'--tilt': STAT_TILTS[4], padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 7, cursor: 'pointer',
					background: 'linear-gradient(180deg,#251a22,#1a1526)', border: '1px solid rgba(255,106,82,.5)', borderRadius: 12,
					boxShadow: '0 10px 24px rgba(0,0,0,.35), inset 0 0 26px rgba(255,106,82,.09)',
				} as React.CSSProperties}>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.13em', color: 'var(--periwinkle)', textTransform: 'uppercase' }}>flares from the coast</span>
					<span style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: '#ff7a63' }}>{hasFlareField ? String(flares) : QUIET_VALUE}</span>
					<span style={{ fontSize: 13.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>{flareSub}</span>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff7a63', marginTop: 2 }}>tap for the roll call →</span>
				</div>
			</div>

			<div className="wave-strip" style={{ position: 'relative', height: 18 }}>
				<div style={{ position: 'absolute', left: '64%', top: -4, animation: 'fishArc 13s ease-in-out infinite', pointerEvents: 'none' }}>
					<Fish />
				</div>
				<div style={{ position: 'absolute', left: '28%', top: -2, animation: 'fishArc 17s ease-in-out 6s infinite', pointerEvents: 'none' }}>
					<Fish width={15} height={11} flip />
				</div>
				<div style={{ position: 'absolute', top: -15, left: -40, animation: 'sail 45s linear infinite' }}>
					<Boat />
				</div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 22, alignItems: 'start', animation: 'fadeUp .7s ease .25s both' }}>
				<div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
					<span className="card-kicker">the keeper's log</span>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
						{h.activity.slice(0, 6).map((entry) => (
							<div key={entry.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', borderTop: '1px solid var(--border-hair)', paddingTop: 11 }}>
								<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)', width: 80, flexShrink: 0 }}>
									{relativeTime(entry.timestamp)}
								</span>
								<span title={entry.entityType} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--periwinkle)', width: 16, textAlign: 'center', flexShrink: 0 }}>
									{LOG_GLYPHS[entry.entityType] ?? '·'}
								</span>
								<span className="row-sub">{entry.message}</span>
							</div>
						))}
						{h.activity.length === 0 && (
							<span className="row-sub" style={{ borderTop: '1px solid var(--border-hair)', paddingTop: 11, fontStyle: 'italic' }}>
								a blank page. suspiciously calm.
							</span>
						)}
					</div>
				</div>

				<div className="card tilt" style={{ '--tilt': '.25deg', display: 'flex', flexDirection: 'column', gap: 13, position: 'relative' } as React.CSSProperties}>
					<CatPerch quips={CAT_QUIPS} style={{ top: -46, right: 26 }} />
					<span className="card-kicker">harbor traffic · this week</span>
					{t ? (
						<>
							<div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 64 }}>
								{t.days.map((d) => (
									<div key={d.day} title={`${weekdayOf(d.day)} · ${d.sails} ships`} style={{
										flex: 1, height: `${Math.round((d.sails / maxSails) * 100)}%`, minHeight: 6,
										borderRadius: '3px 3px 0 0',
										background: d.sails === maxSails ? 'linear-gradient(180deg,#f0d9a8,#8f7f4d)' : 'linear-gradient(180deg,#93a0e8,#3b4374)',
									}} />
								))}
							</div>
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>
								{t.sails.toLocaleString()} ships sighted · busiest: {t.busiest || 'a quiet week'}
							</span>
							<div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.7, borderTop: '1px solid var(--border-hair)', paddingTop: 11 }}>
								<span style={{ color: 'var(--text-body)' }}>top postcard · <span style={{ color: 'var(--gold)' }}>
									{t.topPostcard ? `"${lightTitle(t.topPostcard.subject)}", ${t.topPostcard.flips} flips` : 'nothing flipped yet.'}
								</span></span>
								<span style={{ color: 'var(--text-body)' }}>top note · <span style={{ color: 'var(--text-soft)' }}>
									{t.topNote ? `"${noteTitle(t.topNote.subject)}", ${t.topNote.reads} reads` : 'nothing opened yet.'}
								</span></span>
								<span style={{ color: 'var(--text-body)' }}>top plot · <span style={{ color: 'var(--text-soft)' }}>
									{t.topHobby ? `"${plotName(t.topHobby.subject)}", ${t.topHobby.visits} visits` : 'nobody stopped by yet.'}
								</span></span>
								<span style={{ color: 'var(--text-body)' }}>ports of origin · <span style={{ color: 'var(--text-soft)' }}>
									{t.ports.length ? t.ports.map((p) => `${p.port} ${p.share}%`).join(' · ') : 'nowhere in particular.'}
								</span></span>
								<span style={{ color: 'var(--text-body)' }}>bottles cast · <span style={{ color: 'var(--text-soft)' }}>
									{t.bottles ? `${t.bottles.toLocaleString()} proverbs off the passing boat` : 'the boat kept its corks in.'}
								</span></span>
							</div>
						</>
					) : (
						<span className="row-sub" style={{ fontStyle: 'italic' }}>the sea is quiet. no sightings on the glass yet.</span>
					)}
				</div>

				<div className="card card--gold tilt" style={{ '--tilt': '.3deg', display: 'flex', flexDirection: 'column', gap: 12 } as React.CSSProperties}>
					<span className="card-kicker card-kicker--gold">quick errands</span>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
						{errands.map((errand) => (
							<div key={errand.label} className="errand" onClick={errand.run}>→ {errand.label}</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
