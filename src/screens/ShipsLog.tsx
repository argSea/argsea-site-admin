// The wandering chart: the admin half of the ship's log. Hobbies sit at
// bearings in five states, ride between on-watch and off-the-fairway, reorder
// within their group, and the "next: ???" suggestion pool gets fed (responsibly).
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useHarbor } from '../state/harbor';
import type { Coord, Hobby, HobbyState } from '../lib/api';
import { HOBBY_STATES, onWatch } from '../lib/api';
import CatPerch from '../components/CatPerch';
import BearingChart from './BearingChart';

const ROW_TILTS = ['-.4deg', '.35deg', '-.25deg', '.45deg', '-.5deg', '.3deg'];

const CAT_QUIPS = [
	'i supervise the plotting.', 'none of them sank. i checked twice.', 'the home lab is the warmest berth.',
];

const STATE_LABELS = Object.fromEntries(HOBBY_STATES.map((s) => [s.key, s.label])) as Record<HobbyState, string>;

// Decimal degrees to the chart's D°M′ hemisphere reading; empty for an
// unplotted (migrated) mark, which simply reads by its service line until charted.
function fmtCoord(c: Coord | null): string {
	if (!c) {
		return '';
	}
	const part = (v: number, pos: string, neg: string): string => {
		const a = Math.abs(v);
		const d = Math.floor(a);
		const m = Math.round((a - d) * 60);
		return `${d}°${String(m).padStart(2, '0')}′${v >= 0 ? pos : neg}`;
	};
	return `${part(c.lat, 'N', 'S')} ${part(c.lon, 'E', 'W')}`;
}

function Row({ hobby, index }: { hobby: Hobby; index: number }) {
	const h = useHarbor();
	const onW = onWatch(hobby);
	const coord = fmtCoord(hobby.coord);
	const meta = (onW ? [hobby.service, coord] : [STATE_LABELS[hobby.state], hobby.service, coord]).filter(Boolean).join(' · ');

	return (
		<div className={`content-row tilt ${onW ? 'content-row--gold' : 'content-row--alt'}`}
			style={{ '--tilt': ROW_TILTS[index % 6] } as React.CSSProperties}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
				<div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
					<span className="row-title" style={onW ? { color: 'var(--text-strong)' } : undefined}>{hobby.name}</span>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: onW ? 'var(--periwinkle)' : 'var(--periwinkle-deep)' }}>
						{meta}
					</span>
				</div>
				<span style={{ fontSize: 14.5, color: onW ? 'var(--text-body)' : 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.5 }}>
					{hobby.bearing}
				</span>
			</div>
			<div className="row-actions">
				<span className="pill pill--arrow" title="move up" onClick={() => h.moveHobby(hobby, -1)}>↑</span>
				<span className="pill pill--arrow" title="move down" onClick={() => h.moveHobby(hobby, 1)}>↓</span>
				<span className="pill" onClick={() => h.openEdit('hobby', hobby.id)}>edit</span>
				{onW ? (
					<span className="pill" style={{ color: 'var(--text-body)' }} onClick={() => h.setAdriftOrPort(hobby)}>set adrift</span>
				) : (
					<span className="chip-dashed" style={{ padding: '7px 14px' }} onClick={() => h.setAdriftOrPort(hobby)}>bring to port</span>
				)}
			</div>
		</div>
	);
}

export default function ShipsLog() {
	const h = useHarbor();
	const [tab, setTab] = useState<'log' | 'chart'>('log');
	const [newSuggestion, setNewSuggestion] = useState('');
	const inPort = h.hobbies.filter(onWatch);
	const adrift = h.hobbies.filter((x) => !onWatch(x));

	const temptFate = (event: FormEvent) => {
		event.preventDefault();
		if (!newSuggestion.trim()) {
			return;
		}
		void h.addSuggestion(newSuggestion);
		setNewSuggestion('');
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22, position: 'relative', paddingBottom: 44 }}>
			<CatPerch quips={CAT_QUIPS} pose="lying" style={{ bottom: -6, right: 18 }} />
			<div className="screen-head">
				<div className="screen-head__text">
					<span className="kicker">chart room</span>
					<span className="page-title">The wandering chart</span>
					<span className="page-sub">Plot each hobby by where it drifted. Nothing sinks; some things just wander off the fairway.</span>
				</div>
				<button className="btn" onClick={() => h.openEdit('hobby', null)}>+ pick something up</button>
			</div>

			<div style={{ display: 'flex', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
				<span className={`pill ${tab === 'log' ? 'pill--on' : 'pill--quiet'}`} onClick={() => setTab('log')}>the wandering chart</span>
				<span className={`pill ${tab === 'chart' ? 'pill--on' : 'pill--quiet'}`} onClick={() => setTab('chart')}>the chart</span>
			</div>

			{tab === 'chart' && <BearingChart />}

			{tab === 'log' && (
				<>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp .7s ease .15s both' }}>
						<span className="card-kicker card-kicker--gold">in port · on watch</span>
						{inPort.map((hobby, index) => <Row key={hobby.id} hobby={hobby} index={index} />)}

						<span className="card-kicker" style={{ marginTop: 10 }}>off course · adrift</span>
						{adrift.map((hobby, index) => <Row key={hobby.id} hobby={hobby} index={index + inPort.length} />)}
					</div>

					<div className="card card--alt tilt" style={{
						'--tilt': '.3deg', display: 'flex', flexDirection: 'column', gap: 12,
						animation: 'fadeUp .7s ease .25s both',
					} as React.CSSProperties}>
						<span className="card-kicker">the "next: ???" pool</span>
						<span style={{ fontSize: 14, color: 'var(--text-dim)', fontStyle: 'italic' }}>
							Suggestions the chart's "next: ???" mark cycles through. Feed it responsibly.
						</span>
						<div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
							{h.suggestions.map((suggestion) => (
								<span key={suggestion.id} className="sway-chip">
									{suggestion.value}
									<span className="chip-x" onClick={() => h.removeSuggestion(suggestion)}>✕</span>
								</span>
							))}
						</div>
						<form onSubmit={temptFate} style={{ display: 'flex', gap: 10, margin: 0, flexWrap: 'wrap' }}>
							<input type="text" className="input" placeholder="blacksmithing? kayaking?"
								value={newSuggestion} onChange={(e) => setNewSuggestion(e.target.value)}
								style={{ flex: 1, minWidth: 180, width: 'auto', padding: '9px 12px', fontSize: 12.5 }} />
							<button type="submit" className="chip-dashed" style={{ padding: '9px 16px' }}>+ tempt fate</button>
						</form>
					</div>

					<span className="footnote">// the chart only gets more crowded. that's fine.</span>
				</>
			)}
		</div>
	);
}
