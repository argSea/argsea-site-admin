// Groundskeeping. Hobbies move between learning and resting, reorder within
// their group, and the "next: ???" suggestion pool gets fed (responsibly).
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useHarbor } from '../state/harbor';
import type { Hobby } from '../lib/api';
import CatPerch from '../components/CatPerch';

const ROW_TILTS = ['-.4deg', '.35deg', '-.25deg', '.45deg', '-.5deg', '.3deg'];

const CAT_QUIPS = [
	'napping among the stones. respectfully.', 'every keeper buried here fed me once.', 'plot 03 is the warmest. do not tell running.',
];

function Row({ hobby, index }: { hobby: Hobby; index: number }) {
	const h = useHarbor();

	return (
		<div className={`content-row tilt ${hobby.active ? 'content-row--gold' : 'content-row--alt'}`}
			style={{ '--tilt': ROW_TILTS[index % 6] } as React.CSSProperties}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
				<div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
					<span className="row-title" style={hobby.active ? { color: 'var(--text-strong)' } : undefined}>{hobby.name}</span>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: hobby.active ? 'var(--periwinkle)' : 'var(--periwinkle-deep)' }}>
						{hobby.active ? `${hobby.service} · ${hobby.char}` : `${hobby.disposition} · ${hobby.service} · ${hobby.marker}`}
					</span>
				</div>
				<span style={{ fontSize: 14.5, color: hobby.active ? 'var(--text-body)' : 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.5 }}>
					{hobby.log}
				</span>
			</div>
			<div className="row-actions">
				<span className="pill pill--arrow" title="move up" onClick={() => h.moveHobby(hobby, -1)}>↑</span>
				<span className="pill pill--arrow" title="move down" onClick={() => h.moveHobby(hobby, 1)}>↓</span>
				<span className="pill" onClick={() => h.openEdit('hobby', hobby.id)}>edit</span>
				{hobby.active ? (
					<span className="pill" style={{ color: 'var(--text-body)' }} onClick={() => h.retireRevive(hobby)}>retire †</span>
				) : (
					<span className="chip-dashed" style={{ padding: '7px 14px' }} onClick={() => h.retireRevive(hobby)}>revive ↺</span>
				)}
			</div>
		</div>
	);
}

export default function Graveyard() {
	const h = useHarbor();
	const [newSuggestion, setNewSuggestion] = useState('');
	const learning = h.hobbies.filter((x) => x.active);
	const resting = h.hobbies.filter((x) => !x.active);

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
					<span className="kicker">groundskeeping</span>
					<span className="page-title">The hobby graveyard</span>
					<span className="page-sub">Move things between learning and resting. No judgment either way.</span>
				</div>
				<button className="btn" onClick={() => h.openEdit('hobby', null)}>+ pick something up</button>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp .7s ease .15s both' }}>
				<span className="card-kicker card-kicker--gold">currently learning</span>
				{learning.map((hobby, index) => <Row key={hobby.id} hobby={hobby} index={index} />)}

				<span className="card-kicker" style={{ marginTop: 10 }}>resting</span>
				{resting.map((hobby, index) => <Row key={hobby.id} hobby={hobby} index={index + learning.length} />)}
			</div>

			<div className="card card--alt tilt" style={{
				'--tilt': '.3deg', display: 'flex', flexDirection: 'column', gap: 12,
				animation: 'fadeUp .7s ease .25s both',
			} as React.CSSProperties}>
				<span className="card-kicker">the "next: ???" pool</span>
				<span style={{ fontSize: 14, color: 'var(--text-dim)', fontStyle: 'italic' }}>
					Suggestions the graveyard chip cycles through. Feed it responsibly.
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

			<span className="footnote">// the graveyard only grows. that's fine.</span>
		</div>
	);
}
