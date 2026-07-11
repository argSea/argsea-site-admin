// Peek: the light entry/note rendered as the site would show it, from local
// state. Everything here is plain React text rendering; the body HTML is
// converted back to paragraphs, so nothing goes through innerHTML.
import { useHarbor } from '../state/harbor';
import { htmlToParagraphs } from '../lib/paragraphs';
import { printBackground } from '../lib/prints';
import { codeFor, DEFAULT_LIGHT, wordsFor } from '../lib/lightChar';
import { ShapeNode } from './ShapeEditor';
import Lamp from './Lamp';
import type { Doodle } from '../lib/api';

function PhotoPrint({ image, wide }: { image: string; wide?: boolean }) {
	const h = useHarbor();

	return (
		<div style={{
			background: 'var(--paper)', padding: wide ? '8px 8px 24px' : '8px 8px 26px', borderRadius: 2,
			boxShadow: '0 6px 16px rgba(0,0,0,.35)', transform: 'rotate(-1.5deg)',
			...(wide ? { alignSelf: 'flex-start', width: 'min(260px, 70%)' } : {}),
		}}>
			<div style={{ width: '100%', height: 140, borderRadius: 1, background: printBackground(h.prints, image) }} />
		</div>
	);
}

function DoodlePrint({ doodle, caption }: { doodle: Doodle; caption: string }) {
	return (
		<div style={{
			background: 'var(--paper)', padding: '8px 8px 24px', borderRadius: 2,
			boxShadow: '0 6px 16px rgba(0,0,0,.35)', transform: 'rotate(-1.5deg)',
			alignSelf: 'flex-start', width: 'min(220px, 70%)',
		}}>
			<svg viewBox={doodle.viewBox} width="100%" height="140" style={{ overflow: 'visible' }}>
				{doodle.shapes.map((s) => <ShapeNode key={s.id} s={s} />)}
			</svg>
			{caption && (
				<div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 12, color: 'var(--paper-name)', textAlign: 'center', marginTop: 6 }}>
					{caption}
				</div>
			)}
		</div>
	);
}

export default function PeekOverlay() {
	const h = useHarbor();
	const peek = h.peek;
	if (!peek) {
		return null;
	}

	const item = peek.type === 'project'
		? h.projects.find((p) => p.id === peek.id)
		: h.notes.find((n) => n.id === peek.id);
	if (!item) {
		return null;
	}
	const doodle = peek.type === 'note' && 'doodleId' in item ? h.doodles.find((d) => d.id === item.doodleId) : undefined;

	const statusLine = item.status === 'published' ? 'published: this is live' : 'draft: only you can see this';
	const paragraphs = htmlToParagraphs(item.body);

	return (
		<div className="overlay-backdrop" style={{ zIndex: 60 }} onClick={h.closePeek}>
			<div className="overlay-card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(820px, 100%)', borderColor: 'var(--border-chip)' }}>
				<div style={{
					display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
					padding: '16px clamp(20px, 4vw, 30px)', borderBottom: '1.5px dashed var(--border-input)',
				}}>
					<span className="card-kicker" style={{ letterSpacing: '.14em' }}>peek · {statusLine}</span>
					<span className="pill" style={{ color: 'var(--text-body)' }} onClick={h.closePeek}>close ✕</span>
				</div>

				{peek.type === 'project' && 'shortDesc' in item && (() => {
					const light = item.light ?? DEFAULT_LIGHT;
					const dark = Boolean(light.extinguished);
					// the gallery's first print leads; the dormant single-print field
					// only fills in for a light that predates the gallery
					const leadPrint = item.images && item.images.length > 0 ? item.images[0] : item.image;

					return (
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(20px, 4vw, 36px)', padding: 'clamp(20px, 4vw, 30px)' }}>
							<div style={{ flex: 1.5, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
									<Lamp light={light} size={18} haloScale={3.8} />
									<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
										<span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 32px)', color: 'var(--text-strong)', lineHeight: 1.15 }}>
											{item.title}
										</span>
										<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
											<span className={`pill ${dark ? 'pill--off' : 'pill--on'}`}>{dark ? `dark · ${light.extinguished}` : '● lit'}</span>
											<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, letterSpacing: '.1em', color: 'var(--text-soft)' }}>{codeFor(light)}</span>
										</div>
									</div>
								</div>
								<span style={{ fontSize: 14.5, fontStyle: 'italic', color: 'var(--text-quip)' }}>{wordsFor(light)}</span>
								<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--periwinkle)' }}>
									first lit · <span style={{ color: 'var(--text-soft)' }}>{item.firstLit}</span>
								</span>
								{paragraphs.length > 0 && (
									<div style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text-body-strong)', whiteSpace: 'pre-line' }}>
										{paragraphs.join('\n\n')}
									</div>
								)}
								<div style={{ fontSize: 15, color: 'var(--text-quip)', fontStyle: 'italic', marginTop: 4 }}>{item.moral}</div>
								{!leadPrint && (
									<div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle)', marginTop: 'auto' }}>
										{item.tags.join('  ·  ')}
									</div>
								)}
							</div>
							{leadPrint && (
								<div style={{
									flex: 1, minWidth: 200, borderLeft: '1.5px dashed var(--border-input)',
									paddingLeft: 'clamp(18px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 16,
								}}>
									<PhotoPrint image={leadPrint} />
									<div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle)', marginTop: 'auto' }}>
										{item.tags.join('  ·  ')}
									</div>
								</div>
							)}
						</div>
					);
				})()}

				{peek.type === 'note' && 'teaser' in item && (
					<div style={{ padding: 'clamp(22px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--periwinkle-deep)' }}>{item.date}</span>
						{item.conditions && (
							<span style={{ fontSize: 14, color: 'var(--text-quip)', fontStyle: 'italic' }}>{item.conditions}</span>
						)}
						<div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 30px)', color: 'var(--text-strong)', lineHeight: 1.2 }}>
							{item.title}
						</div>
						<div style={{ fontSize: 16, color: 'var(--text-quip)', fontStyle: 'italic' }}>{item.teaser}</div>
						{doodle && <DoodlePrint doodle={doodle} caption={item.doodleCaption} />}
						{paragraphs.length > 0 && (
							<div style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--text-body-strong)', whiteSpace: 'pre-line' }}>
								{paragraphs.join('\n\n')}
							</div>
						)}
						<div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--periwinkle)', marginTop: 8 }}>
							{h.keeper.signoff || '– j'}
						</div>
					</div>
				)}

				<div style={{ padding: '0 clamp(20px, 4vw, 30px) 18px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>
					// rendered as the site would show it. drafts go live only when published + hoisted.
				</div>
			</div>
		</div>
	);
}
