// The desk's diagram preview. Mermaid is a heavy dependency, so it is bundled
// but dynamically imported the first time a diagram block asks to render (its
// own vite chunk, never a CDN). Dark theme and mono type per the design mock's
// themeVariables. Every code change re-renders; a diagram that will not parse
// yet reads "diagram not valid yet" instead of throwing.
import { useEffect, useState } from 'react';

interface MermaidApi {
	initialize: (config: unknown) => void;
	render: (id: string, text: string) => Promise<{ svg: string }>;
}

let loading: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
	if (!loading) {
		// the self-contained ESM bundle (all diagram types inline): mermaid's
		// default `core` entry defers each diagram type to its own dynamic
		// import, which stalls under Vite dev; this bundle renders reliably in
		// dev and prod alike, and stays code-split behind this lazy import.
		// @ts-expect-error the bundled build has no bundled types; we cast below
		loading = import('mermaid/dist/mermaid.esm.mjs').then((mod) => {
			const mermaid = mod.default as unknown as MermaidApi;
			mermaid.initialize({
				startOnLoad: false,
				theme: 'dark',
				securityLevel: 'loose',
				themeVariables: {
					fontFamily: 'IBM Plex Mono, monospace',
					primaryColor: '#1a1e33',
					primaryTextColor: '#dde1f0',
					primaryBorderColor: '#93a0e8',
					lineColor: '#5f6ec4',
				},
			});
			return mermaid;
		});
	}
	return loading;
}

let renderSeq = 0;

export default function MermaidPreview({ code }: { code: string }) {
	const [svg, setSvg] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let current = true;
		setFailed(false);
		if (!code.trim()) {
			setSvg(null);
			return;
		}
		loadMermaid()
			.then((mermaid) => mermaid.render(`mm-${(renderSeq += 1).toString(36)}`, code))
			.then((result) => {
				if (current) {
					setSvg(result.svg);
				}
			})
			.catch(() => {
				if (current) {
					setSvg(null);
					setFailed(true);
				}
			});
		return () => { current = false; };
	}, [code]);

	if (failed) {
		return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e77a70' }}>diagram not valid yet</span>;
	}
	if (svg == null) {
		return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>rendering the diagram...</span>;
	}
	return <div data-mermaid-svg style={{ width: '100%', display: 'flex', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
