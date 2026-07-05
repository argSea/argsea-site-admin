// The bridge. Greeting and stats are live; the harbor-traffic panel renders
// the design's hardcoded theater values (analytics parked per operator ruling,
// 2026-07-05), as do the "ships sighted"/"uptime" tiles and harbor conditions.
import { useMemo } from 'react';
import { useHarbor } from '../state/harbor';
import { dateLine, greeting, pickWeatherLine } from '../lib/whimsy';
import { relativeTime } from '../lib/time';
import { Boat, Fish } from '../components/art';

const STAT_TILTS = ['-.6deg', '.4deg', '-.3deg', '.5deg'];

const TRAFFIC = [
	{ d: 'mon', v: 142 }, { d: 'tue', v: 180 }, { d: 'wed', v: 121 }, { d: 'thu', v: 238 },
	{ d: 'fri', v: 164 }, { d: 'sat', v: 98 }, { d: 'sun', v: 187 },
];

export default function Bridge() {
	const h = useHarbor();
	const weather = useMemo(pickWeatherLine, []);

	const pubProjects = h.projects.filter((p) => p.status === 'published').length;
	const resting = h.hobbies.filter((x) => !x.active).length;

	const stats = [
		{ label: 'ships sighted', value: '1,204', sub: 'visitors this week. one was mom.' },
		{ label: 'lighthouse uptime', value: '99.98%', sub: 'the .02 was planned. mostly.' },
		{ label: 'postcards', value: `${pubProjects} / ${h.projects.length}`, sub: 'published / in the rack' },
		{ label: 'graveyard census', value: String(resting), sub: 'resting. none dead.' },
	];

	const errands = [
		{ label: 'write a new postcard', run: () => { h.goTo('projects'); h.openEdit('project', null); } },
		{ label: 'draft a note', run: () => { h.goTo('notes'); h.openEdit('note', null); } },
		{ label: 'pick up a hobby (again)', run: () => { h.goTo('hobbies'); h.openEdit('hobby', null); } },
		{ label: 'hoist the lantern', run: () => { void h.hoistLantern(); } },
	];

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">the bridge · {dateLine()}</span>
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
					<span className="card-kicker">the ship's log</span>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
						{h.activity.slice(0, 6).map((entry) => (
							<div key={entry.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', borderTop: '1px solid var(--border-hair)', paddingTop: 11 }}>
								<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)', width: 80, flexShrink: 0 }}>
									{relativeTime(entry.timestamp)}
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

				<div className="card tilt" style={{ '--tilt': '.25deg', display: 'flex', flexDirection: 'column', gap: 13 } as React.CSSProperties}>
					<span className="card-kicker">harbor traffic · this week</span>
					<div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 64 }}>
						{TRAFFIC.map((bar) => (
							<div key={bar.d} title={`${bar.d} · ${bar.v} ships`} style={{
								flex: 1, height: `${Math.round((bar.v / 238) * 100)}%`, minHeight: 6,
								borderRadius: '3px 3px 0 0',
								background: bar.v === 238 ? 'linear-gradient(180deg,#f0d9a8,#8f7f4d)' : 'linear-gradient(180deg,#93a0e8,#3b4374)',
							}} />
						))}
					</div>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>1,204 ships sighted · busiest: thursday</span>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.7, borderTop: '1px solid var(--border-hair)', paddingTop: 11 }}>
						<span style={{ color: 'var(--text-body)' }}>top postcard · <span style={{ color: 'var(--gold)' }}>"Meo Wave Race" — 214 flips</span></span>
						<span style={{ color: 'var(--text-body)' }}>top note · <span style={{ color: 'var(--text-soft)' }}>"The queue is the product" — 178 reads</span></span>
						<span style={{ color: 'var(--text-body)' }}>ports of origin · <span style={{ color: 'var(--text-soft)' }}>search 44% · direct 31% · fediverse 25%</span></span>
					</div>
				</div>

				<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
					<div className="card card--gold tilt" style={{ '--tilt': '.3deg', display: 'flex', flexDirection: 'column', gap: 12 } as React.CSSProperties}>
						<span className="card-kicker card-kicker--gold">quick errands</span>
						<div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
							{errands.map((errand) => (
								<div key={errand.label} className="errand" onClick={errand.run}>→ {errand.label}</div>
							))}
						</div>
					</div>
					<div className="card card--alt tilt" style={{ '--tilt': '-.3deg', display: 'flex', flexDirection: 'column', gap: 10 } as React.CSSProperties}>
						<span className="card-kicker">harbor conditions</span>
						<div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.7 }}>
							<span style={{ color: 'var(--text-body)' }}>api · <span style={{ color: 'var(--gold)' }}>● steady</span></span>
							<span style={{ color: 'var(--text-body)' }}>media store · <span style={{ color: 'var(--gold)' }}>● steady</span></span>
							<span style={{ color: 'var(--text-body)' }}>newsletter cron · <span style={{ color: 'var(--gold)' }}>● ambitious</span></span>
							<span style={{ color: 'var(--text-body)' }}>home lab · <span style={{ color: 'var(--periwinkle)' }}>● one tweak from perfect</span></span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
