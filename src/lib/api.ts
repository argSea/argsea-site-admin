// The single seam between the office and the Go API. Nothing else in the
// codebase fetches: the harbor store calls these functions and stays
// transport-agnostic.
//
// API sharp edges honored here (caravan plan, "API contract caveats", plus the
// pinned slice4 contract):
//   - item routes reject a trailing slash; collections accept both; auth
//     routes REQUIRE one — encoded per function, never guessed by callers
//   - unauthenticated reads are published-only, so every request carries the
//     bearer token when one is held — drafts vanish from the lists otherwise
//   - content endpoints return bare entities/arrays; the legacy
//     {status,code,...} wrapper survives only on user/auth/delete responses
//   - PUT is full-replace: omitted fields are CLEARED. Callers must send the
//     complete document (lifecycle fields are preserved server-side)
//   - timestamps are fixed-width RFC3339 strings — string sort == chronological
//   - an empty list is [], never null

export type Category = 'backend' | 'games' | 'this website' | 'tinkering';
export type Status = 'draft' | 'published' | 'archived';

export type StampShape = 'rect' | 'circle';
export type StampMotif = 'lighthouse' | 'boat' | 'sun' | 'wave' | 'moon' | 'anchor' | 'text';
export type StampInk = '#f0d9a8' | '#93a0e8';

// A postcard's corner stamp/postmark. Optional on the wire — {} is invalid,
// so an unset stamp is omitted from the document entirely.
export interface Stamp {
	shape:  StampShape;
	motif:  StampMotif;
	ink:    StampInk;
	cents?: string;  // rect stamps only, e.g. "3¢"
	text?:  string;  // motif 'text' only, required then, ≤40 chars after trim
}

// Wire types mirror the argsea-site-api domain structs field-for-field.
export interface Project {
	id:           string;
	title:        string;
	category:     Category;
	tags:         string[];
	shortDesc:    string;       // "front of card"
	body:         string;       // sanitized HTML long-form
	moral:        string;
	postcardTo:   string;
	postcardFrom: string;
	postmarked:   string;       // freeform display string
	slug:         string;
	image:        string | null;
	stamp?:       Stamp | null;
	order:        number;
	featured:     boolean;
	status:       Status;
	publishedAt:  string;
	createdAt:    string;
	updatedAt:    string;
}

export interface Note {
	id:          string;
	title:       string;
	teaser:      string;
	body:        string;        // sanitized HTML
	date:        string;        // freeform display string
	image:       string | null;
	status:      Status;
	publishedAt: string;
	createdAt:   string;
	updatedAt:   string;
}

export interface Hobby {
	id:        string;
	name:      string;
	dates:     string;
	active:    boolean;
	epitaph:   string;
	eulogy:    string;
	order:     number;
	createdAt: string;
	updatedAt: string;
}

export interface Suggestion {
	id:    string;
	value: string;
	order: number;
}

export interface SiteCopy {
	id:           string;
	quipHello:    string;
	quipProjects: string;
	quipHobbies:  string;
	quipNotes:    string;
	quip404:      string;
	heroKicker:   string;
	heroHeadline: string;
	heroBody:     string;
	dict:         string;
	updatedAt:    string;
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

// The nine public profile fields the keeper edits — a subset of the user doc
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
// published-only — an unauthenticated admin would silently lose its drafts).
let bearer: string | null = null;

export function setBearer(token: string | null): void {
	bearer = token;
}

/** Resolve an API media url (web_path-relative) against the API host. */
export function mediaUrl(url: string): string {
	return /^https?:/.test(url) ? url : API_URL + url;
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
		} catch { /* non-JSON error body — keep the status code */ }
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

function contentApi<T>(family: 'project' | 'note'): ContentApi<T> {
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

// Lifecycle-style rack endpoints (pinned contract: activity-logged, no
// revision snapshot — reordering must not spam revisions)
export function reorderProject(id: string, order: number): Promise<Project> {
	return request<Project>('POST', `/1/project/${id}/reorder`, { order });
}

export function featureProject(id: string, featured: boolean): Promise<Project> {
	return request<Project>('POST', `/1/project/${id}/${featured ? 'feature' : 'unfeature'}`);
}

// ---- hobbies (no lifecycle — reorder/retire go through full-replace PUT) ----

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

// ---- site copy singleton ----

export function getCopy(): Promise<SiteCopy> {
	return request<SiteCopy>('GET', '/1/copy');
}

export function putCopy(doc: SiteCopy): Promise<SiteCopy> {
	return request<SiteCopy>('PUT', '/1/copy', doc);
}

// ---- ship's log ----

export function listActivity(): Promise<ActivityEntry[]> {
	return request<ActivityEntry[]>('GET', '/1/activity/');
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
 * fetched and the profile fields merged over it — and `role` is never sent
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

	// 409 still carries the in-flight status — adopt it instead of throwing
	if (response.status === 202 || response.status === 409) {
		return { accepted: response.status === 202, status: await response.json() };
	}
	throw new ApiError(response.status, response.status === 403
		? 'the lantern only answers to the harbormaster'
		: `hoist failed (${response.status})`);
}

/** 200 = re-pointed at the previous build; 409 = nothing to roll back to. */
export function lanternRollback(): Promise<LanternStatus> {
	return request<LanternStatus>('POST', '/1/lantern/rollback');
}
