// The <p> adapter over the API's sanitized-HTML body storage (spike ruling
// 2026-07-05: no rich-text editor, plain textarea, paragraphs on the wire).
// Save: split on blank lines, wrap each paragraph in <p>. Load: take each
// block's text content and join with blank lines, dropping unknown tags
// gracefully. Round-trips plain text exactly.

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

/**
 * Textarea text → sanitized-HTML-shaped body: one <p> per blank-line block.
 * Single newlines inside a block become <br>, so a soft break survives the
 * round trip instead of collapsing to a space on the site.
 */
export function textToHtml(text: string): string {
	return text
		.split(/\n\s*\n/)
		.map((block) => block.trim())
		.filter(Boolean)
		.map((block) => `<p>${block.replace(/[&<>]/g, (c) => ESCAPES[c]).replace(/\n/g, '<br>')}</p>`)
		.join('\n');
}

/**
 * Body HTML → paragraphs of plain text. Each top-level element becomes one
 * paragraph via its textContent, which both decodes entities and drops any
 * non-<p> markup gracefully; <br> inside a block survives as a newline.
 */
export function htmlToParagraphs(html: string): string[] {
	const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, '\n'), 'text/html');
	const paragraphs: string[] = [];

	for (const node of Array.from(doc.body.childNodes)) {
		const text = (node.textContent ?? '').trim();
		if (text) {
			paragraphs.push(text);
		}
	}
	return paragraphs;
}

/** Body HTML → textarea text: paragraphs joined with blank lines. */
export function htmlToText(html: string): string {
	return htmlToParagraphs(html).join('\n\n');
}
