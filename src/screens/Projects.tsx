// The rack. Light CRUD, ↑/↓ reorder, the front window (featured, cap of
// three), draft ⇄ publish pills, peek, and confirm-to-strike. A second tab,
// the coast, hands off to ProjectWall for the drag-to-place arrangement.
import { useState } from 'react';
import { useHarbor } from '../state/harbor';
import type { Project } from '../lib/api';
import { printBackground } from '../lib/prints';
import { codeFor, DEFAULT_LIGHT, GLOW_RGB } from '../lib/lightChar';
import Lamp from '../components/Lamp';
import ProjectWall from './ProjectWall';

const ROW_TILTS = ['-.4deg', '.35deg', '-.25deg', '.45deg', '-.5deg', '.3deg'];

function Row({ project, index }: { project: Project; index: number }) {
	const h = useHarbor();
	const confirmHot = h.confirmKey === `proj-${project.id}`;
	const light = project.light ?? DEFAULT_LIGHT;
	const charLine = project.firstLit ? `${codeFor(light)} · first lit ${project.firstLit}` : codeFor(light);

	return (
		<div className="content-row content-row--racked tilt" style={{ '--tilt': ROW_TILTS[index % 6] } as React.CSSProperties}>
			<div className="content-row__shelf">
				<Lamp light={light} size={10} haloScale={3.4} />
				<div className={`photo-thumb${project.image ? ' photo-thumb--paper' : ' photo-thumb--empty'}`}>
					<div className={`photo-thumb__img${project.image ? '' : ' photo-thumb__img--empty'}`}
						style={project.image ? { background: printBackground(h.prints, project.image) } : undefined} />
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
					<div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
						<span className="row-title">{project.title}</span>
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>{project.category}</span>
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '.07em', color: light.extinguished ? 'var(--text-dim)' : `rgb(${GLOW_RGB[light.color]})` }}>
							{charLine}
						</span>
					</div>
					<span className="row-sub">{project.shortDesc}</span>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle)' }}>{(project.tags ?? []).join(' · ')}</span>
				</div>
			</div>
			<div className="content-row__divider" />
			<div className="row-actions">
				<span className="pill pill--arrow" title="move up the rack" onClick={() => h.moveProject(project, -1)}>↑</span>
				<span className="pill pill--arrow" title="move down the rack" onClick={() => h.moveProject(project, 1)}>↓</span>
				<span className={`pill ${project.featured ? 'pill--on' : 'pill--feat-off'}`} onClick={() => h.toggleFeatured(project)}>
					{project.featured ? '★ in the window' : '☆ feature'}
				</span>
				{light.extinguished && (
					<span className="pill pill--off" title="extinguished · content, not visibility">dark · {light.extinguished}</span>
				)}
				<span className={`pill ${project.status === 'published' ? 'pill--on' : 'pill--off'}`} onClick={() => h.toggleProjectStatus(project)}>
					{project.status === 'published' ? '● published' : '○ draft'}
				</span>
				<span className="pill pill--quiet" title="preview as it will look live" onClick={() => h.openPeek('project', project.id)}>peek</span>
				<span className="pill" onClick={() => h.openEdit('project', project.id)}>edit</span>
				<span className={`pill ${confirmHot ? 'pill--danger' : 'pill--quiet'}`}
					onClick={() => h.askConfirm(`proj-${project.id}`, () => { void h.strikeProject(project); })}>
					{confirmHot ? 'sure? strike.' : 'strike'}
				</span>
			</div>
		</div>
	);
}

export default function Projects() {
	const h = useHarbor();
	const [tab, setTab] = useState<'rack' | 'coast'>('rack');
	const published = h.projects.filter((p) => p.status === 'published').length;
	const drafts = h.projects.length - published;
	const featured = h.projects.filter((p) => p.featured);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			<div className="screen-head">
				<div className="screen-head__text">
					<span className="kicker">the watch</span>
					<span className="page-title">The light list</span>
					<span className="page-sub">
						{h.projects.length} on the list · {published} published · {drafts} draft{drafts === 1 ? '' : 's'}
					</span>
				</div>
				<button className="btn" onClick={() => h.openEdit('project', null)}>+ kindle a light</button>
			</div>

			<div style={{ display: 'flex', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
				<span className={`pill ${tab === 'rack' ? 'pill--on' : 'pill--quiet'}`} onClick={() => setTab('rack')}>the rack</span>
				<span className={`pill ${tab === 'coast' ? 'pill--on' : 'pill--quiet'}`} onClick={() => setTab('coast')}>the coast</span>
			</div>

			{tab === 'coast' && <ProjectWall />}

			{tab === 'rack' && (
				<>
					<div className="card card--gold tilt" style={{
						'--tilt': '.3deg', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12,
						animation: 'fadeUp .7s ease .1s both',
					} as React.CSSProperties}>
						<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
							<span className="card-kicker card-kicker--gold">in the front window · featured on the home page</span>
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>{featured.length} of 3 spots filled</span>
						</div>
						<div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
							{featured.map((p) => (
								<span key={p.id} className="sway-chip sway-chip--gold">
									★ {p.title}
									<span className="chip-x" onClick={() => h.toggleFeatured(p)}>✕</span>
								</span>
							))}
							{featured.length < 3 && (
								<span style={{ fontSize: 13.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>
									room in the window, pin a light with ☆ below
								</span>
							)}
						</div>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp .7s ease .15s both' }}>
						{h.projects.map((project, index) => (
							<Row key={project.id} project={project} index={index} />
						))}
					</div>

					<span className="footnote">// a dark light stays on the list, the coast remembers. drafts catch the next lantern hoist once published.</span>
				</>
			)}
		</div>
	);
}
