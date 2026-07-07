// Sidebar: brand, nav, the harbor cat, the lantern panel, and the way ashore.
// Fixed rail on desktop; below the drawer breakpoint it hides until the shell's
// hamburger opens it as an overlay drawer (layout lives in App.css).
import { useState, useRef } from 'react';
import { useHarbor } from '../state/harbor';
import type { Screen } from '../state/harbor';
import { CAT_QUOTES } from '../lib/whimsy';
import { relativeTime } from '../lib/time';
import { Boat, HarborCat, LighthouseMark } from './art';

const NAV: { id: Screen; glyph: string; label: string }[] = [
	{ id: 'dash', glyph: '✦', label: 'the bridge' },
	{ id: 'projects', glyph: '✉', label: 'postcards' },
	{ id: 'hobbies', glyph: '†', label: 'the graveyard' },
	{ id: 'notes', glyph: '✎', label: 'writing desk' },
	{ id: 'copy', glyph: '⚑', label: 'signal flags' },
	{ id: 'eggs', glyph: '✧', label: "smuggler's hold" },
	{ id: 'shop', glyph: '♆', label: 'the figurehead shop' },
	{ id: 'media', glyph: '❏', label: 'the darkroom' },
	{ id: 'keeper', glyph: '☸', label: 'the keeper' },
];

function Lantern() {
	const h = useHarbor();

	if (h.lanternAbsent) {
		return (
			<div className="card card--alt" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, transform: 'rotate(-.4deg)' }}>
				<span className="card-kicker" style={{ fontSize: 10.5, color: 'var(--periwinkle-deep)' }}>the lantern</span>
				<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--periwinkle-deep)' }}>○ not rigged in this harbor</span>
			</div>
		);
	}

	const lastHoisted = h.lantern?.lastHoistedAt ? relativeTime(h.lantern.lastHoistedAt) : 'never';

	return (
		<div className="card card--alt" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, transform: 'rotate(-.4deg)' }}>
			<span className="card-kicker" style={{ fontSize: 10.5, color: 'var(--periwinkle-deep)' }}>the lantern</span>
			{h.deploying ? (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<div className="wave-strip" style={{ position: 'relative', height: 20, overflow: 'visible', backgroundPosition: 'bottom' }}>
						<div style={{ position: 'absolute', top: -8, left: `calc(${Math.min(h.deployPct, 96)}% - 11px)`, transition: 'left .3s linear' }}>
							<Boat width={22} height={18} bobDuration="1.2s" />
						</div>
					</div>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)' }}>
						{h.lantern?.state === 'swapping' ? 'docking…' : `rebuilding · ${Math.floor(h.deployPct)}%`}
					</span>
				</div>
			) : (
				<>
					<button className="btn btn--gold" onClick={h.hoistLantern} style={{ padding: '11px 14px', fontSize: 12.5 }}>
						hoist the lantern
					</button>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--periwinkle-deep)' }}>
						last hoisted: {lastHoisted}
					</span>
					{h.dirtyCount > 0 ? (
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--gold)' }}>
							◍ {h.dirtyCount} change{h.dirtyCount === 1 ? '' : 's'} aboard since last hoist
						</span>
					) : (
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--periwinkle-deep)' }}>
							○ nothing new aboard
						</span>
					)}
					<span className="ghost-link" style={{ fontSize: 11, color: h.confirmKey === 'rollback' ? 'var(--gold)' : undefined }}
						onClick={() => h.askConfirm('rollback', h.rollbackLantern)}>
						{h.confirmKey === 'rollback' ? '↩ sure? sail backwards.' : '↩ re-hoist the previous lantern'}
					</span>
				</>
			)}
		</div>
	);
}

interface Props {
	open:       boolean;
	onNavigate: () => void;
}

export default function Sidebar({ open, onNavigate }: Props) {
	const h = useHarbor();
	const [catSay, setCatSay] = useState<string | null>(null);
	const catTimer = useRef<number>(undefined);

	const pokeCat = () => {
		window.clearTimeout(catTimer.current);
		const others = CAT_QUOTES.filter((q) => q !== catSay);
		setCatSay(others[Math.floor(Math.random() * others.length)]);
		catTimer.current = window.setTimeout(() => setCatSay(null), 2600);
	};

	return (
		<div id="office-sidebar" className={`office-sidebar${open ? ' office-sidebar--open' : ''}`}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '0 6px 18px' }}>
				<LighthouseMark style={{ transform: 'rotate(-4deg)' }} />
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--text-nav)' }}>argsea</span>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: 'var(--periwinkle-deep)', textTransform: 'uppercase' }}>harbormaster</span>
				</div>
			</div>

			{NAV.map((item) => (
				<div key={item.id}
					className={`nav-item${h.screen === item.id ? ' nav-item--active' : ''}`}
					onClick={() => { h.goTo(item.id); onNavigate(); }}>
					<span style={{ width: 18, display: 'inline-block', textAlign: 'center' }}>{item.glyph}</span>
					{item.label}
				</div>
			))}

			<div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 20 }}>
				<div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', padding: '0 12px', height: 32 }}>
					{catSay && (
						<div style={{
							position: 'absolute', right: 46, bottom: 24, background: 'var(--overlay-card)',
							border: '1px solid rgba(150,160,220,.35)', borderRadius: '10px 10px 2px 10px', padding: '6px 11px',
							fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-soft)', whiteSpace: 'nowrap',
							animation: 'bubblePop .2s ease both', zIndex: 5,
						}}>{catSay}</div>
					)}
					<div className="cat-perch" onClick={pokeCat} title="the harbor cat">
						<HarborCat />
					</div>
				</div>

				<Lantern />

				<div className="ghost-link" style={{ fontSize: 12, padding: '4px 6px' }} onClick={() => { onNavigate(); h.goAshore(); }}>
					← go ashore
				</div>
			</div>
		</div>
	);
}
