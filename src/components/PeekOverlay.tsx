// Peek: the postcard/note rendered as the site would show it, from local
// state. Everything here is plain React text rendering — the body HTML is
// converted back to paragraphs, so nothing goes through innerHTML.
import { useHarbor } from '../state/harbor';
import { htmlToParagraphs } from '../lib/paragraphs';
import { printBackground } from '../lib/prints';

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

	const statusLine = item.status === 'published' ? 'published — this is live' : 'draft — only you can see this';
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

				{peek.type === 'project' && 'shortDesc' in item && (
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(20px, 4vw, 36px)', padding: 'clamp(20px, 4vw, 30px)' }}>
						<div style={{ flex: 1.5, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
							<div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 32px)', color: 'var(--text-strong)', lineHeight: 1.15 }}>
								{item.title}
							</div>
							<div style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text-body-strong)' }}>{item.shortDesc}</div>
							{paragraphs.length > 0 && (
								<div style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text-body-strong)', whiteSpace: 'pre-line' }}>
									{paragraphs.join('\n\n')}
								</div>
							)}
							<div style={{ fontSize: 15, color: 'var(--text-quip)', fontStyle: 'italic', marginTop: 4 }}>{item.moral}</div>
						</div>
						<div style={{
							flex: 1, minWidth: 200, borderLeft: '1.5px dashed var(--border-input)',
							paddingLeft: 'clamp(18px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 16,
						}}>
							{item.image && <PhotoPrint image={item.image} />}
							<div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7 }}>
								<span style={{ color: 'var(--periwinkle-deep)' }}>to:</span>
								<span style={{ color: 'var(--text-soft)' }}>{item.postcardTo}</span>
								<span style={{ color: 'var(--periwinkle-deep)', marginTop: 6 }}>from:</span>
								<span style={{ color: 'var(--text-soft)' }}>{item.postcardFrom}</span>
								<span style={{ color: 'var(--periwinkle-deep)', marginTop: 6 }}>postmarked:</span>
								<span style={{ color: 'var(--text-soft)' }}>{item.postmarked}</span>
							</div>
							<div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle)', marginTop: 'auto' }}>
								{item.tags.join('  ·  ')}
							</div>
						</div>
					</div>
				)}

				{peek.type === 'note' && 'teaser' in item && (
					<div style={{ padding: 'clamp(22px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--periwinkle-deep)' }}>{item.date}</span>
						<div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 30px)', color: 'var(--text-strong)', lineHeight: 1.2 }}>
							{item.title}
						</div>
						<div style={{ fontSize: 16, color: 'var(--text-quip)', fontStyle: 'italic' }}>{item.teaser}</div>
						{item.image && <PhotoPrint image={item.image} wide />}
						{paragraphs.length > 0 && (
							<div style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--text-body-strong)', whiteSpace: 'pre-line' }}>
								{paragraphs.join('\n\n')}
							</div>
						)}
						<div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--periwinkle)', marginTop: 8 }}>
							{h.keeper.signoff || '— j'}
						</div>
					</div>
				)}

				<div style={{ padding: '0 clamp(20px, 4vw, 30px) 18px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>
					// rendered as the site would show it. drafts sail only when published + hoisted.
				</div>
			</div>
		</div>
	);
}
