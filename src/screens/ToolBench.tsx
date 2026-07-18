// The tool bench. The keeper's stores as drawers of tools, riding the copy
// singleton's stores through the same debounced autosave as the flags and the
// cove. Four drawers at most: the admin's rule, not the server's.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useHarbor, DRAWER_CAP } from '../state/harbor';
import CatPerch from '../components/CatPerch';
import './ToolBench.css';

const CAT_QUIPS = ['every drawer has been slept in.', 'four drawers. i counted.', 'none of these tools are for opening tins. noted.'];

export default function ToolBench() {
	const h = useHarbor();
	const [selIdx, setSelIdx] = useState(0);
	const [toolText, setToolText] = useState('');

	const stores = h.copy.stores;
	// a scrapped or stale selection falls back to the first drawer, like the mock
	const at = stores[selIdx] ? selIdx : 0;
	const sel = stores[at];
	const full = stores.length >= DRAWER_CAP;
	const armed = h.confirmKey === `drawer-${at}`;

	const addTool = (event: FormEvent) => {
		event.preventDefault();
		const value = toolText.trim();
		if (!value || !sel) {
			return;
		}
		h.setDrawer(at, { tools: [...sel.tools, value] });
		setToolText('');
	};

	const scrap = () => {
		h.askConfirm(`drawer-${at}`, () => {
			h.removeDrawer(at);
			setSelIdx(0);
			h.showToast('🪓 the drawer went overboard.');
		});
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22, position: 'relative' }}>
			<CatPerch quips={CAT_QUIPS} pose="lying" style={{ top: -10, right: 22 }} />
			<div className="screen-head__text" style={{ animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">the stores</span>
				<span className="page-title">The tool bench</span>
				<span className="page-sub">What earns the shelf, sorted into drawers. Four drawers at most: a bench with more is a shed.</span>
			</div>

			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'flex-start', animation: 'fadeUp .7s ease .15s both' }}>
				<div style={{ flex: '1 1 230px', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
					{stores.map((drawer, i) => (
						<div key={i} className={`bench-drawer${i === at ? ' bench-drawer--on' : ''}`} onClick={() => setSelIdx(i)}>
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: i === at ? 'var(--gold)' : 'var(--text-soft)' }}>{drawer.label}</span>
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)', whiteSpace: 'nowrap' }}>
								{drawer.tools.length} tool{1 === drawer.tools.length ? '' : 's'}
							</span>
						</div>
					))}
					{!full && (
						<button className="dash-add" style={{ padding: '12px 16px' }}
							onClick={() => { h.addDrawer(); setSelIdx(stores.length); }}>+ a new drawer</button>
					)}
					{full && (
						<span className="footnote" style={{ fontSize: 11.5, lineHeight: 1.6, padding: '0 4px' }}>// the bench is full. four drawers is plenty.</span>
					)}
				</div>

				{sel && (
					<div style={{
						flex: '2 1 340px', background: 'var(--well)', border: '1px solid var(--border-card-alt)',
						borderRadius: 14, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16,
					}}>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
							<input type="text" className="input input--inset" title="the drawer's label. write on the brass plate."
								style={{ flex: '1 1 180px', padding: '9px 14px', color: 'var(--gold)', fontSize: 13.5, letterSpacing: '.06em' }}
								value={sel.label}
								onChange={(e) => h.setDrawer(at, { label: e.target.value })} />
							<span className="ghost-link ghost-link--danger" style={{ fontSize: 11.5 }} onClick={scrap}>
								{armed ? 'sure? it all goes overboard' : 'scrap this drawer'}
							</span>
						</div>
						<div style={{ display: 'flex', gap: '10px 9px', flexWrap: 'wrap', alignItems: 'center' }}>
							{sel.tools.map((tool, i) => (
								<span key={i} className="bench-chip">
									{tool}
									<span className="bench-chip__x" title="off the bench"
										onClick={() => h.setDrawer(at, { tools: sel.tools.filter((_, k) => k !== i) })}>×</span>
								</span>
							))}
							{0 === sel.tools.length && (
								<span style={{ fontSize: 14, color: 'var(--periwinkle-deep)', fontStyle: 'italic' }}>an empty drawer. it happens to the best benches.</span>
							)}
						</div>
						<form onSubmit={addTool} style={{ display: 'flex', gap: 10, margin: 0, flexWrap: 'wrap' }}>
							<input type="text" className="input input--inset" placeholder="a tool that earned the shelf..."
								style={{ flex: '1 1 200px', borderRadius: 999, padding: '10px 16px', color: 'var(--text-soft)', fontSize: 12.5 }}
								value={toolText}
								onChange={(e) => setToolText(e.target.value)} />
							<button type="submit" className="bench-add">+ into the drawer</button>
						</form>
						<span className="footnote" style={{ fontSize: 11.5 }}>// a tool earns its drawer by paging me at least once.</span>
					</div>
				)}
			</div>
		</div>
	);
}
