// Sidebar: brand, nav, the lantern panel, and the way ashore. The harbor cat
// moved out to a perch per screen; this rail no longer carries one. Fixed rail
// on desktop; below the phone line it hides entirely and the sticky
// MobileTopbar stands in for it (layout lives in App.css).
import { Fragment } from 'react';
import { useHarbor } from '../state/harbor';
import { NAV_ITEMS } from '../lib/nav';
import { relativeTime } from '../lib/time';
import { Boat, LighthouseMark } from './art';

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
							◍ {h.dirtyCount} change{h.dirtyCount === 1 ? '' : 's'} in the tower since last hoist
						</span>
					) : (
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--periwinkle-deep)' }}>
							○ nothing new in the tower
						</span>
					)}
					<span className="ghost-link" style={{ fontSize: 11, color: h.confirmKey === 'rollback' ? 'var(--gold)' : undefined }}
						onClick={() => h.askConfirm('rollback', h.rollbackLantern)}>
						{h.confirmKey === 'rollback' ? '↩ sure? go back to the previous hoist.' : '↩ re-hoist the previous lantern'}
					</span>
				</>
			)}
		</div>
	);
}

export default function Sidebar() {
	const h = useHarbor();

	return (
		<div id="office-sidebar" className="office-sidebar">
			<div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '0 6px 18px' }}>
				<LighthouseMark style={{ transform: 'rotate(-4deg)' }} />
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--text-nav)' }}>argsea</span>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: 'var(--periwinkle-deep)', textTransform: 'uppercase' }}>lighthouse keeper</span>
				</div>
			</div>

			{NAV_ITEMS.map((item) => (
				<Fragment key={item.id}>
					{item.rule && <div className="nav-rule" aria-hidden="true" />}
					<div
						className={`nav-item${h.screen === item.id ? ' nav-item--active' : ''}`}
						onClick={() => h.goTo(item.id)}>
						<span style={{ width: 18, display: 'inline-block', textAlign: 'center' }}>{item.glyph}</span>
						{item.label}
					</div>
				</Fragment>
			))}

			<div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 20 }}>
				<Lantern />

				<div className="ghost-link" style={{ fontSize: 12, padding: '4px 6px' }} onClick={h.goAshore}>
					← go ashore
				</div>
			</div>
		</div>
	);
}
