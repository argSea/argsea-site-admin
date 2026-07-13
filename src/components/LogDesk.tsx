// The log desk: the full-screen block editor a full log is written in, a
// value-for-value translation of the design mock's THE LOG DESK. The header
// lives in the blocks (title, subhead, facts, established/tags), seeded from the
// light and owned by the log. Every edit autosaves through the harbor; this
// screen stays markup-heavy and logic-light. The insert palette, the darkroom
// picker, and save-a-block-set ride along as desk-scoped sub-overlays.
import { useEffect, useRef } from 'react';
import { useHarbor } from '../state/harbor';
import type { EditorBlock } from '../state/harbor';
import { BLOCK_PALETTE, BLOCK_TYPE_LABEL } from '../state/harbor';
import { printBackground } from '../lib/prints';
import { useEscapeKey } from '../lib/useEscapeKey';
import MermaidPreview from './MermaidPreview';

const mono = 'var(--font-mono)';
const CORAL = '#e77a70';

const goldButton: React.CSSProperties = {
	background: 'var(--gold)', color: 'var(--btn-text-gold)', border: 'none', borderRadius: 8,
	fontFamily: mono, fontSize: 12.5, boxShadow: '2px 2px 0 rgba(147,160,232,.6)', cursor: 'pointer',
};

const wellInput: React.CSSProperties = {
	boxSizing: 'border-box', background: 'var(--well)', border: '1px solid var(--border-input)',
	borderRadius: 6, padding: '7px 10px', color: 'var(--text-base)', fontFamily: mono, fontSize: 13, outline: 'none',
};

const bareText: React.CSSProperties = {
	width: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none', outline: 'none',
};

const ctrl: React.CSSProperties = {
	fontFamily: mono, fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer', padding: '3px 7px',
	borderRadius: 6, userSelect: 'none',
};

const markChip: React.CSSProperties = {
	fontFamily: mono, fontSize: 12, color: 'var(--text-soft)', cursor: 'pointer', padding: '5px 10px',
	border: '1px solid rgba(150,160,220,.28)', borderRadius: 7, userSelect: 'none',
};

const backdrop: React.CSSProperties = {
	position: 'fixed', inset: 0, zIndex: 77, background: 'rgba(8,10,20,.65)', backdropFilter: 'blur(4px)',
	display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(14px,3vw,40px)',
	animation: 'backdropIn .2s ease both',
};

const CALLOUT: Record<string, { c: string; bg: string; bd: string }> = {
	note:       { c: 'var(--periwinkle)', bg: 'rgba(147,160,232,.08)', bd: 'rgba(147,160,232,.4)' },
	warning:    { c: 'var(--gold)',       bg: 'rgba(240,217,168,.08)', bd: 'rgba(240,217,168,.45)' },
	'dead-end': { c: CORAL,               bg: 'rgba(231,122,112,.08)', bd: 'rgba(231,122,112,.45)' },
};

function AddChip({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<span onClick={onClick} style={{
			alignSelf: 'flex-start', fontFamily: mono, fontSize: 11.5, color: 'var(--periwinkle)', cursor: 'pointer',
			padding: '4px 10px', border: '1px dashed rgba(150,160,220,.4)', borderRadius: 999,
		}}>{label}</span>
	);
}

function RowDel({ onClick }: { onClick: () => void }) {
	return (
		<span onClick={onClick} style={{ cursor: 'pointer', fontFamily: mono, fontSize: 12, color: 'var(--periwinkle-deep)', padding: '4px 6px' }}>✕</span>
	);
}

function Thumb({ image, label, onPick, size = 150 }: { image: string; label: string; onPick: () => void; size?: number }) {
	const h = useHarbor();
	return (
		<div onClick={onPick} title="pick from the darkroom" style={{
			width: size, height: 100, flex: 'none', borderRadius: 8, cursor: 'pointer',
			background: printBackground(h.prints, image), border: '1px solid var(--border-chip)',
			display: 'flex', alignItems: 'flex-end', padding: 7, overflow: 'hidden',
		}}>
			<span style={{ fontFamily: mono, fontSize: 9, color: 'rgba(255,255,255,.7)', wordBreak: 'break-all' }}>{label}</span>
		</div>
	);
}

function BlockCard({ block, index }: { block: EditorBlock; index: number }) {
	const h = useHarbor();
	const bid = block.bid;
	const selected = h.blockSel.includes(bid);
	const set = (patch: Record<string, unknown>) => h.setBlock(bid, patch);

	const wrap: React.CSSProperties = selected
		? { display: 'flex', flexDirection: 'column', gap: 7, padding: 12, background: 'rgba(240,217,168,.06)', boxShadow: 'inset 3px 0 0 var(--gold)', borderRadius: 6 }
		: { display: 'flex', flexDirection: 'column', gap: 7, padding: '12px 0', borderBottom: '1px solid rgba(150,160,220,.07)' };

	return (
		<div data-block-kind={block.kind} style={wrap}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
				<span onClick={() => h.toggleBlockSel(bid)} title="select for a block set"
					style={{ cursor: 'pointer', fontFamily: mono, fontSize: 13, color: 'var(--periwinkle)', padding: '2px 5px', userSelect: 'none' }}>
					{selected ? '◉' : '○'}
				</span>
				<span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '.13em', color: 'var(--periwinkle-deep)', textTransform: 'uppercase', marginRight: 'auto' }}>
					{block.kind === 'callout' ? `${block.register} callout` : block.kind === 'list' ? (block.ordered ? 'ordered list' : 'list') : BLOCK_TYPE_LABEL[block.kind]}
				</span>
				<span onClick={() => h.moveBlock(bid, -1)} title="move up" style={ctrl}>↑</span>
				<span onClick={() => h.moveBlock(bid, 1)} title="move down" style={ctrl}>↓</span>
				<span onClick={() => h.dupBlock(bid)} title="duplicate" style={ctrl}>⧉</span>
				<span onClick={() => h.openInsert(index + 1)} title="insert below" style={ctrl}>＋</span>
				<span onClick={() => h.deleteBlock(bid)} title="delete" style={{ ...ctrl, color: CORAL }}>✕</span>
			</div>

			{block.kind === 'heading' && (
				<textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={1}
					style={{ ...bareText, borderLeft: '2px solid rgba(240,217,168,.45)', padding: '2px 0 2px 14px', color: 'var(--text-strong)', fontFamily: 'var(--font-display)', fontSize: 'clamp(23px,3.2vw,30px)', lineHeight: 1.15, resize: 'none' }} />
			)}
			{block.kind === 'title' && (
				<textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={1} placeholder="the light's title"
					style={{ ...bareText, color: 'var(--text-strong)', fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4.6vw,44px)', lineHeight: 1.05, resize: 'none' }} />
			)}
			{block.kind === 'subhead' && (
				<textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={2} placeholder="a one-line subhead"
					style={{ ...bareText, color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 'clamp(17px,2.4vw,20px)', lineHeight: 1.5, resize: 'vertical' }} />
			)}
			{block.kind === 'meta' && (
				<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: mono, fontSize: 12, color: 'var(--periwinkle-deep)' }}>
					<span>established</span>
					<input type="text" value={block.established} onChange={(e) => set({ established: e.target.value })} style={{ ...wellInput, width: 140 }} />
					<span style={{ color: 'var(--periwinkle)' }}>tags</span>
					<input type="text" value={block.tags.join(', ')} placeholder="comma, separated"
						onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
						style={{ ...wellInput, flex: 1, minWidth: 160 }} />
				</div>
			)}
			{block.kind === 'paragraph' && (
				<textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={3} placeholder="a paragraph..."
					style={{ ...bareText, color: 'var(--text-soft)', fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.65, resize: 'vertical' }} />
			)}
			{block.kind === 'quote' && (
				<textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={2} placeholder="a line from the log..."
					style={{ ...bareText, borderLeft: '2px solid var(--gold-dash-mid)', paddingLeft: 16, color: '#c8b98a', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 17, lineHeight: 1.6, resize: 'vertical' }} />
			)}
			{block.kind === 'list' && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<span onClick={() => set({ ordered: !block.ordered })} style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--periwinkle)', cursor: 'pointer', alignSelf: 'flex-start' }}>
						{block.ordered ? 'ordered' : 'bulleted'} · switch
					</span>
					{block.items.map((item, k) => (
						<div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
							<span style={{ fontFamily: mono, fontSize: 14, color: 'var(--gold)', width: 18, flex: 'none', textAlign: 'right' }}>{block.ordered ? `${k + 1}.` : '•'}</span>
							<input type="text" value={item} onChange={(e) => h.setRow(bid, 'items', k, { val: e.target.value })}
								style={{ ...wellInput, flex: 1, fontFamily: 'var(--font-body)', fontSize: 16 }} />
							<RowDel onClick={() => h.delRow(bid, 'items', k)} />
						</div>
					))}
					<AddChip label="+ item" onClick={() => h.addRow(bid, 'items', '')} />
				</div>
			)}
			{block.kind === 'code' && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#0d1120', border: '1px solid rgba(150,160,220,.2)', borderRadius: 10, padding: '12px 14px' }}>
					<input type="text" value={block.lang} onChange={(e) => set({ lang: e.target.value })} placeholder="language"
						style={{ ...wellInput, alignSelf: 'flex-start', fontSize: 11, padding: '4px 8px', width: 130 }} />
					<textarea value={block.code} onChange={(e) => set({ code: e.target.value })} rows={5} placeholder="code..."
						style={{ ...bareText, color: '#cdd6f4', fontFamily: mono, fontSize: 13, lineHeight: 1.6, resize: 'vertical' }} />
				</div>
			)}
			{block.kind === 'mermaid' && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
					<textarea value={block.code} onChange={(e) => set({ code: e.target.value })} rows={5} placeholder="mermaid notation..."
						style={{ ...bareText, background: '#0d1120', border: '1px solid rgba(150,160,220,.2)', borderRadius: 10, padding: '12px 14px', color: '#cdd6f4', fontFamily: mono, fontSize: 12.5, lineHeight: 1.55, resize: 'vertical' }} />
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80, background: '#12162a', border: '1px solid rgba(150,160,220,.16)', borderRadius: 10, padding: 14, overflow: 'auto' }}>
						<MermaidPreview code={block.code} />
					</div>
				</div>
			)}
			{block.kind === 'facts' && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					{block.rows.map((row, k) => (
						<div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<input type="text" value={row.heading} onChange={(e) => h.setRow(bid, 'rows', k, { heading: e.target.value })} placeholder="label"
								style={{ ...wellInput, width: 150, flex: 'none', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '.1em', color: 'var(--periwinkle)' }} />
							<input type="text" value={row.fact} onChange={(e) => h.setRow(bid, 'rows', k, { fact: e.target.value })} placeholder="value"
								style={{ ...wellInput, flex: 1 }} />
							<RowDel onClick={() => h.delRow(bid, 'rows', k)} />
						</div>
					))}
					<AddChip label="+ fact" onClick={() => h.addRow(bid, 'rows', { heading: '', fact: '' })} />
				</div>
			)}
			{block.kind === 'outcomes' && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					{block.rows.map((row, k) => (
						<div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<input type="text" value={row.value} onChange={(e) => h.setRow(bid, 'rows', k, { value: e.target.value })} placeholder="the number"
								style={{ ...wellInput, width: 170, flex: 'none', fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--text-strong)' }} />
							<input type="text" value={row.caption} onChange={(e) => h.setRow(bid, 'rows', k, { caption: e.target.value })} placeholder="what it means"
								style={{ ...wellInput, flex: 1 }} />
							<RowDel onClick={() => h.delRow(bid, 'rows', k)} />
						</div>
					))}
					<AddChip label="+ outcome" onClick={() => h.addRow(bid, 'rows', { value: '', caption: '' })} />
				</div>
			)}
			{block.kind === 'figure' && (
				<div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
					<Thumb image={block.image} label={block.image} onPick={() => h.openDeskPick({ bid, kind: 'figure' })} />
					<div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
						<AddChip label="pick from the darkroom" onClick={() => h.openDeskPick({ bid, kind: 'figure' })} />
						<input type="text" value={block.caption} onChange={(e) => set({ caption: e.target.value })} placeholder="caption beneath the figure"
							style={{ ...wellInput, fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 14 }} />
					</div>
				</div>
			)}
			{block.kind === 'comparison' && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
					<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
						{block.stages.map((stage, k) => (
							<div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 160 }}>
								<Thumb image={stage.image} label={stage.image} size={160} onPick={() => h.openDeskPick({ bid, kind: 'comparison', idx: k })} />
								<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
									<input type="text" value={stage.label} onChange={(e) => h.setRow(bid, 'stages', k, { label: e.target.value })} placeholder="label"
										style={{ ...wellInput, flex: 1, fontSize: 11, padding: '5px 8px' }} />
									<RowDel onClick={() => h.delRow(bid, 'stages', k)} />
								</div>
							</div>
						))}
					</div>
					<AddChip label="+ stage" onClick={() => h.addRow(bid, 'stages', { image: '', label: 'stage' })} />
				</div>
			)}
			{block.kind === 'timeline' && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '2px solid rgba(147,160,232,.3)', paddingLeft: 14 }}>
					{block.rows.map((row, k) => (
						<div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
							<input type="text" value={row.date} onChange={(e) => h.setRow(bid, 'rows', k, { date: e.target.value })} placeholder="date"
								style={{ ...wellInput, width: 110, flex: 'none', color: 'var(--periwinkle)', fontSize: 11 }} />
							<input type="text" value={row.event} onChange={(e) => h.setRow(bid, 'rows', k, { event: e.target.value })} placeholder="what happened"
								style={{ ...wellInput, flex: 1, minWidth: 140, fontFamily: 'var(--font-body)', fontSize: 15 }} />
							<input type="text" value={row.link} onChange={(e) => h.setRow(bid, 'rows', k, { link: e.target.value })} placeholder="evidence link (optional)"
								style={{ ...wellInput, width: 150, fontSize: 11 }} />
							<RowDel onClick={() => h.delRow(bid, 'rows', k)} />
						</div>
					))}
					<AddChip label="+ entry" onClick={() => h.addRow(bid, 'rows', { date: '', event: '', link: '' })} />
				</div>
			)}
			{block.kind === 'links' && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					{block.rows.map((row, k) => (
						<div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
							<input type="text" value={row.label} onChange={(e) => h.setRow(bid, 'rows', k, { label: e.target.value })} placeholder="label"
								style={{ ...wellInput, width: 170, flex: 'none' }} />
							<input type="text" value={row.url} onChange={(e) => h.setRow(bid, 'rows', k, { url: e.target.value })} placeholder="https://"
								style={{ ...wellInput, flex: 1, minWidth: 140 }} />
							<RowDel onClick={() => h.delRow(bid, 'rows', k)} />
						</div>
					))}
					<AddChip label="+ link" onClick={() => h.addRow(bid, 'rows', { label: '', url: '' })} />
				</div>
			)}
			{block.kind === 'callout' && (
				<div style={{ border: `1px solid ${CALLOUT[block.register].bd}`, background: CALLOUT[block.register].bg, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
					<div style={{ display: 'flex', gap: 6 }}>
						{(['note', 'warning', 'dead-end'] as const).map((reg) => {
							const on = block.register === reg;
							return (
								<span key={reg} onClick={() => set({ register: reg })} style={{
									fontFamily: mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', padding: '3px 9px',
									borderRadius: 999, cursor: 'pointer', color: on ? 'var(--btn-text-gold)' : 'var(--text-body)',
									background: on ? CALLOUT[reg].c : 'transparent', border: `1px solid ${CALLOUT[block.register].bd}`,
								}}>{reg}</span>
							);
						})}
					</div>
					<textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={2} placeholder="the aside..."
						style={{ ...bareText, color: 'var(--text-base)', fontFamily: 'var(--font-body)', fontSize: 15.5, lineHeight: 1.55, resize: 'vertical' }} />
				</div>
			)}
		</div>
	);
}

function InsertPalette() {
	const h = useHarbor();
	const desk = h.desk;
	if (h.blockMenu == null || !desk) {
		return null;
	}
	const index = h.blockMenu;
	return (
		<div onClick={h.closeInsert} style={backdrop}>
			<div onClick={(e) => e.stopPropagation()} style={{
				width: 'min(440px,100%)', background: 'var(--overlay-card)', border: '1px solid var(--border-card)', borderRadius: 14,
				padding: 22, boxSizing: 'border-box', boxShadow: '0 30px 80px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column',
				gap: 14, animation: 'overlayIn .3s ease both',
			}}>
				<span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.14em', color: 'var(--periwinkle)', textTransform: 'uppercase' }}>insert a block</span>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
					{BLOCK_PALETTE.map((p) => (
						<span key={p.kind} onClick={() => h.addBlockAt(index, p.kind)} style={{
							fontFamily: mono, fontSize: 12.5, color: 'var(--text-soft)', cursor: 'pointer', padding: '11px 13px',
							border: '1px solid rgba(150,160,220,.22)', borderRadius: 9, background: 'var(--card-alt)',
						}}>{p.label}</span>
					))}
				</div>
				{h.blockSets.length > 0 && (
					<>
						<span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.14em', color: 'var(--periwinkle)', textTransform: 'uppercase', marginTop: 4 }}>block sets</span>
						<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
							{h.blockSets.map((set) => (
								<span key={set.id} data-block-set={set.name} onClick={() => h.addSetAt(index, set.id)} style={{
									display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: mono, fontSize: 12.5, color: 'var(--text-soft)',
									cursor: 'pointer', padding: '11px 13px', border: '1px dashed var(--gold-dash)', borderRadius: 9, background: 'rgba(240,217,168,.05)',
								}}>
									<span style={{ color: 'var(--gold)' }}>▤</span>{set.name}
									<span style={{ color: 'var(--periwinkle-deep)', marginLeft: 'auto' }}>{set.blocks.length} blocks</span>
								</span>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function DarkroomPicker() {
	const h = useHarbor();
	const fileRef = useRef<HTMLInputElement>(null);
	if (!h.deskPick) {
		return null;
	}
	return (
		<div onClick={h.closeDeskPick} style={{ ...backdrop, background: 'rgba(8,10,20,.7)', backdropFilter: 'blur(5px)' }}>
			<div onClick={(e) => e.stopPropagation()} style={{
				width: 'min(620px,100%)', maxHeight: '80vh', overflow: 'auto', background: 'var(--overlay-card)',
				border: '1px solid var(--border-card)', borderRadius: 14, padding: 22, boxSizing: 'border-box',
				boxShadow: '0 30px 80px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', gap: 14, animation: 'overlayIn .3s ease both',
			}}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
					<span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.14em', color: 'var(--periwinkle)', textTransform: 'uppercase' }}>the darkroom · pick a print</span>
					<span onClick={h.closeDeskPick} className="pill">close ✕</span>
				</div>
				<input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
					onChange={(e) => { const files = e.target.files; e.target.value = ''; if (files) { void h.developAndPick(files); } }} />
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 12 }}>
					<div onClick={() => fileRef.current?.click()} title="develop a new print into the darkroom" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}>
						<div style={{ width: '100%', height: 80, borderRadius: 7, border: '1.5px dashed var(--gold-dash-mid)', background: 'rgba(240,217,168,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', fontFamily: mono, fontSize: 22 }}>＋</div>
						<span style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--gold)' }}>develop a print</span>
					</div>
					{h.prints.map((print) => (
						<div key={print.id} onClick={() => h.chooseDeskPick(print.filename)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}>
							<div style={{ width: '100%', height: 80, borderRadius: 7, background: printBackground(h.prints, print.filename), border: '1px solid var(--border-input)' }} />
							<span style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--text-body)', wordBreak: 'break-all' }}>{print.filename}</span>
						</div>
					))}
				</div>
				<span style={{ fontFamily: mono, fontSize: 11, color: 'var(--periwinkle-deep)', lineHeight: 1.6 }}>
					// develop a print right here, or over in the darkroom tab. log images are darkroom references, independent of the light's own pictures.
				</span>
			</div>
		</div>
	);
}

function SaveSet() {
	const h = useHarbor();
	if (!h.tplName.open) {
		return null;
	}
	return (
		<div onClick={h.cancelSaveSet} style={{ ...backdrop, zIndex: 79, background: 'rgba(8,10,20,.68)' }}>
			<div onClick={(e) => e.stopPropagation()} style={{
				width: 'min(440px,100%)', background: 'var(--overlay-card)', border: '1px solid var(--gold-dash-mid)', borderRadius: 14,
				padding: 22, boxSizing: 'border-box', boxShadow: '0 30px 80px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column',
				gap: 14, animation: 'overlayIn .3s ease both',
			}}>
				<span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.14em', color: 'var(--gold)', textTransform: 'uppercase' }}>save a block set</span>
				<span style={{ fontSize: 14.5, color: 'var(--text-body)', lineHeight: 1.5 }}>Name the selected blocks. The set joins the insert menu, so you can drop it into any log.</span>
				<input type="text" value={h.tplName.value} onChange={(e) => h.setTplName(e.target.value)} placeholder="e.g. header"
					autoFocus style={{ ...wellInput, padding: '11px 13px', color: 'var(--text-strong)', fontSize: 14 }} />
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
					<span onClick={h.cancelSaveSet} className="pill">cancel</span>
					<button onClick={() => { void h.confirmSaveSet(); }} style={{ ...goldButton, padding: '10px 20px' }}>save the set</button>
				</div>
			</div>
		</div>
	);
}

export default function LogDesk() {
	const h = useHarbor();
	const desk = h.desk;

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && (event.key === 'z' || event.key === 'Z')) {
				event.preventDefault();
				if (event.shiftKey) {
					h.deskRedo();
				} else {
					h.deskUndo();
				}
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [h]);

	// peel the desk's own overlays back one at a time; the publish confirm owns
	// its own Escape, so defer to it while it is up
	useEscapeKey(Boolean(desk), () => {
		if (h.logConfirm) {
			return;
		}
		if (h.tplName.open) {
			h.cancelSaveSet();
		} else if (h.deskPick) {
			h.closeDeskPick();
		} else if (h.blockMenu != null) {
			h.closeInsert();
		} else {
			h.closeDesk();
		}
	});

	if (!desk) {
		return null;
	}

	const project = h.projects.find((p) => p.id === desk.projectId);
	const isLit = desk.status === 'published';
	const selCount = h.blockSel.length;
	const statePill: React.CSSProperties = isLit
		? { fontFamily: mono, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 999, color: 'var(--gold)', border: '1px solid rgba(240,217,168,.55)', background: 'rgba(240,217,168,.12)' }
		: { fontFamily: mono, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 999, color: 'var(--periwinkle)', border: '1px dashed rgba(147,160,232,.55)', background: 'rgba(147,160,232,.08)' };

	return (
		<div style={{ position: 'fixed', inset: 0, zIndex: 75, background: '#0a0d1a', display: 'flex', flexDirection: 'column', animation: 'backdropIn .25s ease both' }}>
			<div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(150,160,220,.16)', background: 'rgba(15,18,32,.96)' }}>
				<span onClick={h.closeDesk} style={{ cursor: 'pointer', fontFamily: mono, fontSize: 12.5, color: 'var(--text-body)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>← the logs shelf</span>
				<div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
					<span style={{ fontFamily: mono, fontSize: 11, color: 'var(--periwinkle-deep)' }}>saved · draft rev {desk.revision}</span>
					<button onClick={() => h.askPublishLog(desk.id)} style={{ ...goldButton, padding: '9px 18px' }}>{isLit ? 'lit on the coast' : 'publish this log'}</button>
				</div>
			</div>

			<div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', padding: '9px 20px', borderBottom: '1px solid rgba(150,160,220,.1)', background: 'rgba(12,15,28,.92)' }}>
				<span style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--periwinkle-deep)', textTransform: 'uppercase', letterSpacing: '.12em', marginRight: 2 }}>marks</span>
				<span onClick={() => h.applyMark('bold')} title="bold" style={{ ...markChip, fontWeight: 700 }}>B</span>
				<span onClick={() => h.applyMark('italic')} title="italic" style={{ ...markChip, fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>I</span>
				<span onClick={() => h.applyMark('code')} title="inline code" style={markChip}>&lt;/&gt;</span>
				<span onClick={() => h.applyMark('link')} title="link" style={markChip}>link</span>
				<span onClick={() => h.applyMark('chip')} title="keeper chip · a fact only you can fill" style={{ ...markChip, color: 'var(--gold)', borderColor: 'rgba(240,217,168,.45)' }}>[?]</span>
				<span style={{ width: 1, height: 20, background: 'rgba(150,160,220,.2)', margin: '0 4px' }} />
				<span onClick={h.deskUndo} title="undo" style={markChip}>↶</span>
				<span onClick={h.deskRedo} title="redo" style={markChip}>↷</span>
				<div style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto' }}>
					{selCount > 0 && (
						<>
							<span onClick={h.openSaveSet} title="save the selected blocks as a reusable set" style={{ ...markChip, color: 'var(--gold)', border: '1px dashed var(--gold-dash-mid)' }}>save set ({selCount})</span>
							<span onClick={h.clearBlockSel} style={{ fontFamily: mono, fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer', padding: '5px 8px', userSelect: 'none' }}>clear</span>
						</>
					)}
					<span onClick={() => h.openInsert(desk.blocks.length)} style={{ ...markChip, color: 'var(--gold)', borderColor: 'var(--gold-dash-mid)' }}>＋ block</span>
				</div>
			</div>

			<div style={{ flex: 1, overflow: 'auto', padding: 'clamp(24px,4vw,54px) 20px 90px' }}>
				<div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
						<span style={{ fontFamily: mono, fontSize: 13, letterSpacing: '.16em', color: 'var(--periwinkle)', textTransform: 'uppercase' }}>the light list · no. {h.regNo(desk.projectId)}</span>
						<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
							<svg width="14" height="17" viewBox="0 0 26 30" fill="none"><path d="M13 2 L17 9 L9 9 Z" fill="#f0d9a8" /><rect x="10" y="9" width="6" height="14" fill="none" stroke="#93a0e8" strokeWidth="1.4" /><path d="M10 13 h6 M10 17 h6" stroke="#93a0e8" strokeWidth="1.4" /></svg>
							<span style={statePill}>{isLit ? 'lit' : 'draft'}</span>
						</span>
						<span style={{ fontFamily: mono, fontSize: 11, color: 'var(--periwinkle-deep)', marginLeft: 'auto' }}>read-only from the light · {project?.slug ?? ''}</span>
					</div>
					<span style={{ marginTop: 12, fontFamily: mono, fontSize: 11, color: 'var(--periwinkle-deep)', lineHeight: 1.6 }}>
						// the header lives in the blocks below (title, subhead, facts, established/tags), seeded from the light and owned by this log. select blocks with the ○ and save a set as a template.
					</span>
					<div style={{ marginTop: 26, borderTop: '1px solid rgba(150,160,220,.16)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
						{desk.blocks.map((block, index) => (
							<BlockCard key={block.bid} block={block} index={index} />
						))}
						{desk.blocks.length === 0 && (
							<span style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 15, color: 'var(--text-dim)', padding: '12px 2px' }}>A blank desk. Add the first block below.</span>
						)}
						<div onClick={() => h.openInsert(desk.blocks.length)} style={{ marginTop: 10, border: '1.5px dashed var(--border-chip)', borderRadius: 10, padding: 13, textAlign: 'center', fontFamily: mono, fontSize: 12, color: 'var(--periwinkle)', cursor: 'pointer' }}>＋ add a block</div>
					</div>
				</div>
			</div>

			<InsertPalette />
			<DarkroomPicker />
			<SaveSet />
		</div>
	);
}
