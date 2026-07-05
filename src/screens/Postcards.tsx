// The rack. Project CRUD, ↑/↓ reorder, the mantel (featured, cap of three),
// draft ⇄ publish pills, peek, and confirm-to-scuttle.
import { useHarbor } from '../state/harbor';
import type { Project } from '../lib/api';
import { printBackground } from '../lib/prints';
import Stamp from '../components/Stamp';

const ROW_TILTS = ['-.4deg', '.35deg', '-.25deg', '.45deg', '-.5deg', '.3deg'];

function Row({ project, index }: { project: Project; index: number }) {
	const h = useHarbor();
	const confirmHot = h.confirmKey === `proj-${project.id}`;

	return (
		<div className="content-row tilt" style={{ '--tilt': ROW_TILTS[index % 6] } as React.CSSProperties}>
			<div style={{ position: 'absolute', top: 12, right: 14 }}>
				<Stamp stamp={project.stamp} scale={0.78} />
			</div>
			{project.image && (
				<div className="photo-thumb">
					<div className="photo-thumb__img" style={{ background: printBackground(h.prints, project.image) }} />
				</div>
			)}
			<div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
				<div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
					<span className="row-title">{project.title}</span>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>{project.category}</span>
				</div>
				<span className="row-sub">{project.shortDesc}</span>
				<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle)' }}>{project.tags.join(' · ')}</span>
			</div>
			<div className="row-actions" style={{ paddingRight: 36 }}>
				<span className="pill pill--arrow" title="move up the rack" onClick={() => h.moveProject(project, -1)}>↑</span>
				<span className="pill pill--arrow" title="move down the rack" onClick={() => h.moveProject(project, 1)}>↓</span>
				<span className={`pill ${project.featured ? 'pill--on' : 'pill--feat-off'}`} onClick={() => h.toggleFeatured(project)}>
					{project.featured ? '★ on the mantel' : '☆ feature'}
				</span>
				<span className={`pill ${project.status === 'published' ? 'pill--on' : 'pill--off'}`} onClick={() => h.toggleProjectStatus(project)}>
					{project.status === 'published' ? '● published' : '○ draft'}
				</span>
				<span className="pill pill--quiet" title="preview as it would sail" onClick={() => h.openPeek('project', project.id)}>peek</span>
				<span className="pill" onClick={() => h.openEdit('project', project.id)}>edit</span>
				<span className={`pill ${confirmHot ? 'pill--danger' : 'pill--quiet'}`}
					onClick={() => h.askConfirm(`proj-${project.id}`, () => { void h.scuttleProject(project); })}>
					{confirmHot ? 'sure? scuttle.' : 'scuttle'}
				</span>
			</div>
		</div>
	);
}

export default function Postcards() {
	const h = useHarbor();
	const published = h.projects.filter((p) => p.status === 'published').length;
	const featured = h.projects.filter((p) => p.featured);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			<div className="screen-head">
				<div className="screen-head__text">
					<span className="kicker">the rack</span>
					<span className="page-title">Postcards from production</span>
					<span className="page-sub">
						{h.projects.length} in the rack · {published} published · {h.projects.length - published} waiting for a stamp
					</span>
				</div>
				<button className="btn" onClick={() => h.openEdit('project', null)}>+ new postcard</button>
			</div>

			<div className="card card--gold tilt" style={{
				'--tilt': '.3deg', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12,
				animation: 'fadeUp .7s ease .1s both',
			} as React.CSSProperties}>
				<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
					<span className="card-kicker card-kicker--gold">on the mantel · featured on the home page</span>
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
							room on the mantel — pin a card with ☆ below
						</span>
					)}
				</div>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp .7s ease .15s both' }}>
				{h.projects.map((project, index) => (
					<Row key={project.id} project={project} index={index} />
				))}
			</div>

			<span className="footnote">// drafts stay in the rack. published cards catch the next boat out.</span>
		</div>
	);
}
