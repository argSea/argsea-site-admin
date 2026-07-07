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
	// an API deployed before the hold serves AND echoes JSON null for the egg
	// fields, whatever the client sends
	copyPredatesHold = false;
	// ms to hold the copy PUT response — lets a spec type over an in-flight save
	copyPutLatency = 0;

	projects: Doc[] = [
		{
			id: 'p1', title: 'The Great Un-monolithing', category: 'backend',
			tags: ['kubernetes', 'python', 'rabbitmq'],
			shortDesc: 'One giant app became many small, well-behaved services.',
			body: '<p>Readers never noticed.</p>\n<p>That was the point.</p>',
			moral: 'Moral: the best migrations are the boring ones.',
			postcardTo: 'everyone', postcardFrom: 'justin', postmarked: '2024 — ongoing',
			slug: 'un-monolithing', image: 'unmonolith-diagram.png',
			stamp: { shape: 'rect', motif: 'lighthouse', ink: '#f0d9a8', cents: '3¢' },
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
			order: 2, featured: true, status: 'published',
			publishedAt: '2026-06-01T12:00:00Z', createdAt: '2026-05-02T12:00:00Z', updatedAt: '2026-06-01T12:00:00Z',
		},
		{
			id: 'p3', title: 'The home lab', category: 'tinkering',
			tags: ['plex', 'linux'], shortDesc: 'A small fleet of machines that mostly behave.',
			body: '', moral: 'Moral: some hobbies are load-bearing.',
			postcardTo: 'the family', postcardFrom: 'the server closet', postmarked: '2021 — forever',
			slug: 'home-lab', image: 'homelab-rack.jpg',
			order: 3, featured: false, status: 'draft',
			publishedAt: '', createdAt: '2026-05-03T12:00:00Z', updatedAt: '2026-06-01T12:00:00Z',
		},
		{
			id: 'p4', title: 'This website', category: 'this website',
			tags: ['html', 'whimsy'], shortDesc: "The site you're on.",
			body: '', moral: 'Moral: the portfolio is also the hobby.',
			postcardTo: 'future justin', postcardFrom: 'present justin', postmarked: '2026 edition',
			slug: 'this-website', image: null, stamp: { shape: 'circle', motif: 'lighthouse', ink: '#f0d9a8' },
			order: 4, featured: true, status: 'published',
			publishedAt: '2026-06-01T12:00:00Z', createdAt: '2026-05-04T12:00:00Z', updatedAt: '2026-06-01T12:00:00Z',
		},
	];

	notes: Doc[] = [
		{
			id: 'n1', title: 'The queue is the product', teaser: 'Notes on message queues.',
			body: '<p>A decade of publishing systems.</p>\n<p>The queue was the product all along.</p>',
			date: 'feb 2026', image: null, status: 'published',
			publishedAt: '2026-06-01T12:00:00Z', createdAt: '2026-05-01T12:00:00Z', updatedAt: '2026-06-01T12:00:00Z',
		},
		{
			id: 'n2', title: 'The home lab ate my weekend', teaser: 'A confession, with uptime charts.',
			body: '<h2>an heading the sanitizer let through</h2><p>kept <em>text</em> here</p>',
			date: '—', image: 'homelab-rack.jpg', status: 'draft',
			publishedAt: '', createdAt: '2026-05-02T12:00:00Z', updatedAt: '2026-06-01T12:00:00Z',
		},
	];

	hobbies: Doc[] = [
		{ id: 'h1', name: 'The home lab', dates: '2021 — present', active: true, epitaph: '', eulogy: 'One tweak from perfect, forever.', order: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
		{ id: 'h2', name: 'CachyOS tinkering', dates: 'always', active: true, epitaph: '', eulogy: 'The day job wearing a hat.', order: 2, createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
		{ id: 'h3', name: 'Piano', dates: '2023 — 2024', active: false, epitaph: '† got good enough', eulogy: 'Quietly closed the lid.', order: 3, createdAt: '2026-01-03T00:00:00Z', updatedAt: '2026-01-03T00:00:00Z' },
		{ id: 'h4', name: 'Running', dates: 'one summer', active: false, epitaph: '† it was a phase', eulogy: 'The shoes remain, as evidence.', order: 4, createdAt: '2026-01-04T00:00:00Z', updatedAt: '2026-01-04T00:00:00Z' },
	];

	suggestions: Doc[] = [
		{ id: 's1', value: 'blacksmithing?', order: 1 },
		{ id: 's2', value: 'kayaking?', order: 2 },
	];

	media: Doc[] = [
		{ id: 'm1', filename: 'unmonolith-diagram.png', url: '/media/images/unmonolith-diagram.png', createdAt: '2026-05-01T12:00:00Z' },
		{ id: 'm2', filename: 'homelab-rack.jpg', url: '/media/images/homelab-rack.jpg', createdAt: '2026-05-02T12:00:00Z' },
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
			{ name: 'Fastnet Rock', pos: '51°23′N 9°36′W', line: 'Ireland’s teardrop — the last light the emigrants saw.' },
			{ name: 'Bell Rock', pos: '56°26′N 2°23′W', line: 'built on a rock that vanishes twice a day.' },
		],
		updatedAt: '2026-06-01T12:00:00Z',
	};

	activity: Doc[] = [
		{ id: 'a1', timestamp: '2026-07-05T09:30:00Z', message: 'note "The queue is the product" published', entityType: 'note', entityId: 'n1' },
		{ id: 'a2', timestamp: '2026-07-05T09:00:00Z', message: 'postcard "This website" edited 11 times. it counts.', entityType: 'project', entityId: 'p4' },
		{ id: 'a3', timestamp: '2026-07-05T08:50:00Z', message: 'postcard "Meo Wave Race" edited', entityType: 'project', entityId: 'p2' },
		{ id: 'a4', timestamp: '2026-07-05T08:40:00Z', message: 'postcard "The home lab" edited', entityType: 'project', entityId: 'p3' },
		{ id: 'a5', timestamp: '2026-07-05T08:30:00Z', message: 'hobby "Piano" edited', entityType: 'hobby', entityId: 'h3' },
		{ id: 'a6', timestamp: '2026-07-05T08:20:00Z', message: 'hobby "Running" edited', entityType: 'hobby', entityId: 'h4' },
		{ id: 'a7', timestamp: '2026-07-05T08:10:00Z', message: 'note "The home lab ate my weekend" edited', entityType: 'note', entityId: 'n2' },
		{ id: 'a8', timestamp: '2026-07-05T08:00:00Z', message: 'signal flags re-flown', entityType: 'sitecopy', entityId: 'c1' },
		{ id: 'a9', timestamp: '2026-07-04T21:00:00Z', message: 'lantern hoisted — site rebuilt in 41s', entityType: 'lantern', entityId: 'l1' },
		{ id: 'a10', timestamp: '2026-07-03T12:00:00Z', message: 'hobby "Running" moved to the graveyard (again)', entityType: 'hobby', entityId: 'h4' },
	];

	revisions: Record<string, Doc[]> = {
		p1: [
			{
				id: 'r2', entityType: 'project', entityId: 'p1', isCurrent: true,
				snapshot: JSON.stringify(this.projects[0]),
				summary: '“The Great Un-monolithing” — current printing', createdAt: '2026-06-01T12:00:00Z',
			},
			{
				id: 'r1', entityType: 'project', entityId: 'p1', isCurrent: false,
				snapshot: JSON.stringify({ ...this.projects[0], title: 'The Great Un-monolithing (early draft)', status: 'draft', publishedAt: '' }),
				summary: '“The Great Un-monolithing (early draft)” — before the polish', createdAt: '2026-05-15T12:00:00Z',
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
		signoff: '— j',
	};

	lantern: Doc = { state: 'idle', startedAt: '', finishedAt: '', lastHoistedAt: LAST_HOISTED, output: '' };

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
					...body, id: `p${this.nextId++}`, slug: '',
					order: Math.max(0, ...this.projects.map((p) => p.order)) + 1, featured: false,
					status: body.status ?? 'draft', publishedAt: '', createdAt: now(), updatedAt: now(),
				};
				this.projects.push(doc);
				return json(200, doc);
			}
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
			const serve = (doc: Doc) => this.copyPredatesHold
				? { ...doc, eggs: null, catPages: null, catSpots: null, bottleProverbs: null, lighthouses: null }
				: doc;
			if (method === 'GET') {
				return json(200, serve(this.copy));
			}
			if (method === 'PUT') {
				this.copy = { ...body, id: this.copy.id, updatedAt: now() };
				// echo this write's snapshot, held if a spec asked for latency —
				// a later PUT reassigns this.copy, so the captured echo stays put
				const echo = serve(this.copy);
				return this.copyPutLatency
					? new Promise<void>((resolve) => setTimeout(() => resolve(json(200, echo)), this.copyPutLatency))
					: json(200, echo);
			}
		}

		// ---- activity ----
		if (/^\/1\/activity\/?$/.test(path) && method === 'GET') {
			const limit = Number(url.searchParams.get('limit')) || 6;
			return json(200, this.activity.slice(0, limit));
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
