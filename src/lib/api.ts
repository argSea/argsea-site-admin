// The single seam between the office and the Go API. Nothing else in the
// codebase fetches: the harbor store calls these functions and stays
// transport-agnostic.
//
// API sharp edges honored here (caravan plan, "API contract caveats", plus the
// pinned slice4 contract):
//   - item routes reject a trailing slash; collections accept both; auth
//     routes REQUIRE one, encoded per function, never guessed by callers
//   - unauthenticated reads are published-only, so every request carries the
//     bearer token when one is held; drafts vanish from the lists otherwise
//   - content endpoints return bare entities/arrays; the legacy
//     {status,code,...} wrapper survives only on user/auth/delete responses
//   - PUT is full-replace: omitted fields are CLEARED. Callers must send the
//     complete document (lifecycle fields are preserved server-side)
//   - timestamps are fixed-width RFC3339 strings: string sort == chronological
//   - an empty list is [], never null

export type Category = 'backend' | 'games' | 'this website' | 'tinkering';
export type Status = 'draft' | 'published' | 'archived';

export type StampShape = 'rect' | 'circle';
export type StampMotif = 'lighthouse' | 'boat' | 'sun' | 'wave' | 'moon' | 'anchor' | 'text';
export type StampInk = '#f0d9a8' | '#93a0e8';

// A postcard's corner stamp/postmark. Optional on the wire; {} is invalid,
// so an unset stamp is omitted from the document entirely. Dormant
// postcard-era field: no longer written by the admin, kept typed so old
// documents and revisions still round-trip.
export interface Stamp {
	shape:  StampShape;
	motif:  StampMotif;
	ink:    StampInk;
	cents?: string;  // rect stamps only, e.g. "3¢"
	text?:  string;  // motif 'text' only, required then, ≤40 chars after trim
}

export type LightKind = 'fixed' | 'flash' | 'occult' | 'iso' | 'quick' | 'veryquick' | 'morse';
export type LightColor = 'white' | 'red' | 'green';

// A fact chip on a light's full entry: heading over fact, keeper's own words.
export interface Fact {
	heading: string;
	fact:    string;
}

// A light's navigational characteristic: how it burns on the coast. Period is
// the seconds one full cycle takes for the kinds whose rhythm the keeper
// dials in; fixed has none, and quick/veryquick blink at rates set by
// convention, so nothing is stored for them either. Letter is the single
// A-Z character a morse light spells, empty on every other kind. Extinguished
// is a freeform year string; any non-empty value means the light is dark (an
// abandoned project) while it stays on the list.
export interface Light {
	kind:         LightKind;
	color:        LightColor;
	period:       number;
	letter:       string;
	extinguished: string;
}

// Wire types mirror the argsea-site-api domain structs field-for-field.
export interface Project {
	id:           string;
	title:        string;
	category:     Category;
	tags:         string[];
	shortDesc:    string;       // "the register line"
	body:         string;       // sanitized HTML long-form
	moral:        string;
	postcardTo:   string;       // dormant postcard-era field, pass-through only
	postcardFrom: string;       // dormant postcard-era field, pass-through only
	postmarked:   string;       // dormant postcard-era field, pass-through only
	slug:         string;               // argsea.com/projects/<slug>, keeper-set, stable and unique
	image:        string | null;       // dormant single-print field, pass-through only
	stamp?:       Stamp | null;        // dormant postcard-era field, pass-through only
	light:        Light | null;        // arrives null, not undefined; null burns as fixed white
	images:       string[] | null;     // gallery media names, first print leads, max 6; null like tags
	facts:        Fact[] | null;       // up to 6 heading/fact pairs, shown on the full entry; null like tags
	caseStudy:    string;              // the full log, markdown in the keeper's dialect
	noteIds:      string[] | null;     // tied notes, by stable id; the tie also renders on the note; null like tags
	flagship:     boolean;             // site-side convention: exactly one flagship: admin only hints, never enforces
	firstLit:     string;
	order:        number;
	wallPos?:     { x: number; y: number; rotation: number } | null;
	featured:     boolean;
	status:       Status;
	publishedAt:  string;
	createdAt:    string;
	updatedAt:    string;
}

export interface Note {
	id:            string;
	title:         string;
	teaser:        string;
	body:          string;        // sanitized HTML
	date:          string;        // freeform display string
	conditions:    string;        // journal-style weather/mood line
	doodleId:      string | null;
	doodleCaption: string;
	status:        Status;
	publishedAt:   string;
	createdAt:     string;
	updatedAt:     string;
}

// ---- the full logs (case studies) live in their own entity ----

export type CaseLogStatus = 'draft' | 'published';
export type CalloutRegister = 'note' | 'warning' | 'dead-end';

// A block of a full log. The discriminator is `kind`; the header (title,
// subhead, established/tags) lives IN the blocks, seeded from the light and
// owned by the log. Persisted as JSON on the wire via full-replace PUT; there
// is no dialect serializer (ruling: the mock's serialize-to-dialect is
// illustrative only). Marks inside text fields are the keeper syntax the marks
// bar writes (**b**, *i*, `code`, [text](url), [? chip ?]).
export type Block =
	| { kind: 'title';      text: string }
	| { kind: 'subhead';    text: string }
	| { kind: 'meta';       established: string; tags: string[] }
	| { kind: 'heading';    text: string }
	| { kind: 'paragraph';  text: string }
	| { kind: 'quote';      text: string }
	| { kind: 'list';       ordered: boolean; items: string[] }
	| { kind: 'code';       lang: string; code: string }
	| { kind: 'mermaid';    code: string }
	| { kind: 'facts';      rows: { heading: string; fact: string }[] }
	| { kind: 'outcomes';   rows: { value: string; caption: string }[] }
	| { kind: 'figure';     image: string; caption: string }         // image = darkroom media name
	| { kind: 'comparison'; stages: { image: string; label: string }[] }
	| { kind: 'timeline';   rows: { date: string; event: string; link: string }[] }  // link optional, '' when unset
	| { kind: 'links';      rows: { label: string; url: string }[] }
	| { kind: 'callout';    register: CalloutRegister; text: string };

export type BlockKind = Block['kind'];

// A full log document. `title` is the display title for the shelf and lists,
// kept synced from the first title block on save (fallback "Untitled log").
// `revision` is the house edit counter the save line reads ("draft rev N").
export interface CaseLog {
	id:          string;
	projectId:   string;      // the light this log belongs to; exactly one lit per light
	status:      CaseLogStatus;
	title:       string;
	blocks:      Block[];
	revision:    number;
	publishedAt: string;
	createdAt:   string;
	updatedAt:   string;
}

// A named, reusable selection of blocks, insertable from the desk's palette.
// The API seeds a "header" set; v1 keeps sets insert-only (list/create/delete).
export interface BlockSet {
	id:     string;
	name:   string;
	blocks: Block[];
}

export type HobbyState = 'moored' | 'port' | 'adrift' | 'marooned' | 'inkspill';

// A charted position on the wandering chart. Null on the wire when the hobby
// has never been plotted: the API migrates old docs with coords null, and the
// editor opens those with blank inputs for charting by hand.
export interface Coord {
	lat: number;
	lon: number;
}

// The five states a hobby sits in on the chart, ordered as the editor's chips
// read. moored/made-port ride in port; adrift/marooned/ink-spilled have
// wandered off the fairway.
export const HOBBY_STATES: readonly { key: HobbyState; label: string }[] = [
	{ key: 'moored',   label: 'moored · on watch' },
	{ key: 'port',     label: 'made port' },
	{ key: 'adrift',   label: 'adrift' },
	{ key: 'marooned', label: 'marooned' },
	{ key: 'inkspill', label: 'ink-spilled' },
];

// On watch = riding in port. The chart's groups and the watch-room census both
// split on this, the same test the API and site use.
export function onWatch(h: { state: HobbyState }): boolean {
	return h.state === 'moored' || h.state === 'port';
}

export interface Hobby {
	id:        string;
	name:      string;
	service:   string;    // "2023 · 2024" · how long the keeper kept at it
	state:     HobbyState;
	coord:     Coord | null;   // charted position; null until plotted by hand
	from:      Coord | null;   // where the drift began; null draws no wake
	seasons:   string;    // soundings · seasons afloat
	bearing:   string;    // how it reads on the chart · the register line
	lastLog:   string;    // final entry, quoted on the record
	offCourse: string;    // how it went off course
	floats:    string;    // what floats · what survived
	odds:      string;    // odds of return
	tags?:     string[];  // the site's home page renders these; the admin has no
	                      // editor for them, so it passes them through untouched
	order:     number;
	createdAt: string;
	updatedAt: string;
}

export interface Suggestion {
	id:    string;
	value: string;
	order: number;
}

// The smuggler's cove rides the copy singleton. These field names are the
// frozen cross-repo contract (the site and the API build against them, do
// not rename). A copy doc from before the cove omits them on the wire; the
// harbor seeds absent fields enabled on load (absent = on, agreed ruling) so
// the first autosave persists them explicitly.
export interface EggFlags {
	bottle: boolean;
	cat:    boolean;
	lights: boolean;
}

export interface Lighthouse {
	name: string;
	pos:  string;
	line: string;
}

export interface SiteCopy {
	id:             string;
	quipHello:      string;
	quipProjects:   string;
	quipHobbies:    string;
	quipNotes:      string;
	quip404:        string;
	heroKicker:     string;
	heroHeadline:   string;
	heroBody:       string;
	dict:           string;
	eggs:           EggFlags;
	catPages:       Record<string, boolean>;  // per-page master, keyed by page id
	catSpots:       Record<string, boolean>;  // per-perch, keyed by spot id
	bottleProverbs: string[];
	lighthouses:    Lighthouse[];
	// the wall's "out with the mail" placard, same coordinate model as project
	// wallPos; null means the site falls back to its own default placement
	wallGhost:      { x: number; y: number; rotation: number; enabled: boolean } | null;
	updatedAt:      string;
}

// The copy keys the flag locker edits as plain text; the cove's egg fields
// and the wall ghost have actions of their own.
export type CopyTextField = Exclude<keyof SiteCopy, 'eggs' | 'catPages' | 'catSpots' | 'bottleProverbs' | 'lighthouses' | 'wallGhost'>;

// ---- the figurehead shop (contracts/figurehead.md, frozen 2026-07-07) ----

export type FigureheadPose = 'perched' | 'lying';
export type ShapeType = 'path' | 'ellipse' | 'rect' | 'line';
export type ShapeRole = 'tail' | 'eyes' | 'body';
export type Linecap = 'butt' | 'round' | 'square';
export type Linejoin = 'miter' | 'round' | 'bevel';

// One structured shape of a design document, never raw markup (XSS decision).
// An absent optional field means the SVG attribute default; renderers write
// only the fields present. Stroke-only shapes carry explicit fill: "none".
export interface Shape {
	id:           string;
	type:         ShapeType;
	d?:           string;             // path
	cx?:          number;             // ellipse (circles: rx == ry)
	cy?:          number;
	rx?:          number;
	ry?:          number;
	x?:           number;             // rect
	y?:           number;
	w?:           number;
	h?:           number;
	x1?:          number;             // line
	y1?:          number;
	x2?:          number;
	y2?:          number;
	fill?:        string;
	stroke?:      string;
	strokeWidth?: number;
	opacity?:     number;
	linecap?:     Linecap;
	linejoin?:    Linejoin;
	role?:        ShapeRole;          // drives the site's canonical animations
	origin?:      [number, number];   // animation transform-origin
}

export interface FigureheadDesign {
	id:        string;
	pose:      FigureheadPose;
	label:     string;
	viewBox:   string;
	shapes:    Shape[];   // always [] in responses, never null
	published: boolean;   // exactly one published per pose
	seed:      boolean;   // seeds are immutable and undeletable (PUT/DELETE 409)
	createdAt: string;
	updatedAt: string;
}

export interface ActivityEntry {
	id:         string;
	timestamp:  string;
	message:    string;
	entityType: string;
	entityId:   string;
}

export interface Revision {
	id:         string;
	entityType: string;
	entityId:   string;
	snapshot:   string;  // full document as JSON
	summary:    string;
	isCurrent:  boolean;
	createdAt:  string;
}

export interface MediaItem {
	id:        string;
	filename:  string;
	url:       string;  // web_path-relative, e.g. /media/images/<filename>
	createdAt: string;
}

export type LanternState = 'idle' | 'building' | 'swapping' | 'succeeded' | 'failed';

export interface LanternStatus {
	state:         LanternState;
	startedAt:     string;
	finishedAt:    string;
	lastHoistedAt: string;
	output:        string;
}

// The nine public profile fields the keeper edits: a subset of the user doc
// (pinned contract: no separate keeper entity; this data lives on the user).
export interface KeeperProfile {
	name:     string;
	pronouns: string;
	location: string;
	title:    string;
	bio:      string;
	email:    string;
	github:   string;
	linkedin: string;
	signoff:  string;
}

export const KEEPER_FIELDS: readonly (keyof KeeperProfile)[] =
	['name', 'pronouns', 'location', 'title', 'bio', 'email', 'github', 'linkedin', 'signoff'];

export interface LoginResult {
	userName: string;
	userID:   string;
	token:    string;
}

export class ApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const API_URL: string = import.meta.env.VITE_ARGSEA_API_URL ?? 'http://localhost:8181';

// The bearer token rides along on EVERY request once set (unauth reads are
// published-only; an unauthenticated admin would silently lose its drafts).
let bearer: string | null = null;

export function setBearer(token: string | null): void {
	bearer = token;
}

/**
 * Resolve an API media url (web_path-relative) against the API host. The
 * result lands inside CSS url("…") strings, so it is URI-encoded; a quote in
 * a filename must never escape the CSS string.
 */
export function mediaUrl(url: string): string {
	return encodeURI(/^https?:/.test(url) ? url : API_URL + url);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const headers: Record<string, string> = {};
	if (bearer) {
		headers['Authorization'] = `Bearer ${bearer}`;
	}

	let payload: BodyInit | undefined;
	if (body instanceof FormData) {
		payload = body;
	} else if (body !== undefined) {
		headers['Content-Type'] = 'application/json';
		payload = JSON.stringify(body);
	}

	let response: Response;
	try {
		response = await fetch(API_URL + path, { method, headers, body: payload });
	} catch {
		throw new ApiError(0, 'the harbor is unreachable');
	}

	if (!response.ok) {
		let message = `${response.status}`;
		try {
			const parsed = await response.json();
			if (parsed && typeof parsed.message === 'string') {
				message = parsed.message;
			}
		} catch { /* non-JSON error body, keep the status code */ }
		throw new ApiError(response.status, message);
	}

	// Delete/logout wrappers are parsed but discarded by callers typed void
	return response.status === 204 ? (undefined as T) : response.json();
}

// ---- auth (trailing slash REQUIRED on this route family) ----

interface LoginWire { userName: string; userID: string; token: string; }

export async function login(userName: string, password: string): Promise<LoginResult> {
	const wire = await request<LoginWire>('POST', '/1/auth/login/', { userName, password });
	return { userName: wire.userName, userID: wire.userID, token: wire.token };
}

export function logout(): Promise<void> {
	return request<void>('GET', '/1/auth/logout/');
}

export function validate(): Promise<void> {
	return request<void>('GET', '/1/auth/validate/');
}

// ---- projects & notes share the content-lifecycle surface ----

interface ContentApi<T> {
	list():                         Promise<T[]>;
	create(doc: Partial<T>):        Promise<T>;
	update(id: string, doc: T):     Promise<T>;
	remove(id: string):             Promise<void>;
	publish(id: string):            Promise<T>;
	unpublish(id: string):          Promise<T>;
	revisions(id: string, limit: number):        Promise<Revision[]>;
	restore(id: string, revisionId: string):     Promise<T>;
}

function contentApi<T>(family: 'project' | 'note' | 'caselog'): ContentApi<T> {
	const base = `/1/${family}`;
	return {
		list:      ()        => request<T[]>('GET', `${base}/`),
		create:    (doc)     => request<T>('POST', `${base}/`, doc),
		update:    (id, doc) => request<T>('PUT', `${base}/${id}`, doc),
		remove:    (id)      => request<void>('DELETE', `${base}/${id}`),
		publish:   (id)      => request<T>('POST', `${base}/${id}/publish`),
		unpublish: (id)      => request<T>('POST', `${base}/${id}/unpublish`),
		revisions: (id, limit)     => request<Revision[]>('GET', `${base}/${id}/revisions?limit=${limit}`),
		restore:   (id, revisionId) => request<T>('POST', `${base}/${id}/revisions/${revisionId}/restore`),
	};
}

export const projects = contentApi<Project>('project');
export const notes = contentApi<Note>('note');

// The full logs ride the same content-lifecycle surface as projects/notes,
// plus a `get` for a single log. publish is an atomic swap: any other lit log
// of the same light returns to draft, and the API rejects the hoist if the
// light has no slug (a lit log needs a public route).
export const caselog = {
	...contentApi<CaseLog>('caselog'),
	get: (id: string): Promise<CaseLog> => request<CaseLog>('GET', `/1/caselog/${id}`),
};

// Block sets: insert-only in v1, so list/create/delete only. The API seeds a
// "header" set. The collection route carries the trailing slash like the rest.
export const blockset = {
	list:   ()                            => request<BlockSet[]>('GET', '/1/blockset/'),
	create: (doc: { name: string; blocks: Block[] }) => request<BlockSet>('POST', '/1/blockset/', doc),
	remove: (id: string)                  => request<void>('DELETE', `/1/blockset/${id}`),
};

// Lifecycle-style rack endpoints (pinned contract: activity-logged, no
// revision snapshot; reordering must not spam revisions)
export function reorderProject(id: string, order: number): Promise<Project> {
	return request<Project>('POST', `/1/project/${id}/reorder`, { order });
}

export function featureProject(id: string, featured: boolean): Promise<Project> {
	return request<Project>('POST', `/1/project/${id}/${featured ? 'feature' : 'unfeature'}`);
}

// Non-destructive bulk set of wall positions; the response is the full
// updated project list, same shape as the list endpoint.
export function arrangeProjects(placements: { id: string; x: number; y: number; rotation: number }[]): Promise<Project[]> {
	return request<Project[]>('PUT', '/1/project/arrangement', { placements });
}

// ---- hobbies (no lifecycle; reorder/retire go through full-replace PUT) ----

export const hobbies = {
	list:   ()                       => request<Hobby[]>('GET', '/1/hobby/'),
	create: (doc: Partial<Hobby>)    => request<Hobby>('POST', '/1/hobby/', doc),
	update: (id: string, doc: Hobby) => request<Hobby>('PUT', `/1/hobby/${id}`, doc),
	remove: (id: string)             => request<void>('DELETE', `/1/hobby/${id}`),
};

// ---- suggestion pool ----

export const suggestions = {
	list:   ()              => request<Suggestion[]>('GET', '/1/suggestion/'),
	add:    (value: string) => request<Suggestion>('POST', '/1/suggestion/', { value }),
	remove: (id: string)    => request<void>('DELETE', `/1/suggestion/${id}`),
};

// ---- figurehead designs (the shop's shelf and editor) ----

// POST always lands as a draft (published/seed in the body are ignored); PUT
// edits label/viewBox/shapes only (pose, published, seed, createdAt preserved
// server-side, 409 on a seed); DELETE 409s for published designs and seeds;
// publish is atomic within the pose: hoist first, then lower the previous.
export const figurehead = {
	published: ()                                  => request<FigureheadDesign[]>('GET', '/1/figurehead/published'),
	list:      ()                                  => request<FigureheadDesign[]>('GET', '/1/figurehead/designs'),
	create:    (doc: Partial<FigureheadDesign>)    => request<FigureheadDesign>('POST', '/1/figurehead/designs', doc),
	update:    (id: string, doc: FigureheadDesign) => request<FigureheadDesign>('PUT', `/1/figurehead/designs/${id}`, doc),
	remove:    (id: string)                        => request<void>('DELETE', `/1/figurehead/designs/${id}`),
	publish:   (id: string)                        => request<FigureheadDesign>('POST', `/1/figurehead/designs/${id}/publish`),
};

// ---- doodles (Marginalia's shelf and editor, no publish/seed lifecycle) ----

// POST always lands as a fresh doodle; PUT edits name/viewBox/shapes only
// (createdAt preserved server-side). Public GET (the site joins notes to
// doodles by id); admin-gated create/update/delete.
export interface Doodle {
	id:        string;
	name:      string;
	viewBox:   string;
	shapes:    Shape[];
	createdAt: string;
	updatedAt: string;
}

export const doodle = {
	list:   ()                     => request<Doodle[]>('GET', '/1/doodle'),
	create: (doc: Partial<Doodle>) => request<Doodle>('POST', '/1/doodle', doc),
	update: (id: string, doc: Doodle) => request<Doodle>('PUT', `/1/doodle/${id}`, doc),
	remove: (id: string)           => request<void>('DELETE', `/1/doodle/${id}`),
};

// ---- carvings (the carving shop's catalog + bench, pinned 2026-07-11) ----

// The seven spots a carving can bolt onto: a frozen enum, code-side on both
// this admin and the site. The catalog carries three more display-only rows
// (stamp/wreck/harbor-cat) that are not spots and never back a carving.
export type CarvingSpot = 'lighthouse-logo' | 'boat' | 'bottle' | 'tower-stub' | 'paw' | 'wave-line' | 'boat-wake';

// Raw SVG markup, unlike figurehead/doodle's structured Shape[] (a deliberate
// contract choice, not an oversight: bolting a carving is a straight SVG
// swap on the site, no animation model to preserve). Builtin (v1 seed)
// carvings keep name/svg frozen server-side; boltedTo stays mutable on them
// so a spot can always be re-bolted back to its seed.
export interface Carving {
	id:        string;
	name:      string;
	svg:       string;
	builtin:   boolean;
	boltedTo:  string[];
	createdAt: string;
	updatedAt: string;
}

// Standard content CRUD, admin-gated mutations, public GET like projects.
// Bolting is its own action, mirroring the figurehead publish pattern: PUT
// edits name/svg only and preserves boltedTo untouched, while POST .../bolt
// performs the swap (auto-strips the spot from its previous holder).
export const carvings = {
	list:   ()                       => request<Carving[]>('GET', '/1/carving/carvings'),
	create: (doc: Partial<Carving>)  => request<Carving>('POST', '/1/carving/carvings', doc),
	update: (id: string, doc: Carving) => request<Carving>('PUT', `/1/carving/carvings/${id}`, doc),
	bolt:   (id: string, spot: string) => request<Carving>('POST', `/1/carving/carvings/${id}/bolt`, { spot }),
};

// ---- site copy singleton ----

export function getCopy(): Promise<SiteCopy> {
	return request<SiteCopy>('GET', '/1/copy');
}

export function putCopy(doc: SiteCopy): Promise<SiteCopy> {
	return request<SiteCopy>('PUT', '/1/copy', doc);
}

// ---- keeper's log ----

/** The API defaults to a small recent window; pass a limit and mean it. */
export function listActivity(limit: number): Promise<ActivityEntry[]> {
	return request<ActivityEntry[]>('GET', `/1/activity/?limit=${limit}`);
}

// ---- the watch room's sightings aggregate ----

export interface TrafficDay {
	day:     string;   // YYYY-MM-DD, oldest-to-newest, zero-filled
	sails:   number;
	uniques: number;
}

export interface TopPostcard {
	subject: string;   // a project id; the admin resolves the title from its store
	flips:   number;
}

export interface TopNote {
	subject: string;   // a note id; the admin resolves the title from its store
	reads:   number;
}

export interface TopHobby {
	subject: string;   // a hobby id; the admin resolves the name from its store
	visits:  number;
}

export interface FlareRoll {
	subject: string;   // a hobby id; the admin resolves the name from its store
	flares:  number;   // distinct visitors who sent one up for this hobby
}

export interface TrafficPort {
	port:  string;
	share: number;     // integer percentage
}

// The sightings API's first-party aggregate over the last `days`. `busiest` is
// a lowercase weekday name, empty on an empty window; the tops are null when
// nothing was flipped, read, or visited. `bottles` counts the proverbs the
// crossing boat handed out in the window. Deploy skew is expected: an API that
// predates this route 404s, so the watch room reads it fail-soft.
export interface TrafficReport {
	uniques:     number;
	sails:       number;
	days:        TrafficDay[];
	busiest:     string;
	topPostcard: TopPostcard | null;
	topNote:     TopNote | null;
	topHobby:    TopHobby | null;
	ports:       TrafficPort[];
	bottles:     number;
	// the flare tally rides the same aggregate: `flares` is the headline count
	// (distinct visitors who signaled), `flareRolls` the per-hobby breakdown,
	// sorted descending with zero counts omitted, [] when none. Both are
	// optional on the wire: an API from before the tally omits them, and the
	// watch room falls soft to a quiet tile and an empty roll call.
	flares?:     number;
	flareRolls?: FlareRoll[];
}

export function traffic(days = 7): Promise<TrafficReport> {
	return request<TrafficReport>('GET', `/1/sighting/traffic?days=${days}`);
}

// ---- media (the darkroom) ----

export const media = {
	list: () => request<MediaItem[]>('GET', '/1/media/'),
	upload: (file: File) => {
		const form = new FormData();
		form.append('file', file);
		return request<MediaItem>('POST', '/1/media/', form);
	},
	remove: (id: string) => request<void>('DELETE', `/1/media/${id}`),
};

// ---- the keeper (profile lives on the user doc) ----

export function getProfile(userId: string): Promise<KeeperProfile> {
	return request<KeeperProfile>('GET', `/1/user/${userId}/profile`);
}

export function getUser(userId: string): Promise<Record<string, unknown>> {
	return request<Record<string, unknown>>('GET', `/1/user/${userId}`);
}

/**
 * Save the keeper's papers. PUT is full-replace, so the current user doc is
 * fetched and the profile fields merged over it, and `role` is never sent
 * (the server strips it anyway; admin is granted only by direct DB update).
 */
export async function saveProfile(userId: string, profile: KeeperProfile): Promise<void> {
	const doc: Record<string, unknown> = { ...await getUser(userId), ...profile };
	delete doc['role'];
	delete doc['password'];
	await request<unknown>('PUT', `/1/user/${userId}`, doc);
}

// ---- the lantern ----

export interface HoistResult {
	accepted: boolean;  // false = 409, a hoist is already in flight
	status:   LanternStatus;
}

export function lanternStatus(): Promise<LanternStatus> {
	return request<LanternStatus>('GET', '/1/lantern/');
}

export async function hoist(): Promise<HoistResult> {
	const headers: Record<string, string> = bearer ? { Authorization: `Bearer ${bearer}` } : {};
	const response = await fetch(`${API_URL}/1/lantern/hoist`, { method: 'POST', headers });

	// 409 still carries the in-flight status; adopt it instead of throwing
	if (response.status === 202 || response.status === 409) {
		return { accepted: response.status === 202, status: await response.json() };
	}
	throw new ApiError(response.status, response.status === 403
		? 'the lantern only answers to the keeper'
		: `hoist failed (${response.status})`);
}

export interface RollbackResult {
	ok:     boolean;  // false = 409: hoist in flight OR no previous build
	status: LanternStatus;
}

/**
 * 200 = re-pointed at the previous build. 409 carries the LanternStatus body
 * too (integrator pin 2026-07-05, mirroring hoist): a deploying state means a
 * hoist is in flight, a non-deploying one means there is no previous build;
 * callers tell the two apart by the status fields, not the body shape.
 */
export async function lanternRollback(): Promise<RollbackResult> {
	const headers: Record<string, string> = bearer ? { Authorization: `Bearer ${bearer}` } : {};
	const response = await fetch(`${API_URL}/1/lantern/rollback`, { method: 'POST', headers });

	if (response.ok || response.status === 409) {
		return { ok: response.ok, status: await response.json() };
	}
	throw new ApiError(response.status, response.status === 403
		? 'the lantern only answers to the keeper'
		: `rollback failed (${response.status})`);
}
