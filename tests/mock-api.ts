// In-page mock of the Go API, implementing the pinned slice4 contract closely
// enough to verify the admin's wire behavior: bare entities, camelCase,
// published-only unauth reads, lifecycle preservation on PUT full-replace,
// restore-copies-forward, 202/409 hoist semantics. Every request is recorded
// so specs can assert on methods, paths, headers, and bodies.
import type { Page, Route } from '@playwright/test';

export interface RecordedCall {
	method:  string;
	path:    string;
	search:  string;
	headers: Record<string, string>;
	body:    any;
	post:    string | null;
}

interface Doc { [key: string]: any; }

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// 1x1 transparent PNG for /media/images/* requests
const PIXEL = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64',
);

export const LAST_HOISTED = '2026-07-04T20:00:00Z';

const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

export class MockApi {
	calls: RecordedCall[] = [];

	// knobs specs can turn
	hoistBusy = false;
	rollbackAvailable = true;
	// the API mounts lantern routes only when its config has a lantern section
	lanternMounted = true;
	// GET /1/lantern/ polls needed before a running hoist succeeds
	pollsUntilDone = 2;
	// an API deployed before the cove serves AND echoes JSON null for the egg
	// fields, whatever the client sends
	copyPredatesCove = false;
	// ms to hold the copy PUT response; lets a spec type over an in-flight save
	copyPutLatency = 0;
	// the sightings route is new: an API deployed before it 404s (deploy skew),
	// and trafficBroken forces a 500 so specs can drive the error path
	trafficMounted = true;
	trafficBroken = false;

	projects: Doc[] = [
		{
			id: 'p1', title: 'The Great Un-monolithing', category: 'backend',
			tags: ['kubernetes', 'python', 'rabbitmq'],
			shortDesc: 'One giant app became many small, well-behaved services.',
			body: '<p>Readers never noticed.</p>\n<p>That was the point.</p>',
			moral: 'Moral: the best migrations are the boring ones.',
			postcardTo: 'everyone', postcardFrom: 'justin', postmarked: '2024 – ongoing',
			slug: 'un-monolithing', image: 'unmonolith-diagram.png',
			stamp: { shape: 'rect', motif: 'lighthouse', ink: '#f0d9a8', cents: '3¢' },
			light: { kind: 'flash', color: 'white', period: 8, letter: '', extinguished: '' },
			images: ['unmonolith-diagram.png'], firstLit: '2024',
			facts: [{ heading: 'ownership', fact: 'design to operations, solo' }, { heading: 'scale', fact: '40 services and climbing' }],
			caseStudy: '## The starting point\n\nOne app, every team, one deploy queue.',
			noteIds: ['n1'], flagship: true,
			order: 1, featured: true, status: 'published',
			publishedAt: '2026-06-01T12:00:00Z', createdAt: '2026-05-01T12:00:00Z', updatedAt: '2026-06-01T12:00:00Z',
		},
		{
			id: 'p2', title: 'Meo Wave Race', category: 'games',
			tags: ['unity', 'c#'], shortDesc: 'A cat/boat racing game.',
			body: '<p>The cat is the boat.</p>', moral: 'Moral: retire at the top.',
			postcardTo: 'anyone', postcardFrom: 'a cat that is also a boat', postmarked: '2020',
			slug: 'meo-wave-race', image: null,
			stamp: { shape: 'circle', motif: 'text', ink: '#93a0e8', text: 'DAILY SINCE 1786' },
			light: { kind: 'flash', color: 'green', period: 4, letter: '', extinguished: '' },
			images: [], firstLit: '2020',
			facts: [], caseStudy: '', noteIds: [], flagship: false,
			order: 2, featured: true, status: 'published',
			publishedAt: '2026-06-01T12:00:00Z', createdAt: '2026-05-02T12:00:00Z', updatedAt: '2026-06-01T12:00:00Z',
		},
		{
			id: 'p3', title: 'The home lab', category: 'tinkering',
			tags: ['plex', 'linux'], shortDesc: 'A small fleet of machines that mostly behave.',
			body: '', moral: 'Moral: some hobbies are load-bearing.',
			postcardTo: 'the family', postcardFrom: 'the server closet', postmarked: '2021 – forever',
			slug: 'home-lab', image: 'homelab-rack.jpg',
			light: { kind: 'fixed', color: 'red', period: 0, letter: '', extinguished: '' },
			images: ['homelab-rack.jpg'], firstLit: '2021',
			facts: [], caseStudy: '', noteIds: [], flagship: false,
			order: 3, featured: false, status: 'draft',
			publishedAt: '', createdAt: '2026-05-03T12:00:00Z', updatedAt: '2026-06-01T12:00:00Z',
		},
		{
			id: 'p4', title: 'This website', category: 'this website',
			tags: ['html', 'whimsy'], shortDesc: "The site you're on.",
			body: '', moral: 'Moral: the portfolio is also the hobby.',
			postcardTo: 'future justin', postcardFrom: 'present justin', postmarked: '2026 edition',
			slug: 'this-website', image: null, stamp: { shape: 'circle', motif: 'lighthouse', ink: '#f0d9a8' },
			light: { kind: 'morse', color: 'white', period: 8, letter: 'J', extinguished: '' },
			images: [], firstLit: '2026',
			facts: [], caseStudy: '', noteIds: [], flagship: false,
			order: 4, featured: true, status: 'published',
			publishedAt: '2026-06-01T12:00:00Z', createdAt: '2026-05-04T12:00:00Z', updatedAt: '2026-06-01T12:00:00Z',
		},
	];

	notes: Doc[] = [
		{
			id: 'n1', title: 'The queue is the product', teaser: 'Notes on message queues.',
			body: '<p>A decade of publishing systems.</p>\n<p>The queue was the product all along.</p>',
			date: 'feb 2026', conditions: 'clear skies', doodleId: 'd1', doodleCaption: 'a little wave', status: 'published',
			publishedAt: '2026-06-01T12:00:00Z', createdAt: '2026-05-01T12:00:00Z', updatedAt: '2026-06-01T12:00:00Z',
		},
		{
			id: 'n2', title: 'The home lab ate my weekend', teaser: 'A confession, with uptime charts.',
			body: '<h2>an heading the sanitizer let through</h2><p>kept <em>text</em> here</p>',
			date: '–', conditions: '', doodleId: null, doodleCaption: '', status: 'draft',
			publishedAt: '', createdAt: '2026-05-02T12:00:00Z', updatedAt: '2026-06-01T12:00:00Z',
		},
	];

	hobbies: Doc[] = [
		{
			id: 'h1', name: 'The home lab', dates: '2021 – present', active: true, epitaph: '', eulogy: 'One tweak from perfect, forever.',
			service: '2021 - present', char: 'F W', marker: 'stone', wear: 0, disposition: 'still on watch',
			log: 'One tweak from perfect, forever.', lastLog: '', found: '', cause: '', return: '',
			order: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
		},
		{
			id: 'h2', name: 'CachyOS tinkering', dates: 'always', active: true, epitaph: '', eulogy: 'The day job wearing a hat.',
			service: 'always', char: 'F W', marker: 'stone', wear: 0, disposition: 'still on watch',
			log: 'The day job wearing a hat.', lastLog: '', found: '', cause: '', return: '',
			order: 2, createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
		},
		{
			id: 'h3', name: 'Piano', dates: '2023 – 2024', active: false, epitaph: '† got good enough', eulogy: 'Quietly closed the lid.',
			service: '2023 - 2024', char: 'Fl W 3s', marker: 'stone', wear: 0.15, disposition: 'occasionally haunting',
			log: 'Quietly closed the lid.', lastLog: '', found: '', cause: '', return: '',
			order: 3, createdAt: '2026-01-03T00:00:00Z', updatedAt: '2026-01-03T00:00:00Z',
		},
		{
			id: 'h4', name: 'Running', dates: 'one summer', active: false, epitaph: '† it was a phase', eulogy: 'The shoes remain, as evidence.',
			service: 'one summer', char: 'Fl W 8s', marker: 'sticks', wear: 0.65, disposition: 'vanished without trace',
			log: 'The shoes remain, as evidence.', lastLog: '', found: '', cause: '', return: '',
			order: 4, createdAt: '2026-01-04T00:00:00Z', updatedAt: '2026-01-04T00:00:00Z',
		},
	];

	suggestions: Doc[] = [
		{ id: 's1', value: 'blacksmithing?', order: 1 },
		{ id: 's2', value: 'kayaking?', order: 2 },
	];

	media: Doc[] = [
		{ id: 'm1', filename: 'unmonolith-diagram.png', url: '/media/images/unmonolith-diagram.png', createdAt: '2026-05-01T12:00:00Z' },
		{ id: 'm2', filename: 'homelab-rack.jpg', url: '/media/images/homelab-rack.jpg', createdAt: '2026-05-02T12:00:00Z' },
		{ id: 'm3', filename: 'meo-wave-title.png', url: '/media/images/meo-wave-title.png', createdAt: '2026-05-03T12:00:00Z' },
		{ id: 'm4', filename: 'meo-wave-track1.png', url: '/media/images/meo-wave-track1.png', createdAt: '2026-05-03T12:01:00Z' },
		{ id: 'm5', filename: 'meo-wave-track2.png', url: '/media/images/meo-wave-track2.png', createdAt: '2026-05-03T12:02:00Z' },
		{ id: 'm6', filename: 'meo-wave-track3.png', url: '/media/images/meo-wave-track3.png', createdAt: '2026-05-03T12:03:00Z' },
		{ id: 'm7', filename: 'meo-wave-track4.png', url: '/media/images/meo-wave-track4.png', createdAt: '2026-05-03T12:04:00Z' },
	];

	copy: Doc = {
		id: 'c1', quipHello: 'The boats run on schedule. Ish.',
		quipProjects: 'Every project was, at some point, a terrible idea that worked.',
		quipHobbies: 'Flowers welcome. Watering optional.',
		quipNotes: 'Written by a human, edited by deadline.',
		quip404: 'You are the first person to find this exact wrong URL. Probably.',
		heroKicker: 'HIYA', heroHeadline: 'I help keep the lights on behind the news.',
		heroBody: 'Backend engineering at the Post-Gazette.', dict: '1. the Argo, but for one.',
		eggs: { bottle: true, cat: true, lights: true },
		catPages: { hello: true, projects: true, hobbies: true, notes: true, p404: true },
		catSpots: {
			'hello.header': true, 'hello.hero': true, 'hello.postcard': true, 'hello.manifest': true,
			'hello.graveyard': true, 'hello.contact': true,
			'projects.header': true, 'projects.filterTag': true, 'projects.card': true, 'projects.overlay': true,
			'hobbies.header': true, 'hobbies.entry': true, 'hobbies.nextChip': true,
			'notes.header': true, 'notes.row': true, 'notes.overlay': true,
			'p404.wreck': true,
		},
		bottleProverbs: [
			'A migration nobody notices is a migration done right.',
			'Ship the boring version. Boring floats.',
		],
		lighthouses: [
			{ name: 'Fastnet Rock', pos: '51°23′N 9°36′W', line: 'Ireland’s teardrop, the last light the emigrants saw.' },
			{ name: 'Bell Rock', pos: '56°26′N 2°23′W', line: 'built on a rock that vanishes twice a day.' },
		],
		wallGhost: null,
		updatedAt: '2026-06-01T12:00:00Z',
	};

	// The two seeded v1 cats, shape-for-shape the site's HarborCat.tsx (perched
	// then lying, render order preserved), plus one perched draft so the shelf
	// has something renameable, deletable, and publishable. Stroke-only shapes
	// carry explicit fill:"none"; role/origin follow the site's animation
	// transform-origins.
	figureheads: Doc[] = [
		{
			id: 'fh1', pose: 'perched', label: 'v1', viewBox: '0 0 64 74',
			published: true, seed: true,
			createdAt: '2026-07-01T12:00:00Z', updatedAt: '2026-07-01T12:00:00Z',
			shapes: [
				{ id: 'tail', type: 'path', d: 'M45 55 C57 52 61 62 56 70 C54.5 72.5 51 72.5 50 70 C52.5 64.5 50 60 43 60 Z', fill: '#232a4d', stroke: '#93a0e8', strokeWidth: 1.4, linejoin: 'round', role: 'tail', origin: [45, 56] },
				{ id: 'paw-left', type: 'ellipse', cx: 26, cy: 52.5, rx: 4.4, ry: 3.2, fill: '#232a4d', stroke: '#93a0e8', strokeWidth: 1.3 },
				{ id: 'paw-right', type: 'ellipse', cx: 37.5, cy: 52.5, rx: 4.4, ry: 3.2, fill: '#232a4d', stroke: '#93a0e8', strokeWidth: 1.3 },
				{ id: 'body', type: 'path', d: 'M12.95 51.8 C9.25 40.7 13.9 29.6 22.2 25.9 L21.3 15.7 L27.4 21.8 L33.7 21.8 L39.8 15.7 L38.85 25.9 C47.2 29.6 51.8 40.7 48.1 51.8 Z', fill: '#232a4d', stroke: '#93a0e8', strokeWidth: 1.6, linejoin: 'round', role: 'body' },
				{ id: 'ear-left', type: 'path', d: 'M22.7 18.2 L25.6 21.6 L22.2 21.6 Z', fill: '#f0d9a8', opacity: .5 },
				{ id: 'ear-right', type: 'path', d: 'M38.3 18.2 L38.8 21.6 L35.4 21.6 Z', fill: '#f0d9a8', opacity: .5 },
				{ id: 'eye-left', type: 'ellipse', cx: 25.9, cy: 30.8, rx: 1.9, ry: 1.9, fill: '#f0d9a8', role: 'eyes', origin: [30, 31] },
				{ id: 'eye-right', type: 'ellipse', cx: 35.2, cy: 30.8, rx: 1.9, ry: 1.9, fill: '#f0d9a8', role: 'eyes', origin: [30, 31] },
				{ id: 'nose', type: 'path', d: 'M29.4 35 L32.2 35 L30.8 36.6 Z', fill: '#f0d9a8' },
				{ id: 'mouth', type: 'path', d: 'M30.8 36.6 v1.4 M30.8 38 q-2 1.4 -3.6 .4 M30.8 38 q2 1.4 3.6 .4', fill: 'none', stroke: '#5f6ec4', strokeWidth: 1, linecap: 'round' },
				{ id: 'whiskers', type: 'path', d: 'M22 33 l-7 -1.4 M22 35.4 l-7 1 M39.5 33 l7 -1.4 M39.5 35.4 l7 1', fill: 'none', stroke: '#5f6ec4', strokeWidth: 0.9, linecap: 'round', opacity: .7 },
			],
		},
		{
			id: 'fh2', pose: 'lying', label: 'v1', viewBox: '0 0 100 48',
			published: true, seed: true,
			createdAt: '2026-07-01T12:00:00Z', updatedAt: '2026-07-01T12:00:00Z',
			shapes: [
				{ id: 'tail', type: 'path', d: 'M72 38 C85 33 91 41 86 46.5 C84 49 80.2 48.4 80.8 45.2 C83 41.4 78.6 39.6 72.6 42.4 Z', fill: '#232a4d', stroke: '#93a0e8', strokeWidth: 1.4, linejoin: 'round', role: 'tail', origin: [73, 40] },
				{ id: 'paw-front-left', type: 'ellipse', cx: 10.5, cy: 42.6, rx: 4.6, ry: 2.7, fill: '#232a4d', stroke: '#93a0e8', strokeWidth: 1.3 },
				{ id: 'paw-front-right', type: 'ellipse', cx: 18.5, cy: 42.9, rx: 4.4, ry: 2.6, fill: '#232a4d', stroke: '#93a0e8', strokeWidth: 1.3 },
				{ id: 'body', type: 'path', d: 'M13.5 44 C8.5 39 9 30 13 25 L12.8 22 L12.4 10 L18.6 17 L24.5 17 L30 10 L30.5 22 C35.5 25 38.5 27 44.5 28.5 C56 25.5 69 26.5 77.5 32.5 C83.5 36.8 83 42 76 44 Z', fill: '#232a4d', stroke: '#93a0e8', strokeWidth: 1.6, linejoin: 'round', role: 'body' },
				{ id: 'paw-hind', type: 'ellipse', cx: 68, cy: 43.2, rx: 5, ry: 2.4, fill: '#232a4d', stroke: '#93a0e8', strokeWidth: 1.2 },
				{ id: 'ear-left', type: 'path', d: 'M13.7 16 L13.5 11.5 L17 15 Z', fill: '#f0d9a8', opacity: .5 },
				{ id: 'ear-right', type: 'path', d: 'M29 16 L29.4 11.5 L26 15 Z', fill: '#f0d9a8', opacity: .5 },
				{ id: 'eye-left', type: 'ellipse', cx: 17.8, cy: 26.8, rx: 1.9, ry: 1.9, fill: '#f0d9a8', role: 'eyes', origin: [22, 27] },
				{ id: 'eye-right', type: 'ellipse', cx: 26, cy: 26.8, rx: 1.9, ry: 1.9, fill: '#f0d9a8', role: 'eyes', origin: [22, 27] },
				{ id: 'nose', type: 'path', d: 'M20.6 30.4 L23.4 30.4 L22 32 Z', fill: '#f0d9a8' },
				{ id: 'mouth', type: 'path', d: 'M22 32 v1.3 M22 33.3 q-2 1.4 -3.6 .4 M22 33.3 q2 1.4 3.6 .4', fill: 'none', stroke: '#5f6ec4', strokeWidth: 1, linecap: 'round' },
				{ id: 'whiskers', type: 'path', d: 'M12.6 29 l-7 -1.3 M12.6 31.2 l-7 .9 M30.5 29 l7 -1.3 M30.5 31.2 l7 .9', fill: 'none', stroke: '#5f6ec4', strokeWidth: 0.9, linecap: 'round', opacity: .7 },
				{ id: 'chest-stripe', type: 'path', d: 'M15.8 36 q3 1.6 6.4 .6', fill: 'none', stroke: '#5f6ec4', strokeWidth: 0.9, linecap: 'round', opacity: .45 },
			],
		},
		{
			id: 'fh3', pose: 'perched', label: 'second fitting', viewBox: '0 0 64 74',
			published: false, seed: false,
			createdAt: '2026-07-05T12:00:00Z', updatedAt: '2026-07-05T15:00:00Z',
			shapes: [
				{ id: 'arc', type: 'path', d: 'M10 50 C20 20 44 20 54 50', fill: 'none', stroke: '#f0d9a8', strokeWidth: 2, linecap: 'round' },
				{ id: 'moon', type: 'ellipse', cx: 32, cy: 30, rx: 6, ry: 6, fill: '#93a0e8' },
			],
		},
	];

	doodles: Doc[] = [
		{
			id: 'd1', name: 'a little wave', viewBox: '0 0 100 100',
			createdAt: '2026-07-06T12:00:00Z', updatedAt: '2026-07-06T12:00:00Z',
			shapes: [
				{ id: 'doodle-1', type: 'path', d: 'M10 60 Q30 40 50 60 T90 60', fill: 'none', stroke: '#232a4d', strokeWidth: 1.8, linecap: 'round' },
			],
		},
	];

	// The seven builtin (v1 seed) carvings, one per spot, svg verbatim from the
	// design mock's svgCatalog; each starts bolted to its own spot, the
	// current look being the bolted default.
	carvings: Doc[] = [
		{
			id: 'cv-lighthouse', name: 'The lighthouse', builtin: true, boltedTo: ['lighthouse-logo'],
			svg: '<svg width="24" height="28" viewBox="0 0 26 30" fill="none"><path d="M13 2 L17 9 L9 9 Z" fill="#f0d9a8"></path><rect x="10" y="9" width="6" height="14" fill="none" stroke="#93a0e8" stroke-width="1.4"></rect><path d="M10 13 h6 M10 17 h6" stroke="#93a0e8" stroke-width="1.4"></path><path d="M6 27 q7 -4 14 0" stroke="#5f6ec4" stroke-width="1.4" fill="none"></path></svg>',
			createdAt: '2026-07-01T12:00:00Z', updatedAt: '2026-07-01T12:00:00Z',
		},
		{
			id: 'cv-boat', name: 'The little boat', builtin: true, boltedTo: ['boat'],
			svg: '<svg width="30" height="24" viewBox="0 0 30 24" fill="none"><path d="M4 15 L26 15 L21 22 L9 22 Z" fill="#93a0e8"></path><path d="M15 15 V3" stroke="#5f6ec4" stroke-width="1.5"></path><path d="M15 3 L24 13 L15 13 Z" fill="#f0d9a8"></path></svg>',
			createdAt: '2026-07-01T12:00:00Z', updatedAt: '2026-07-01T12:00:00Z',
		},
		{
			id: 'cv-bottle', name: 'Message in a bottle', builtin: true, boltedTo: ['bottle'],
			svg: '<svg width="32" height="20" viewBox="0 0 40 24" fill="none"><rect x="6" y="7" width="28" height="11" rx="5.5" fill="rgba(147,160,232,.22)" stroke="#93a0e8" stroke-width="1.3"></rect><rect x="33" y="9.5" width="5" height="6" rx="1.2" fill="#f0d9a8"></rect><path d="M12 10 h14 M12 12.5 h11 M12 15 h13" stroke="#f0d9a8" stroke-width="1" stroke-linecap="round" opacity=".85"></path></svg>',
			createdAt: '2026-07-01T12:00:00Z', updatedAt: '2026-07-01T12:00:00Z',
		},
		{
			id: 'cv-tower', name: 'Tower on the horizon', builtin: true, boltedTo: ['tower-stub'],
			svg: '<svg width="26" height="34" viewBox="0 0 26 34" fill="none"><path d="M13 3 L17 10 L9 10 Z" fill="rgba(150,160,220,.4)"></path><rect x="10" y="10" width="6" height="15" fill="none" stroke="rgba(150,160,220,.45)" stroke-width="1.3"></rect><path d="M10 14 h6 M10 19 h6" stroke="rgba(150,160,220,.34)" stroke-width="1.1"></path><path d="M5 30 q8 -4 16 0" stroke="rgba(150,160,220,.36)" stroke-width="1.3" fill="none"></path></svg>',
			createdAt: '2026-07-01T12:00:00Z', updatedAt: '2026-07-01T12:00:00Z',
		},
		{
			id: 'cv-paw', name: 'Paw print', builtin: true, boltedTo: ['paw'],
			svg: '<svg width="13" height="12" viewBox="0 0 15 14" fill="#93a0e8"><ellipse cx="7.5" cy="9.5" rx="3.4" ry="2.9"></ellipse><ellipse cx="2.6" cy="5.4" rx="1.5" ry="1.9"></ellipse><ellipse cx="6.2" cy="3.4" rx="1.5" ry="1.9"></ellipse><ellipse cx="9.8" cy="3.6" rx="1.5" ry="1.9"></ellipse><ellipse cx="12.6" cy="6" rx="1.4" ry="1.8"></ellipse></svg>',
			createdAt: '2026-07-01T12:00:00Z', updatedAt: '2026-07-01T12:00:00Z',
		},
		{
			id: 'cv-wave', name: 'The wave line', builtin: true, boltedTo: ['wave-line'],
			svg: '<svg xmlns="http://www.w3.org/2000/svg" width="53" height="18"><path d="M0 9 Q 13.25 0, 26.5 9 T 53 9" stroke="rgba(147,160,232,0.5)" stroke-width="1.5" fill="none"/></svg>',
			createdAt: '2026-07-01T12:00:00Z', updatedAt: '2026-07-01T12:00:00Z',
		},
		{
			id: 'cv-wake', name: 'The boat wake', builtin: true, boltedTo: ['boat-wake'],
			svg: '<svg xmlns="http://www.w3.org/2000/svg" width="53" height="18"><path d="M0 9 Q 13.25 0, 26.5 9 T 53 9" stroke="rgba(240,217,168,0.5)" stroke-width="1.5" fill="none"/></svg>',
			createdAt: '2026-07-01T12:00:00Z', updatedAt: '2026-07-01T12:00:00Z',
		},
	];

	activity: Doc[] = [
		{ id: 'a1', timestamp: '2026-07-05T09:30:00Z', message: 'note "The queue is the product" published', entityType: 'note', entityId: 'n1' },
		{ id: 'a2', timestamp: '2026-07-05T09:00:00Z', message: 'postcard "This website" edited 11 times. it counts.', entityType: 'project', entityId: 'p4' },
		{ id: 'a3', timestamp: '2026-07-05T08:50:00Z', message: 'postcard "Meo Wave Race" edited', entityType: 'project', entityId: 'p2' },
		{ id: 'a4', timestamp: '2026-07-05T08:40:00Z', message: 'postcard "The home lab" edited', entityType: 'project', entityId: 'p3' },
		{ id: 'a5', timestamp: '2026-07-05T08:30:00Z', message: 'hobby "Piano" edited', entityType: 'hobby', entityId: 'h3' },
		{ id: 'a6', timestamp: '2026-07-05T08:20:00Z', message: 'hobby "Running" edited', entityType: 'hobby', entityId: 'h4' },
		{ id: 'a7', timestamp: '2026-07-05T08:10:00Z', message: 'note "The home lab ate my weekend" edited', entityType: 'note', entityId: 'n2' },
		{ id: 'a8', timestamp: '2026-07-05T08:00:00Z', message: 'signal flags re-flown', entityType: 'sitecopy', entityId: 'c1' },
		{ id: 'a9', timestamp: '2026-07-04T21:00:00Z', message: 'lantern hoisted, site rebuilt in 41s', entityType: 'lantern', entityId: 'l1' },
		{ id: 'a10', timestamp: '2026-07-03T12:00:00Z', message: 'hobby "Running" moved to the graveyard (again)', entityType: 'hobby', entityId: 'h4' },
	];

	revisions: Record<string, Doc[]> = {
		p1: [
			{
				id: 'r2', entityType: 'project', entityId: 'p1', isCurrent: true,
				snapshot: JSON.stringify(this.projects[0]),
				summary: '“The Great Un-monolithing”, current printing', createdAt: '2026-06-01T12:00:00Z',
			},
			{
				id: 'r1', entityType: 'project', entityId: 'p1', isCurrent: false,
				snapshot: JSON.stringify({ ...this.projects[0], title: 'The Great Un-monolithing (early draft)', status: 'draft', publishedAt: '' }),
				summary: '“The Great Un-monolithing (early draft)”, before the polish', createdAt: '2026-05-15T12:00:00Z',
			},
		],
		n1: [
			{
				id: 'r3', entityType: 'note', entityId: 'n1', isCurrent: false,
				snapshot: JSON.stringify({ ...this.notes[0], title: 'The queue is the product (v1)', status: 'draft', publishedAt: '' }),
				summary: '“The queue is the product (v1)”', createdAt: '2026-05-10T12:00:00Z',
			},
		],
	};

	user: Doc = {
		id: 'u1', userName: 'meo', password: '', role: 'admin',
		name: 'Justin', pronouns: 'he/him', location: 'Pittsburgh, PA',
		title: 'Senior Software Engineer, Post-Gazette',
		bio: 'Backend engineer keeping the lights on behind the news.',
		email: 'hello@argsea.com', github: 'github.com/argsea', linkedin: 'linkedin.com/in/argsea',
		signoff: '– j',
	};

	lantern: Doc = { state: 'idle', startedAt: '', finishedAt: '', lastHoistedAt: LAST_HOISTED, output: '' };

	// A week of sightings, zero-filled oldest-to-newest. Thursday (2026-07-09)
	// is the busiest day by sails, so it leads the bars; uniques carries a comma
	// so the tile exercises locale formatting; the tops name real seeded ids the
	// admin resolves to titles.
	traffic: Doc = {
		uniques: 1204,
		sails: 3218,
		days: [
			{ day: '2026-07-06', sails: 420, uniques: 300 },
			{ day: '2026-07-07', sails: 512, uniques: 360 },
			{ day: '2026-07-08', sails: 388, uniques: 270 },
			{ day: '2026-07-09', sails: 640, uniques: 430 },
			{ day: '2026-07-10', sails: 470, uniques: 320 },
			{ day: '2026-07-11', sails: 300, uniques: 210 },
			{ day: '2026-07-12', sails: 488, uniques: 330 },
		],
		busiest: 'thursday',
		topPostcard: { subject: 'p2', flips: 214 },
		topNote: { subject: 'n1', reads: 178 },
		ports: [
			{ port: 'search', share: 44 },
			{ port: 'direct', share: 31 },
			{ port: 'fediverse', share: 25 },
		],
	};

	private nextId = 100;
	private lanternPolls = 0;

	async install(page: Page): Promise<void> {
		await page.route((url) => url.port === '8181', (route) => this.handle(route));
	}

	find(method: string, path: RegExp): RecordedCall[] {
		return this.calls.filter((c) => c.method === method && path.test(c.path));
	}

	private handle(route: Route): Promise<void> {
		const request = route.request();
		const method = request.method();
		const url = new URL(request.url());
		const path = url.pathname;

		if (method === 'OPTIONS') {
			return route.fulfill({ status: 204, headers: CORS });
		}

		// the darkroom loads print files from the media web path
		if (path.startsWith('/media/')) {
			return route.fulfill({ status: 200, contentType: 'image/png', headers: CORS, body: PIXEL });
		}

		const post = request.postData();
		let body: any = null;
		if (post && (request.headers()['content-type'] ?? '').includes('json')) {
			try { body = JSON.parse(post); } catch { body = null; }
		}
		this.calls.push({ method, path, search: url.search, headers: request.headers(), body, post });

		const authed = Boolean(request.headers()['authorization']);
		const json = (status: number, payload: unknown) =>
			route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(payload) });

		let match: RegExpExecArray | null;

		// ---- auth (trailing slash required) ----
		if (path === '/1/auth/login/' && method === 'POST') {
			if (body?.userName === 'meo' && body?.password === 'lantern') {
				return json(200, { status: 'ok', code: 200, userName: 'meo', userID: 'u1', token: 'test-token' });
			}
			return json(400, { status: 'error', code: 400, message: 'invalid credentials' });
		}
		if (path === '/1/auth/logout/' && method === 'GET') {
			return json(200, { status: 'ok', code: 200, message: 'User logged out' });
		}
		if (path === '/1/auth/validate/' && method === 'GET') {
			return authed
				? json(200, { status: 'ok', code: 200, message: 'User is authorized' })
				: json(401, { status: 'error', code: 401, message: 'Unauthorized' });
		}

		// ---- projects ----
		if (/^\/1\/project\/?$/.test(path)) {
			if (method === 'GET') {
				const visible = this.projects.filter((p) => authed || p.status === 'published');
				return json(200, [...visible].sort((a, b) => a.order - b.order));
			}
			if (method === 'POST') {
				const doc = {
					...body, id: `p${this.nextId++}`, slug: body.slug ?? '',
					order: Math.max(0, ...this.projects.map((p) => p.order)) + 1, featured: false,
					status: body.status ?? 'draft', publishedAt: '', createdAt: now(), updatedAt: now(),
				};
				this.projects.push(doc);
				return json(200, doc);
			}
		}
		// non-destructive bulk position set for the wall; must be checked before
		// the generic item route below, or "arrangement" reads as a project id
		if (/^\/1\/project\/arrangement\/?$/.test(path) && method === 'PUT') {
			const placements: { id: string; x: number; y: number; rotation: number }[] = body?.placements ?? [];
			placements.forEach((placement) => {
				const doc = this.projects.find((p) => p.id === placement.id);
				if (doc) {
					doc.wallPos = { x: placement.x, y: placement.y, rotation: placement.rotation };
					doc.updatedAt = now();
				}
			});
			const visible = this.projects.filter((p) => authed || p.status === 'published');
			return json(200, [...visible].sort((a, b) => a.order - b.order));
		}
		if ((match = /^\/1\/project\/([^/]+)$/.exec(path))) {
			return this.item(this.projects, match[1], method, body, json);
		}
		if ((match = /^\/1\/project\/([^/]+)\/(publish|unpublish|reorder|feature|unfeature)$/.exec(path)) && method === 'POST') {
			const doc = this.projects.find((p) => p.id === match![1]);
			if (!doc) {
				return json(404, { status: 'error', code: 404, message: 'not found' });
			}
			const verb = match[2];
			if (verb === 'publish') { doc.status = 'published'; doc.publishedAt = now(); }
			if (verb === 'unpublish') { doc.status = 'draft'; doc.publishedAt = ''; }
			if (verb === 'reorder') { doc.order = body.order; }
			if (verb === 'feature') { doc.featured = true; }
			if (verb === 'unfeature') { doc.featured = false; }
			return json(200, doc);
		}
		if ((match = /^\/1\/(project|note)\/([^/]+)\/revisions$/.exec(path)) && method === 'GET') {
			return json(200, this.revisions[match[2]] ?? []);
		}
		if ((match = /^\/1\/(project|note)\/([^/]+)\/revisions\/([^/]+)\/restore$/.exec(path)) && method === 'POST') {
			const list = match[1] === 'project' ? this.projects : this.notes;
			const revision = (this.revisions[match[2]] ?? []).find((r) => r.id === match![3]);
			const at = list.findIndex((d) => d.id === match![2]);
			if (!revision || at === -1) {
				return json(404, { status: 'error', code: 404, message: 'not found' });
			}
			// copy-forward: the snapshot becomes the document, lifecycle included
			list[at] = { ...JSON.parse(revision.snapshot), id: match[2], updatedAt: now() };
			return json(200, list[at]);
		}

		// ---- notes ----
		if (/^\/1\/note\/?$/.test(path)) {
			if (method === 'GET') {
				return json(200, this.notes.filter((n) => authed || n.status === 'published'));
			}
			if (method === 'POST') {
				const doc = { ...body, id: `n${this.nextId++}`, status: body.status ?? 'draft', publishedAt: '', createdAt: now(), updatedAt: now() };
				this.notes.push(doc);
				return json(200, doc);
			}
		}
		if ((match = /^\/1\/note\/([^/]+)$/.exec(path))) {
			return this.item(this.notes, match[1], method, body, json);
		}
		if ((match = /^\/1\/note\/([^/]+)\/(publish|unpublish)$/.exec(path)) && method === 'POST') {
			const doc = this.notes.find((n) => n.id === match![1]);
			if (!doc) {
				return json(404, { status: 'error', code: 404, message: 'not found' });
			}
			if (match[2] === 'publish') { doc.status = 'published'; doc.publishedAt = now(); }
			else { doc.status = 'draft'; doc.publishedAt = ''; }
			return json(200, doc);
		}

		// ---- hobbies ----
		if (/^\/1\/hobby\/?$/.test(path)) {
			if (method === 'GET') {
				return json(200, this.hobbies);
			}
			if (method === 'POST') {
				const doc = { ...body, id: `h${this.nextId++}`, order: Math.max(0, ...this.hobbies.map((h) => h.order)) + 1, createdAt: now(), updatedAt: now() };
				this.hobbies.push(doc);
				return json(200, doc);
			}
		}
		if ((match = /^\/1\/hobby\/([^/]+)$/.exec(path))) {
			return this.item(this.hobbies, match[1], method, body, json, false);
		}

		// ---- suggestions ----
		if (/^\/1\/suggestion\/?$/.test(path)) {
			if (method === 'GET') {
				return json(200, this.suggestions);
			}
			if (method === 'POST') {
				const doc = { id: `s${this.nextId++}`, value: body.value, order: Math.max(0, ...this.suggestions.map((s) => s.order)) + 1 };
				this.suggestions.push(doc);
				return json(200, doc);
			}
		}
		if ((match = /^\/1\/suggestion\/([^/]+)$/.exec(path)) && method === 'DELETE') {
			this.suggestions = this.suggestions.filter((s) => s.id !== match![1]);
			return json(200, { status: 'ok', code: 200 });
		}

		// ---- site copy ----
		if (/^\/1\/copy\/?$/.test(path)) {
			const serve = (doc: Doc) => this.copyPredatesCove
				? { ...doc, eggs: null, catPages: null, catSpots: null, bottleProverbs: null, lighthouses: null }
				: doc;
			if (method === 'GET') {
				return json(200, serve(this.copy));
			}
			if (method === 'PUT') {
				this.copy = { ...body, id: this.copy.id, updatedAt: now() };
				// echo this write's snapshot, held if a spec asked for latency,
				// a later PUT reassigns this.copy, so the captured echo stays put
				const echo = serve(this.copy);
				return this.copyPutLatency
					? new Promise<void>((resolve) => setTimeout(() => resolve(json(200, echo)), this.copyPutLatency))
					: json(200, echo);
			}
		}

		// ---- figurehead designs ----
		if (path === '/1/figurehead/published' && method === 'GET') {
			// public: the current cat per pose, perched then lying, [] never null
			const rank: Record<string, number> = { perched: 0, lying: 1 };
			return json(200, this.figureheads.filter((d) => d.published).sort((a, b) => rank[a.pose] - rank[b.pose]));
		}
		if (/^\/1\/figurehead\/designs\/?$/.test(path)) {
			if (!authed) {
				return json(401, { status: 'error', code: 401, message: 'Unauthorized' });
			}
			if (method === 'GET') {
				return json(200, this.figureheads);
			}
			if (method === 'POST') {
				// always lands as a draft; published/seed in the body are ignored
				if (body?.pose !== 'perched' && body?.pose !== 'lying') {
					return json(400, { status: 'error', code: 400, message: 'bad pose' });
				}
				if ((body.shapes ?? []).some((s: Doc) => !['path', 'ellipse', 'rect', 'line'].includes(s.type))) {
					return json(400, { status: 'error', code: 400, message: 'bad shape type' });
				}
				const doc = {
					id: `fh${this.nextId++}`, pose: body.pose, label: body.label ?? '', viewBox: body.viewBox ?? '',
					shapes: body.shapes ?? [], published: false, seed: false, createdAt: now(), updatedAt: now(),
				};
				this.figureheads.push(doc);
				return json(200, doc);
			}
		}
		if ((match = /^\/1\/figurehead\/designs\/([^/]+)$/.exec(path))) {
			if (!authed) {
				return json(401, { status: 'error', code: 401, message: 'Unauthorized' });
			}
			const doc = this.figureheads.find((d) => d.id === match![1]);
			if (!doc) {
				// 400 for not-found is the house idiom on this route family
				return json(400, { status: 'error', code: 400, message: 'no such design' });
			}
			if (method === 'PUT') {
				if (doc.seed) {
					return json(409, { status: 'error', code: 409, message: 'a seed is carved, copy it instead' });
				}
				// label/viewBox/shapes only; pose/published/seed/createdAt preserved
				doc.label = body.label;
				doc.viewBox = body.viewBox;
				doc.shapes = body.shapes ?? [];
				doc.updatedAt = now();
				return json(200, doc);
			}
			if (method === 'DELETE') {
				if (doc.seed || doc.published) {
					return json(409, { status: 'error', code: 409, message: doc.seed ? 'a seed is carved, it stays' : 'lower it before scrapping it' });
				}
				this.figureheads = this.figureheads.filter((d) => d.id !== doc.id);
				return json(200, { status: 'ok', code: 200 });
			}
		}
		if ((match = /^\/1\/figurehead\/designs\/([^/]+)\/publish$/.exec(path)) && method === 'POST') {
			if (!authed) {
				return json(401, { status: 'error', code: 401, message: 'Unauthorized' });
			}
			const doc = this.figureheads.find((d) => d.id === match![1]);
			if (!doc) {
				return json(400, { status: 'error', code: 400, message: 'no such design' });
			}
			// atomic within the pose: hoist first, then lower the previous
			doc.published = true;
			doc.updatedAt = now();
			for (const other of this.figureheads) {
				if (other.pose === doc.pose && other.id !== doc.id) {
					other.published = false;
				}
			}
			return json(200, doc);
		}

		// ---- doodles (Marginalia, public read, admin-gated write) ----
		if (/^\/1\/doodle\/?$/.test(path)) {
			if (method === 'GET') {
				return json(200, this.doodles);
			}
			if (method === 'POST') {
				if (!authed) {
					return json(401, { status: 'error', code: 401, message: 'Unauthorized' });
				}
				const doc = {
					id: `d${this.nextId++}`, name: body.name ?? '', viewBox: body.viewBox ?? '',
					shapes: body.shapes ?? [], createdAt: now(), updatedAt: now(),
				};
				this.doodles.push(doc);
				return json(200, doc);
			}
		}
		if ((match = /^\/1\/doodle\/([^/]+)$/.exec(path))) {
			if (method === 'GET') {
				const doc = this.doodles.find((d) => d.id === match![1]);
				return doc ? json(200, doc) : json(404, { status: 'error', code: 404, message: 'not found' });
			}
			if (!authed) {
				return json(401, { status: 'error', code: 401, message: 'Unauthorized' });
			}
			const doc = this.doodles.find((d) => d.id === match![1]);
			if (!doc) {
				return json(404, { status: 'error', code: 404, message: 'not found' });
			}
			if (method === 'PUT') {
				doc.name = body.name;
				doc.viewBox = body.viewBox;
				doc.shapes = body.shapes ?? [];
				doc.updatedAt = now();
				return json(200, doc);
			}
			if (method === 'DELETE') {
				this.doodles = this.doodles.filter((d) => d.id !== doc.id);
				return json(200, { status: 'ok', code: 200 });
			}
		}

		// ---- carvings (public GET like projects, admin-gated writes) ----
		if (/^\/1\/carving\/carvings\/?$/.test(path)) {
			if (method === 'GET') {
				return json(200, this.carvings);
			}
			if (method === 'POST') {
				if (!authed) {
					return json(401, { status: 'error', code: 401, message: 'Unauthorized' });
				}
				const doc = {
					id: `cv${this.nextId++}`, name: body.name ?? '', svg: body.svg ?? '',
					builtin: false, boltedTo: [], createdAt: now(), updatedAt: now(),
				};
				this.carvings.push(doc);
				return json(200, doc);
			}
		}
		if ((match = /^\/1\/carving\/carvings\/([^/]+)\/bolt$/.exec(path)) && method === 'POST') {
			if (!authed) {
				return json(401, { status: 'error', code: 401, message: 'Unauthorized' });
			}
			const doc = this.carvings.find((c) => c.id === match![1]);
			if (!doc) {
				return json(400, { status: 'error', code: 400, message: 'no such carving' });
			}
			const spot = body?.spot;
			if (!spot) {
				return json(400, { status: 'error', code: 400, message: 'no spot named' });
			}
			if (!String(doc.svg ?? '').trim()) {
				return json(400, { status: 'error', code: 400, message: 'an empty block cannot bolt' });
			}
			// auto-swap: the spot leaves whichever carving held it, in this write
			for (const other of this.carvings) {
				if (other.id !== doc.id) {
					other.boltedTo = other.boltedTo.filter((s: string) => s !== spot);
				}
			}
			if (!doc.boltedTo.includes(spot)) {
				doc.boltedTo = [...doc.boltedTo, spot];
			}
			doc.updatedAt = now();
			return json(200, doc);
		}
		if ((match = /^\/1\/carving\/carvings\/([^/]+)$/.exec(path))) {
			if (method === 'GET') {
				const doc = this.carvings.find((c) => c.id === match![1]);
				return doc ? json(200, doc) : json(404, { status: 'error', code: 404, message: 'not found' });
			}
			if (!authed) {
				return json(401, { status: 'error', code: 401, message: 'Unauthorized' });
			}
			const doc = this.carvings.find((c) => c.id === match![1]);
			if (!doc) {
				return json(404, { status: 'error', code: 404, message: 'not found' });
			}
			if (method === 'PUT') {
				// name/svg only; boltedTo is preserved untouched, bolting is its own route
				if (doc.builtin && (body.name !== doc.name || body.svg !== doc.svg)) {
					return json(409, { status: 'error', code: 409, message: 'a builtin carving keeps its name and svg' });
				}
				// a bolted carving is live markup on the site; it cannot go blank
				if (doc.boltedTo.length && !String(body.svg ?? '').trim()) {
					return json(409, { status: 'error', code: 409, message: 'a bolted carving cannot go blank, unbolt the spot first' });
				}
				doc.name = doc.builtin ? doc.name : body.name;
				doc.svg = doc.builtin ? doc.svg : body.svg;
				doc.updatedAt = now();
				return json(200, doc);
			}
			if (method === 'DELETE') {
				if (doc.boltedTo.length) {
					return json(409, { status: 'error', code: 409, message: 'unbolt it before scrapping it' });
				}
				this.carvings = this.carvings.filter((c) => c.id !== doc.id);
				return json(200, { status: 'ok', code: 200 });
			}
		}

		// ---- activity ----
		if (/^\/1\/activity\/?$/.test(path) && method === 'GET') {
			const limit = Number(url.searchParams.get('limit')) || 6;
			return json(200, this.activity.slice(0, limit));
		}

		// ---- sightings (the watch room's first-party analytics) ----
		if (/^\/1\/sighting\/traffic\/?$/.test(path) && method === 'GET') {
			if (!this.trafficMounted) {
				return json(404, { message: '404 page not found' });
			}
			if (this.trafficBroken) {
				return json(500, { status: 'error', code: 500, message: 'the glass fogged over' });
			}
			return json(200, this.traffic);
		}

		// ---- media ----
		if (/^\/1\/media\/?$/.test(path)) {
			if (method === 'GET') {
				return json(200, this.media);
			}
			if (method === 'POST') {
				const filename = /filename="([^"]+)"/.exec(post ?? '')?.[1] ?? `upload-${this.nextId}.png`;
				const doc = { id: `m${this.nextId++}`, filename, url: `/media/images/${filename}`, createdAt: now() };
				this.media.unshift(doc);
				return json(200, doc);
			}
		}
		if ((match = /^\/1\/media\/([^/]+)$/.exec(path)) && method === 'DELETE') {
			this.media = this.media.filter((m) => m.id !== match![1]);
			return json(200, { status: 'ok', code: 200 });
		}

		// ---- user / keeper ----
		if ((match = /^\/1\/user\/([^/]+)\/profile$/.exec(path)) && method === 'GET') {
			const { name, pronouns, location, title, bio, email, github, linkedin, signoff } = this.user;
			return json(200, { name, pronouns, location, title, bio, email, github, linkedin, signoff });
		}
		if ((match = /^\/1\/user\/([^/]+)$/.exec(path))) {
			if (method === 'GET') {
				return json(200, { ...this.user, password: '' });
			}
			if (method === 'PUT') {
				// role-strip stays server-side; the assertion that the admin
				// never SENDS role lives in the spec, on the recorded call
				const { role: _role, ...rest } = body;
				this.user = { ...this.user, ...rest };
				return json(200, { status: 'ok', code: 200 });
			}
		}

		// ---- the lantern ----
		if (/^\/1\/lantern/.test(path) && !this.lanternMounted) {
			return json(404, { message: '404 page not found' });
		}
		if (/^\/1\/lantern\/?$/.test(path) && method === 'GET') {
			if (this.lantern.state === 'building' && ++this.lanternPolls >= this.pollsUntilDone) {
				this.lantern = { state: 'succeeded', startedAt: this.lantern.startedAt, finishedAt: now(), lastHoistedAt: now(), output: 'done' };
			}
			return json(200, this.lantern);
		}
		if (/^\/1\/lantern\/hoist\/?$/.test(path) && method === 'POST') {
			if (this.hoistBusy || this.lantern.state === 'building') {
				return json(409, this.lantern.state === 'building' ? this.lantern : { ...this.lantern, state: 'building' });
			}
			this.lanternPolls = 0;
			this.lantern = { state: 'building', startedAt: now(), finishedAt: '', lastHoistedAt: this.lantern.lastHoistedAt, output: '' };
			return json(202, this.lantern);
		}
		if (/^\/1\/lantern\/rollback\/?$/.test(path) && method === 'POST') {
			// 409 carries the LanternStatus body in BOTH cases (integrator pin):
			// deploying = hoist in flight, not deploying = no previous build
			if (this.lantern.state === 'building' || !this.rollbackAvailable) {
				return json(409, this.lantern);
			}
			return json(200, this.lantern);
		}

		return json(404, { status: 'error', code: 404, message: `no route: ${method} ${path}` });
	}

	private item(
		list: Doc[],
		id: string,
		method: string,
		body: any,
		json: (status: number, payload: unknown) => Promise<void>,
		lifecycle = true,
	): Promise<void> {
		const at = list.findIndex((d) => d.id === id);
		if (at === -1) {
			return json(404, { status: 'error', code: 404, message: 'not found' });
		}
		if (method === 'GET') {
			return json(200, list[at]);
		}
		if (method === 'PUT') {
			const existing = list[at];
			// full-replace, but the server preserves lifecycle/rack fields
			const preserved = lifecycle
				? { status: existing.status, publishedAt: existing.publishedAt, order: existing.order, featured: existing.featured }
				: {};
			list[at] = { ...body, id, createdAt: existing.createdAt, updatedAt: now(), ...preserved };
			return json(200, list[at]);
		}
		if (method === 'DELETE') {
			list.splice(at, 1);
			return json(200, { status: 'ok', code: 200 });
		}
		return json(405, { status: 'error', code: 405, message: 'method not allowed' });
	}
}
