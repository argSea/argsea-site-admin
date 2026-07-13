// The harbor store: one provider owning every piece of office state, the way
// the design mock kept it in a single component. Screens stay markup-heavy and
// logic-light: they read from this context and call its actions. All API
// traffic funnels through lib/api.ts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as api from '../lib/api';
import type {
	ActivityEntry, Carving, Category, Coord, CopyTextField, Doodle, EggFlags, Fact, FigureheadDesign, FigureheadPose,
	Hobby, HobbyState, KeeperProfile, LanternStatus, Light, Lighthouse, MediaItem, Note, Project, Revision, Shape,
	SiteCopy, Suggestion, TrafficReport,
} from '../lib/api';
import { onWatch } from '../lib/api';
import { htmlToText, textToHtml } from '../lib/paragraphs';
import { DEFAULT_LIGHT } from '../lib/lightChar';

export type Screen = 'dash' | 'projects' | 'hobbies' | 'notes' | 'copy' | 'eggs' | 'shop' | 'media' | 'keeper' | 'marginalia';

// What the shop's editor hands back on save: the document fields a PUT may
// change (plus pose, which only a POST uses; the server preserves it after).
export interface DesignFields {
	pose:    FigureheadPose;
	label:   string;
	viewBox: string;
	shapes:  Shape[];
}

// What Marginalia's editor hands back on save; no pose/lifecycle, just a doc.
export interface DoodleFields {
	name:    string;
	viewBox: string;
	shapes:  Shape[];
}

// The three live eggs and the cat's rounds: display copy shared by the cove
// screen and the toggle toasts. The keys are the frozen cross-repo contract.
export const EGG_DEFS: { key: keyof EggFlags; name: string; blurb: string; where: string }[] = [
	{
		key: 'bottle', name: 'Message in a bottle', where: 'homepage · the drifting boat',
		blurb: 'Poke the little boat sailing across the waves and it drops a corked bottle, a proverb unrolls from it, then drifts off.',
	},
	{
		key: 'cat', name: 'The harbor cat', where: 'every page · one perch per view',
		blurb: 'The lighthouse cat, out on its rounds. One shows per page, picked from a catalog of perches across the whole site; pin it per spot and per page below.',
	},
	{
		key: 'lights', name: 'The light list', where: 'the 404 wreck report',
		blurb: 'Every wreck report lists a last known position: the real coordinates of a real lighthouse. Click them and the light introduces itself.',
	},
];

// The cat's catalog of perches: a page → spots tree. The site defines the same
// catalog (each spot carries its pose + anchor there); the copy doc only stores
// on/off, so this repo hardcodes its own copy. The page + spot ids are the
// FROZEN cross-repo contract, matched to the site slice, do not rename. A new
// perch is a code change in both repos that then shows up in the cove on its own.
export interface CatSpot { id: string; label: string; hint: string }
export interface CatPage { id: string; label: string; spots: CatSpot[] }

export const CAT_CATALOG: CatPage[] = [
	{
		id: 'hello', label: 'Hello', spots: [
			{ id: 'hello.header', label: 'The nav link', hint: 'lounging on the hello nav link' },
			{ id: 'hello.hero', label: 'The hero', hint: 'peeking beside the hero headline' },
			{ id: 'hello.postcard', label: 'An open light entry', hint: 'on a light entry when it opens' },
			{ id: 'hello.manifest', label: "The keeper's stores", hint: 'at the end of the stores list' },
			{ id: 'hello.graveyard', label: 'The hobby graveyard', hint: 'among the graveyard chips' },
			{ id: 'hello.contact', label: 'The contact lighthouse', hint: 'by the contact-band lighthouse' },
		],
	},
	{
		id: 'projects', label: 'Projects', spots: [
			{ id: 'projects.header', label: 'The nav link', hint: 'lounging on the projects nav link' },
			{ id: 'projects.filterTag', label: 'The filter chip', hint: 'on the active filter chip' },
			{ id: 'projects.card', label: 'A register row', hint: 'on a register row' },
			{ id: 'projects.overlay', label: 'The light entry', hint: 'peeking from an open light entry' },
		],
	},
	{
		id: 'hobbies', label: 'Hobbies', spots: [
			{ id: 'hobbies.header', label: 'The nav link', hint: 'lounging on the hobbies nav link' },
			{ id: 'hobbies.entry', label: 'A logbook entry', hint: 'on a logbook headstone' },
			{ id: 'hobbies.nextChip', label: 'The next chip', hint: 'on the next: ??? chip' },
		],
	},
	{
		id: 'notes', label: 'Notes', spots: [
			{ id: 'notes.header', label: 'The nav link', hint: 'lounging on the notes nav link' },
			{ id: 'notes.row', label: 'A note row', hint: 'on a note row' },
			{ id: 'notes.overlay', label: 'An open letter', hint: 'on a letter when it opens' },
		],
	},
	{
		id: 'p404', label: '404', spots: [
			{ id: 'p404.wreck', label: 'The wreck placard', hint: 'heckling from the 404 placard' },
		],
	},
];

const CAT_PAGES_ON: Record<string, boolean> = Object.fromEntries(CAT_CATALOG.map((pg) => [pg.id, true]));
const CAT_SPOTS_ON: Record<string, boolean> = Object.fromEntries(
	CAT_CATALOG.flatMap((pg) => pg.spots.map((sp) => [sp.id, true])),
);

// The carving shop's catalog: every hand-carved SVG on the site and where it
// hangs, admin-side display data verbatim from the design mock's svgCatalog.
// The seven `spot: true` rows are the frozen bolt targets (a carving's own
// boltedTo names them); the last three are catalog-only, no carving behind
// them, so the bench never opens for those.
export interface CarvingCatalogEntry {
	id:    string;
	name:  string;
	page:  string;
	where: string;
	spot:  boolean;
	note?: string;
}

export const CARVING_CATALOG: CarvingCatalogEntry[] = [
	{ id: 'lighthouse-logo', name: 'The lighthouse', page: 'every page', where: 'nav, top left · also the contact band', spot: true },
	{ id: 'boat', name: 'The little boat', page: 'hello · projects', where: 'sails the hero wave and drops the mail · also passes the coast offshore', spot: true },
	{ id: 'bottle', name: 'Message in a bottle', page: 'hello', where: 'bobs on the wave after the boat drops it', spot: true },
	{ id: 'tower-stub', name: 'Tower on the horizon', page: 'projects', where: 'every beacon on the coast · the entry overlay lamp', spot: true },
	{ id: 'paw', name: 'Paw print', page: 'hello · notes', where: 'walks across journal rows the cat has read', spot: true },
	{ id: 'wave-line', name: 'The wave line', page: 'hello', where: 'the shoreline strip under the hero (repeating pattern)', spot: true },
	{ id: 'boat-wake', name: 'The boat wake', page: 'hello', where: 'ripples trailing the boat (repeating pattern)', spot: true },
	{
		id: 'stamp', name: 'Postage lighthouse', page: 'contact', where: 'the stamp corner of the postcard, postmark rings over it', spot: false,
		note: 'carved into the postcard itself. bring the whole card to the bench (Contact.dc.html) to re-cut it.',
	},
	{
		id: 'wreck', name: 'The wreck', page: '404', where: 'run aground on the shoals, cat heckling from the placard', spot: false,
		note: 'salvage rights unresolved. edit it where it lies (404.dc.html).',
	},
	{
		id: 'harbor-cat', name: 'The harbor cat', page: 'everywhere', where: 'postcards, notes, the wreck placard, this shop', spot: false,
		note: 'the cat sits for no editor. adjustments by appointment (HarborCat.dc.html), approval unlikely.',
	},
];

export interface Session {
	token:    string;
	userID:   string;
	userName: string;
}

export interface ProjectDraft {
	title:     string;
	category:  Category;
	tagsText:  string;
	shortDesc: string;
	bodyText:  string;
	moral:     string;
	images:    string[];  // station archive, first print leads, max 6
	light:     Light;
	firstLit:  string;
	slug:      string;
	facts:     Fact[];     // heading/fact pairs, max 6
	caseStudy: string;     // the full log, markdown
	noteIds:   string[];   // tied notes, by stable id
	flagship:  boolean;
}

export interface NoteDraft {
	title:         string;
	date:          string;
	teaser:        string;
	bodyText:      string;
	conditions:    string;
	doodleId:      string | null;
	doodleCaption: string;
}

// The chart editor keeps coordinates as the raw text of their number inputs:
// blank means "not plotted" (null on the wire), and a half-filled pair is a
// save-time validation error, not a silent zero-fill.
export interface HobbyDraft {
	name:      string;
	service:   string;
	state:     HobbyState;
	coordLat:  string;
	coordLon:  string;
	fromLat:   string;
	fromLon:   string;
	seasons:   string;
	bearing:   string;
	lastLog:   string;
	floats:    string;
	offCourse: string;
	odds:      string;
}

interface EditBase {
	id:          string | null;
	revisions:   Revision[];
	restoredRev: string | null;
	// whether the keeper typed after loading a revision, decides if a PUT
	// rides on top of the restore
	touched:     boolean;
}

export type EditState =
	| (EditBase & { type: 'project'; draft: ProjectDraft })
	| (EditBase & { type: 'note'; draft: NoteDraft })
	| (EditBase & { type: 'hobby'; draft: HobbyDraft });

export type EditType = EditState['type'];

export interface PeekState {
	type: 'project' | 'note';
	id:   string;
}

const EMPTY_COPY: SiteCopy = {
	id: '', quipHello: '', quipProjects: '', quipHobbies: '', quipNotes: '', quip404: '',
	heroKicker: '', heroHeadline: '', heroBody: '', dict: '',
	eggs: { bottle: true, cat: true, lights: true },
	catPages: CAT_PAGES_ON, catSpots: CAT_SPOTS_ON,
	bottleProverbs: [], lighthouses: [], wallGhost: null, updatedAt: '',
};

// Absent = on (agreed ruling): a copy doc from before the cove lacks the egg
// fields on the wire; seed them enabled so the first autosave persists them
// explicitly. Nested spreads guard a partially-filled object too.
function seedCove(doc: SiteCopy): SiteCopy {
	return {
		...EMPTY_COPY,
		...doc,
		eggs:           { ...EMPTY_COPY.eggs, ...doc.eggs },
		catPages:       { ...CAT_PAGES_ON, ...doc.catPages },
		catSpots:       { ...CAT_SPOTS_ON, ...doc.catSpots },
		bottleProverbs: doc.bottleProverbs ?? [],
		lighthouses:    doc.lighthouses ?? [],
	};
}

const EMPTY_KEEPER: KeeperProfile = {
	name: '', pronouns: '', location: '', title: '', bio: '',
	email: '', github: '', linkedin: '', signoff: '',
};

const SESSION_KEY = 'harbor-session';
const AUTOSAVE_DELAY = 800;
const CONFIRM_WINDOW = 2800;
const TOAST_WINDOW = 2600;
const REVISIONS_SHOWN = 5;

const byOrder = <T extends { order: number; createdAt: string }>(a: T, b: T): number =>
	a.order - b.order || a.createdAt.localeCompare(b.createdAt);

function loadSession(): Session | null {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		return raw ? (JSON.parse(raw) as Session) : null;
	} catch {
		return null;
	}
}

function projectDraft(p?: Project): ProjectDraft {
	return p
		? {
			title: p.title, category: p.category, tagsText: p.tags.join(', '),
			shortDesc: p.shortDesc, bodyText: htmlToText(p.body), moral: p.moral,
			images: p.images ?? [], light: p.light ?? DEFAULT_LIGHT, firstLit: p.firstLit,
			slug: p.slug, facts: (p.facts ?? []).map((f) => ({ ...f })), caseStudy: p.caseStudy ?? '',
			noteIds: [...(p.noteIds ?? [])], flagship: p.flagship,
		}
		: {
			title: '', category: 'backend', tagsText: '', shortDesc: '', bodyText: '',
			moral: 'Moral: ', images: [], light: DEFAULT_LIGHT, firstLit: '',
			slug: '', facts: [], caseStudy: '', noteIds: [], flagship: false,
		};
}

function monthYear(): string {
	return new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toLowerCase();
}

function noteDraft(n?: Note): NoteDraft {
	return n
		? {
			title: n.title, date: n.date, teaser: n.teaser, bodyText: htmlToText(n.body),
			conditions: n.conditions, doodleId: n.doodleId, doodleCaption: n.doodleCaption,
		}
		: { title: '', date: monthYear(), teaser: '', bodyText: '', conditions: '', doodleId: null, doodleCaption: '' };
}

// A coord loads into the two number inputs as text, or blank when unplotted;
// the editor charts a migrated (null-coord) hobby by hand from there.
const coordText = (c: number | undefined): string => (c === undefined ? '' : String(c));

function hobbyDraft(h?: Hobby): HobbyDraft {
	return h
		? {
			name: h.name, service: h.service, state: h.state,
			coordLat: coordText(h.coord?.lat), coordLon: coordText(h.coord?.lon),
			fromLat: coordText(h.from?.lat), fromLon: coordText(h.from?.lon),
			seasons: h.seasons, bearing: h.bearing, lastLog: h.lastLog,
			floats: h.floats, offCourse: h.offCourse, odds: h.odds,
		}
		: {
			name: '', service: `${new Date().getFullYear()} · present`, state: 'moored',
			coordLat: '58.20', coordLon: '-7.40', fromLat: '', fromLon: '',
			seasons: '1', bearing: '', lastLog: '', floats: '', offCourse: '', odds: '',
		};
}

// Blank both bearings and the mark draws no wake (null on the wire); fill both
// and it charts; fill exactly one and the save bounces. A filled-but-unparseable
// value counts as filled, so "58.2x" is rejected rather than silently dropped.
function parseCoord(latStr: string, lonStr: string): Coord | null | 'half' {
	const latBlank = latStr.trim() === '';
	const lonBlank = lonStr.trim() === '';
	if (latBlank && lonBlank) {
		return null;
	}
	const lat = parseFloat(latStr);
	const lon = parseFloat(lonStr);
	if (latBlank || lonBlank || isNaN(lat) || isNaN(lon)) {
		return 'half';
	}
	return { lat, lon };
}

interface HarborValue {
	session:  Session | null;
	booting:  boolean;
	screen:   Screen;
	goTo:     (screen: Screen) => void;
	signIn:   (userName: string, password: string) => Promise<void>;
	goAshore: () => void;

	projects:    Project[];
	notes:       Note[];
	hobbies:     Hobby[];
	suggestions: Suggestion[];
	prints:      MediaItem[];
	copy:        SiteCopy;
	keeper:      KeeperProfile;
	activity:    ActivityEntry[];
	designs:     FigureheadDesign[];
	doodles:     Doodle[];
	carvings:    Carving[];
	traffic:     TrafficReport | null;

	keeperName: string;
	dirtyCount: number;

	toast:      string | null;
	showToast:  (message: string) => void;
	confirmKey: string | null;
	askConfirm: (key: string, doIt: () => void) => void;

	edit:         EditState | null;
	openEdit:     (type: EditType, id: string | null) => void;
	patchDraft:   (patch: Partial<ProjectDraft & NoteDraft & HobbyDraft>) => void;
	patchLight:   (patch: Partial<Light>) => void;
	loadRevision: (revision: Revision) => void;
	saveEdit:     () => Promise<void>;
	cancelEdit:   () => void;

	peek:      PeekState | null;
	openPeek:  (type: PeekState['type'], id: string) => void;
	closePeek: () => void;

	toggleProjectStatus: (p: Project) => Promise<void>;
	toggleNoteStatus:    (n: Note) => Promise<void>;
	toggleFeatured:      (p: Project) => Promise<void>;
	toggleFlagship:      (p: Project) => Promise<void>;
	moveProject:         (p: Project, dir: -1 | 1) => Promise<void>;
	arrangeProjects:     (placements: { id: string; x: number; y: number; rotation: number }[]) => Promise<void>;
	strikeProject:       (p: Project) => Promise<void>;
	burnNote:            (n: Note) => Promise<void>;
	toggleNoteTie:       (p: Project, noteId: string) => Promise<void>;

	moveHobby:       (h: Hobby, dir: -1 | 1) => Promise<void>;
	setAdriftOrPort: (h: Hobby) => Promise<void>;
	addSuggestion:    (value: string) => Promise<void>;
	removeSuggestion: (s: Suggestion) => Promise<void>;

	flareRoll:      boolean;
	openFlareRoll:  () => void;
	closeFlareRoll: () => void;

	setCopyField:   (key: CopyTextField, value: string) => void;
	setKeeperField: (key: keyof KeeperProfile, value: string) => void;
	setWallGhost:   (ghost: SiteCopy['wallGhost']) => void;

	toggleEgg:     (key: keyof EggFlags) => void;
	toggleCatPage: (pageId: string) => void;
	toggleCatSpot: (spotId: string) => void;
	setProverb:    (idx: number, value: string) => void;
	addProverb:    () => void;
	removeProverb: (idx: number) => void;
	setLight:      (idx: number, patch: Partial<Lighthouse>) => void;
	addLight:      () => void;
	removeLight:   (idx: number) => void;

	saveDesign:    (id: string | null, fields: DesignFields) => Promise<FigureheadDesign | null>;
	renameDesign:  (d: FigureheadDesign, label: string) => Promise<void>;
	deleteDesign:  (d: FigureheadDesign) => Promise<void>;
	publishDesign: (d: FigureheadDesign) => Promise<void>;

	saveDoodle:   (id: string | null, fields: DoodleFields) => Promise<Doodle | null>;
	renameDoodle: (d: Doodle, name: string) => Promise<void>;
	deleteDoodle: (d: Doodle) => Promise<void>;

	saveCarving: (id: string | null, fields: { name: string; svg: string }) => Promise<Carving | null>;
	boltCarving: (c: Carving, spot: string) => Promise<void>;

	printUsage:    (filename: string) => number;
	developPrints: (files: Iterable<File>) => Promise<void>;
	tearOffPrint:  (m: MediaItem) => Promise<void>;

	lantern:        LanternStatus | null;
	lanternAbsent:  boolean;
	deploying:      boolean;
	deployPct:      number;
	hoistLantern:   () => Promise<void>;
	rollbackLantern: () => Promise<void>;
}

const HarborContext = createContext<HarborValue | null>(null);

export function useHarbor(): HarborValue {
	const value = useContext(HarborContext);
	if (!value) {
		throw new Error('useHarbor outside HarborProvider');
	}
	return value;
}

export function HarborProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [booting, setBooting] = useState(true);
	const [screen, setScreen] = useState<Screen>('dash');

	const [projects, setProjects] = useState<Project[]>([]);
	const [notes, setNotes] = useState<Note[]>([]);
	const [hobbies, setHobbies] = useState<Hobby[]>([]);
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [prints, setPrints] = useState<MediaItem[]>([]);
	const [copy, setCopy] = useState<SiteCopy>(EMPTY_COPY);
	const [keeper, setKeeper] = useState<KeeperProfile>(EMPTY_KEEPER);
	const [activity, setActivity] = useState<ActivityEntry[]>([]);
	const [designs, setDesigns] = useState<FigureheadDesign[]>([]);
	const [doodles, setDoodles] = useState<Doodle[]>([]);
	const [carvings, setCarvings] = useState<Carving[]>([]);
	const [traffic, setTraffic] = useState<TrafficReport | null>(null);

	const [toast, setToast] = useState<string | null>(null);
	const [confirmKey, setConfirmKey] = useState<string | null>(null);
	const [edit, setEdit] = useState<EditState | null>(null);
	const [peek, setPeek] = useState<PeekState | null>(null);
	const [flareRoll, setFlareRoll] = useState(false);

	const [lantern, setLantern] = useState<LanternStatus | null>(null);
	const [lanternAbsent, setLanternAbsent] = useState(false);
	const [deployPct, setDeployPct] = useState(0);

	const toastTimer = useRef<number>(undefined);
	const confirmTimer = useRef<number>(undefined);
	const confirmAction = useRef<(() => void) | null>(null);
	const copySaveTimer = useRef<number>(undefined);
	const copyEditSeq = useRef(0);
	const keeperSaveTimer = useRef<number>(undefined);
	const copyRef = useRef(copy);
	copyRef.current = copy;
	const keeperRef = useRef(keeper);
	keeperRef.current = keeper;
	const sessionRef = useRef(session);
	sessionRef.current = session;

	const showToast = useCallback((message: string) => {
		window.clearTimeout(toastTimer.current);
		setToast(message);
		toastTimer.current = window.setTimeout(() => setToast(null), TOAST_WINDOW);
	}, []);

	const oops = useCallback((error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);
		showToast(`⚠ ${message}`);
	}, [showToast]);

	// Two-click confirm, straight from the design: first click arms the key,
	// second within the window runs the action.
	const confirmKeyRef = useRef<string | null>(null);
	const askConfirm = useCallback((key: string, doIt: () => void) => {
		window.clearTimeout(confirmTimer.current);
		if (confirmAction.current && key === confirmKeyRef.current) {
			confirmKeyRef.current = null;
			confirmAction.current = null;
			setConfirmKey(null);
			doIt();
			return;
		}
		confirmKeyRef.current = key;
		confirmAction.current = doIt;
		setConfirmKey(key);
		confirmTimer.current = window.setTimeout(() => {
			confirmKeyRef.current = null;
			confirmAction.current = null;
			setConfirmKey(null);
		}, CONFIRM_WINDOW);
	}, []);

	const refreshActivity = useCallback(() => {
		// fetch generously: the dirty counter reads this list, and the API's
		// default window is only the last few entries; the watch room log slices
		// its own display down
		api.listActivity(100).then(setActivity).catch(() => { /* the log is decoration; stay quiet */ });
	}, []);

	const refreshLantern = useCallback(() => {
		api.lanternStatus()
			.then((status) => { setLantern(status); setLanternAbsent(false); })
			.catch((error) => {
				if (error instanceof api.ApiError && error.status === 404) {
					setLanternAbsent(true);
				}
			});
	}, []);

	const loadAll = useCallback((userID: string) => {
		api.projects.list().then((list) => setProjects([...list].sort(byOrder))).catch(oops);
		api.notes.list().then(setNotes).catch(oops);
		api.hobbies.list().then((list) => setHobbies([...list].sort(byOrder))).catch(oops);
		api.suggestions.list().then((list) => setSuggestions([...list].sort((a, b) => a.order - b.order))).catch(oops);
		api.media.list().then(setPrints).catch(oops);
		api.figurehead.list().then(setDesigns).catch(oops);
		api.doodle.list().then(setDoodles).catch(oops);
		api.carvings.list().then(setCarvings).catch(oops);
		api.getCopy().then((doc) => setCopy(seedCove(doc))).catch(() => setCopy(EMPTY_COPY));
		api.getProfile(userID).then((profile) => setKeeper({ ...EMPTY_KEEPER, ...profile })).catch(() => setKeeper(EMPTY_KEEPER));
		// deploy skew or a quiet sea: a 404/error leaves the report null and the
		// watch room fails soft, so swallow it like the log does
		api.traffic().then(setTraffic).catch(() => { /* stay null; the glass reads quiet */ });
		refreshActivity();
		refreshLantern();
	}, [oops, refreshActivity, refreshLantern]);

	// Boot: revalidate a stowed token before trusting it
	useEffect(() => {
		const stowed = loadSession();
		if (!stowed) {
			setBooting(false);
			return;
		}
		api.setBearer(stowed.token);
		api.validate()
			.then(() => {
				setSession(stowed);
				loadAll(stowed.userID);
			})
			.catch(() => {
				api.setBearer(null);
				localStorage.removeItem(SESSION_KEY);
			})
			.finally(() => setBooting(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const signIn = useCallback(async (userName: string, password: string) => {
		const result = await api.login(userName, password);
		const fresh: Session = { token: result.token, userID: result.userID, userName: result.userName };
		api.setBearer(fresh.token);
		localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
		setSession(fresh);
		setScreen('dash');
		loadAll(fresh.userID);
		showToast('⚓ welcome back, keeper. token stowed.');
	}, [loadAll, showToast]);

	const goAshore = useCallback(() => {
		api.logout().catch(() => { /* the token is dropped either way */ });
		api.setBearer(null);
		localStorage.removeItem(SESSION_KEY);
		setSession(null);
		setScreen('dash');
		setEdit(null);
		setPeek(null);
		setFlareRoll(false);
	}, []);

	const goTo = useCallback((next: Screen) => {
		setScreen(next);
		setConfirmKey(null);
		confirmKeyRef.current = null;
		confirmAction.current = null;
	}, []);

	// ---- edit overlay ----

	const openEdit = useCallback((type: EditType, id: string | null) => {
		const base: EditBase = { id, revisions: [], restoredRev: null, touched: false };
		if (type === 'project') {
			setEdit({ ...base, type, draft: projectDraft(projects.find((p) => p.id === id)) });
		} else if (type === 'note') {
			setEdit({ ...base, type, draft: noteDraft(notes.find((n) => n.id === id)) });
		} else {
			setEdit({ ...base, type, draft: hobbyDraft(hobbies.find((h) => h.id === id)) });
		}

		// earlier printings load alongside; hobbies keep no history
		if (id && type !== 'hobby') {
			const family = type === 'project' ? api.projects : api.notes;
			family.revisions(id, REVISIONS_SHOWN)
				.then((revisions) => setEdit((cur) => (cur && cur.id === id && cur.type === type ? { ...cur, revisions } : cur)))
				.catch(() => { /* no printings, no section */ });
		}
	}, [projects, notes, hobbies]);

	const patchDraft = useCallback((patch: Partial<ProjectDraft & NoteDraft & HobbyDraft>) => {
		setEdit((cur) => (cur ? { ...cur, touched: true, draft: { ...cur.draft, ...patch } } as EditState : cur));
	}, []);

	const patchLight = useCallback((patch: Partial<Light>) => {
		setEdit((cur) => (cur && cur.type === 'project'
			? { ...cur, touched: true, draft: { ...cur.draft, light: { ...cur.draft.light, ...patch } } }
			: cur));
	}, []);

	const loadRevision = useCallback((revision: Revision) => {
		setEdit((cur) => {
			if (!cur) {
				return cur;
			}
			try {
				const snapshot = JSON.parse(revision.snapshot);
				const draft = cur.type === 'project' ? projectDraft(snapshot as Project) : noteDraft(snapshot as Note);
				return { ...cur, draft, restoredRev: revision.id, touched: false } as EditState;
			} catch {
				showToast('⚠ that printing would not open');
				return cur;
			}
		});
		showToast('↺ earlier printing loaded, file it to keep it');
	}, [showToast]);

	const cancelEdit = useCallback(() => setEdit(null), []);

	const replaceProject = useCallback((saved: Project) => {
		setProjects((cur) => [...cur.filter((p) => p.id !== saved.id), saved].sort(byOrder));
	}, []);

	const replaceNote = useCallback((saved: Note) => {
		setNotes((cur) => {
			const at = cur.findIndex((n) => n.id === saved.id);
			return at === -1 ? [saved, ...cur] : cur.map((n) => (n.id === saved.id ? saved : n));
		});
	}, []);

	const replaceHobby = useCallback((saved: Hobby) => {
		setHobbies((cur) => {
			const at = cur.findIndex((h) => h.id === saved.id);
			return (at === -1 ? [...cur, saved] : cur.map((h) => (h.id === saved.id ? saved : h))).sort(byOrder);
		});
	}, []);

	const statusLine = (status: string): string => (status === 'published' ? 'published ●' : 'a draft ○');

	const saveEdit = useCallback(async () => {
		if (!edit) {
			return;
		}
		try {
			if (edit.type === 'project') {
				const d = edit.draft;
				const fields = {
					title: d.title, category: d.category,
					tags: d.tagsText.split(',').map((t) => t.trim()).filter(Boolean),
					shortDesc: d.shortDesc, body: textToHtml(d.bodyText), moral: d.moral,
					images: d.images, light: d.light, firstLit: d.firstLit,
					slug: d.slug, facts: d.facts, caseStudy: d.caseStudy, noteIds: d.noteIds, flagship: d.flagship,
				};
				if (edit.id === null) {
					replaceProject(await api.projects.create({ ...fields, status: 'draft' }));
					showToast('🕯 a light was kindled, into the rack');
				} else if (edit.restoredRev) {
					let saved = await api.projects.restore(edit.id, edit.restoredRev);
					if (edit.touched) {
						saved = await api.projects.update(edit.id, { ...saved, ...fields });
					}
					replaceProject(saved);
					showToast(`↺ earlier printing filed, it's now ${statusLine(saved.status)}`);
				} else {
					const current = projects.find((p) => p.id === edit.id);
					if (!current) {
						return;
					}
					// PUT is full-replace: postcardTo/From/postmarked/stamp/image are
					// dormant, no longer edited here, so they ride through from the
					// fetched document. Without this spread the first edit on any
					// light would wipe them for good.
					replaceProject(await api.projects.update(edit.id, { ...current, ...fields }));
					showToast('🕯 the light was filed');
				}
			} else if (edit.type === 'note') {
				const d = edit.draft;
				const fields = {
					title: d.title, date: d.date, teaser: d.teaser, body: textToHtml(d.bodyText),
					conditions: d.conditions, doodleId: d.doodleId, doodleCaption: d.doodleCaption,
				};
				if (edit.id === null) {
					replaceNote(await api.notes.create({ ...fields, status: 'draft' }));
					showToast('✎ filed at the writing desk');
				} else if (edit.restoredRev) {
					let saved = await api.notes.restore(edit.id, edit.restoredRev);
					if (edit.touched) {
						saved = await api.notes.update(edit.id, { ...saved, ...fields });
					}
					replaceNote(saved);
					showToast(`↺ earlier printing filed, it's now ${statusLine(saved.status)}`);
				} else {
					const current = notes.find((n) => n.id === edit.id);
					if (!current) {
						return;
					}
					replaceNote(await api.notes.update(edit.id, { ...current, ...fields }));
					showToast('✎ filed at the writing desk');
				}
			} else {
				const d = edit.draft;
				// blank both = null (no wake); one filled = a half-charted mark the
				// wire won't take, so bounce it here rather than zero-fill it
				const coord = parseCoord(d.coordLat, d.coordLon);
				const from = parseCoord(d.fromLat, d.fromLon);
				if (coord === 'half' || from === 'half') {
					showToast('⚠ a mark needs both bearings, or neither');
					return;
				}
				const fields = {
					name: d.name, service: d.service, state: d.state, coord, from,
					seasons: d.seasons, bearing: d.bearing, lastLog: d.lastLog,
					floats: d.floats, offCourse: d.offCourse, odds: d.odds,
				};
				if (edit.id === null) {
					replaceHobby(await api.hobbies.create(fields));
					showToast('✳ a new mark on the chart');
				} else {
					const current = hobbies.find((h) => h.id === edit.id);
					if (!current) {
						return;
					}
					replaceHobby(await api.hobbies.update(edit.id, { ...current, ...fields }));
					showToast('✳ position updated');
				}
			}
			setEdit(null);
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [edit, projects, notes, hobbies, replaceProject, replaceNote, replaceHobby, showToast, oops, refreshActivity]);

	// ---- rack / desk / chart actions ----

	const toggleProjectStatus = useCallback(async (p: Project) => {
		try {
			const saved = p.status === 'published' ? await api.projects.unpublish(p.id) : await api.projects.publish(p.id);
			replaceProject(saved);
			showToast(p.status === 'published' ? '○ pulled back into the rack' : '● stamped and published');
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [replaceProject, showToast, oops, refreshActivity]);

	const toggleNoteStatus = useCallback(async (n: Note) => {
		try {
			const saved = n.status === 'published' ? await api.notes.unpublish(n.id) : await api.notes.publish(n.id);
			replaceNote(saved);
			showToast(n.status === 'published' ? '○ back to the desk drawer' : '● posted. no promises broken yet.');
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [replaceNote, showToast, oops, refreshActivity]);

	const toggleFeatured = useCallback(async (p: Project) => {
		// the cap is the admin's rule, not the server's; enforce before the call
		if (!p.featured && projects.filter((x) => x.featured).length >= 3) {
			showToast('the window only fits three, take one down first');
			return;
		}
		try {
			replaceProject(await api.featureProject(p.id, !p.featured));
			showToast(p.featured ? '☆ taken out of the window' : '★ set in the front window');
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [projects, replaceProject, showToast, oops, refreshActivity]);

	// no cap, no server rule: exactly one flagship is a site-side convention
	// the admin only hints at, per the pinned contract
	const toggleFlagship = useCallback(async (p: Project) => {
		try {
			replaceProject(await api.projects.update(p.id, { ...p, flagship: !p.flagship }));
			showToast(p.flagship ? '⚐ flagship struck' : '⚑ flagship run up the mast');
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [replaceProject, showToast, oops, refreshActivity]);

	const moveProject = useCallback(async (p: Project, dir: -1 | 1) => {
		const rack = [...projects].sort(byOrder);
		const at = rack.findIndex((x) => x.id === p.id);
		const neighbor = rack[at + dir];
		if (!neighbor) {
			return;
		}
		try {
			// swap = two set-order calls; each response is the fresh document
			const [movedSaved, neighborSaved] = await Promise.all([
				api.reorderProject(p.id, neighbor.order),
				api.reorderProject(neighbor.id, p.order),
			]);
			setProjects((cur) => cur
				.map((x) => (x.id === movedSaved.id ? movedSaved : x.id === neighborSaved.id ? neighborSaved : x))
				.sort(byOrder));
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [projects, oops, refreshActivity]);

	const arrangeProjects = useCallback(async (placements: { id: string; x: number; y: number; rotation: number }[]) => {
		try {
			const list = await api.arrangeProjects(placements);
			setProjects([...list].sort(byOrder));
			refreshActivity();
			showToast('📌 the coast was pinned');
		} catch (error) {
			oops(error);
		}
	}, [showToast, oops, refreshActivity]);

	const strikeProject = useCallback(async (p: Project) => {
		try {
			await api.projects.remove(p.id);
			setProjects((cur) => cur.filter((x) => x.id !== p.id));
			showToast('🌫 struck from the chart. the fog closes over it.');
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [showToast, oops, refreshActivity]);

	const burnNote = useCallback(async (n: Note) => {
		try {
			await api.notes.remove(n.id);
			setNotes((cur) => cur.filter((x) => x.id !== n.id));
			showToast('🕯 burned. it never happened.');
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [showToast, oops, refreshActivity]);

	// the writing desk's half of the note↔light tie: ties key by stable ids
	// (ruling 6), so the toggle writes the OTHER document, the project's
	// noteIds, immediately, rather than riding the note's own draft save
	const toggleNoteTie = useCallback(async (p: Project, noteId: string) => {
		const tied = (p.noteIds ?? []).includes(noteId);
		const noteIds = tied ? (p.noteIds ?? []).filter((id) => id !== noteId) : [...(p.noteIds ?? []), noteId];
		try {
			replaceProject(await api.projects.update(p.id, { ...p, noteIds }));
		} catch (error) {
			oops(error);
		}
	}, [replaceProject, oops]);

	const moveHobby = useCallback(async (h: Hobby, dir: -1 | 1) => {
		// reorder stays inside the hobby's own group (on watch vs off the fairway)
		const group = hobbies.filter((x) => onWatch(x) === onWatch(h)).sort(byOrder);
		const at = group.findIndex((x) => x.id === h.id);
		const neighbor = group[at + dir];
		if (!neighbor) {
			return;
		}
		try {
			// hobbies snapshot nothing; full-replace PUTs with swapped orders.
			// equal orders (degenerate all-zero data) would make the swap a
			// no-op, so nudge the pair apart by 1 in the move direction instead.
			const [movedOrder, neighborOrder] = h.order === neighbor.order
				? dir === 1 ? [h.order + 1, neighbor.order] : [h.order, neighbor.order + 1]
				: [neighbor.order, h.order];
			const [movedSaved, neighborSaved] = await Promise.all([
				api.hobbies.update(h.id, { ...h, order: movedOrder }),
				api.hobbies.update(neighbor.id, { ...neighbor, order: neighborOrder }),
			]);
			setHobbies((cur) => cur
				.map((x) => (x.id === movedSaved.id ? movedSaved : x.id === neighborSaved.id ? neighborSaved : x))
				.sort(byOrder));
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [hobbies, oops, refreshActivity]);

	// the chart-list toggle: an on-watch hobby is logged adrift, an off-fairway
	// one is brought back into port. Both flip `state` through a full-replace PUT.
	const setAdriftOrPort = useCallback(async (h: Hobby) => {
		try {
			const goAdrift = onWatch(h);
			const doc: Hobby = { ...h, state: goAdrift ? 'adrift' : 'port' };
			replaceHobby(await api.hobbies.update(h.id, doc));
			showToast(goAdrift ? '≈ logged adrift. still afloat.' : '⚓ brought into port');
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [replaceHobby, showToast, oops, refreshActivity]);

	const addSuggestion = useCallback(async (value: string) => {
		const trimmed = value.trim();
		if (!trimmed) {
			return;
		}
		try {
			const saved = await api.suggestions.add(trimmed.endsWith('?') ? trimmed : `${trimmed}?`);
			setSuggestions((cur) => [...cur, saved]);
			showToast('the pool deepens');
		} catch (error) {
			oops(error);
		}
	}, [showToast, oops]);

	const removeSuggestion = useCallback(async (s: Suggestion) => {
		try {
			await api.suggestions.remove(s.id);
			setSuggestions((cur) => cur.filter((x) => x.id !== s.id));
			showToast('fate un-tempted');
		} catch (error) {
			oops(error);
		}
	}, [showToast, oops]);

	// ---- signal flags, the cove & the keeper, saved as you type (debounced) ----

	// every copy mutation rides the same debounced full-replace PUT: one save
	// path for the flag locker and the smuggler's cove alike. The echo goes
	// through seedCove like the GET does: an API from before the cove echoes
	// null/absent egg fields, and adopting those raw would sink the screen.
	const queueCopySave = useCallback(() => {
		copyEditSeq.current += 1;
		window.clearTimeout(copySaveTimer.current);
		copySaveTimer.current = window.setTimeout(() => {
			// only adopt the echo if nothing was typed since this PUT went out;
			// otherwise a slow response lands on top of newer keystrokes and
			// reverts them (the follow-up save they queued still carries them to
			// the wire). Legacy-null docs still get seeded: their echo lands with
			// no edit behind it.
			const dispatchedAt = copyEditSeq.current;
			api.putCopy(copyRef.current).then((doc) => {
				if (copyEditSeq.current === dispatchedAt) {
					setCopy(seedCove(doc));
				}
				refreshActivity();
			}).catch(oops);
		}, AUTOSAVE_DELAY);
	}, [oops, refreshActivity]);

	const setCopyField = useCallback((key: CopyTextField, value: string) => {
		setCopy((cur) => ({ ...cur, [key]: value }));
		queueCopySave();
	}, [queueCopySave]);

	// the ghost placard rides the same copy autosave; the wall tab drives this
	// straight from "pin it" rather than typing, but it's the same debounced
	// full-replace PUT as every other copy field
	const setWallGhost = useCallback((ghost: SiteCopy['wallGhost']) => {
		setCopy((cur) => ({ ...cur, wallGhost: ghost }));
		queueCopySave();
	}, [queueCopySave]);

	const toggleEgg = useCallback((key: keyof EggFlags) => {
		const on = !copyRef.current.eggs[key];
		setCopy((cur) => ({ ...cur, eggs: { ...cur.eggs, [key]: on } }));
		queueCopySave();
		const def = EGG_DEFS.find((e) => e.key === key)!;
		showToast(on ? `✧ ${def.name}, loose on the site.` : `· ${def.name}, stowed away.`);
	}, [queueCopySave, showToast]);

	// Absent = on: a page/spot missing from the map reads enabled, so a flip off
	// the seeded state writes the explicit value the first autosave persists.
	const toggleCatPage = useCallback((pageId: string) => {
		const on = !(copyRef.current.catPages[pageId] ?? true);
		setCopy((cur) => ({ ...cur, catPages: { ...cur.catPages, [pageId]: on } }));
		queueCopySave();
		const page = CAT_CATALOG.find((pg) => pg.id === pageId)!;
		showToast(on ? `🐱 the cat prowls ${page.label} again.` : `🐱 kept off ${page.label} entirely.`);
	}, [queueCopySave, showToast]);

	const toggleCatSpot = useCallback((spotId: string) => {
		const on = !(copyRef.current.catSpots[spotId] ?? true);
		setCopy((cur) => ({ ...cur, catSpots: { ...cur.catSpots, [spotId]: on } }));
		queueCopySave();
		const spot = CAT_CATALOG.flatMap((pg) => pg.spots).find((sp) => sp.id === spotId)!;
		showToast(on ? `🐱 the cat perches on ${spot.label.toLowerCase()} again.` : `🐱 kept off ${spot.label.toLowerCase()}.`);
	}, [queueCopySave, showToast]);

	const setProverb = useCallback((idx: number, value: string) => {
		setCopy((cur) => ({ ...cur, bottleProverbs: cur.bottleProverbs.map((p, i) => (i === idx ? value : p)) }));
		queueCopySave();
	}, [queueCopySave]);

	const addProverb = useCallback(() => {
		setCopy((cur) => ({ ...cur, bottleProverbs: [...cur.bottleProverbs, ''] }));
		queueCopySave();
	}, [queueCopySave]);

	const removeProverb = useCallback((idx: number) => {
		setCopy((cur) => ({ ...cur, bottleProverbs: cur.bottleProverbs.filter((_, i) => i !== idx) }));
		queueCopySave();
	}, [queueCopySave]);

	const setLight = useCallback((idx: number, patch: Partial<Lighthouse>) => {
		setCopy((cur) => ({ ...cur, lighthouses: cur.lighthouses.map((lh, i) => (i === idx ? { ...lh, ...patch } : lh)) }));
		queueCopySave();
	}, [queueCopySave]);

	const addLight = useCallback(() => {
		setCopy((cur) => ({ ...cur, lighthouses: [...cur.lighthouses, { name: '', pos: '', line: '' }] }));
		queueCopySave();
	}, [queueCopySave]);

	const removeLight = useCallback((idx: number) => {
		setCopy((cur) => ({ ...cur, lighthouses: cur.lighthouses.filter((_, i) => i !== idx) }));
		queueCopySave();
	}, [queueCopySave]);

	const setKeeperField = useCallback((key: keyof KeeperProfile, value: string) => {
		setKeeper((cur) => ({ ...cur, [key]: value }));
		window.clearTimeout(keeperSaveTimer.current);
		keeperSaveTimer.current = window.setTimeout(() => {
			const holder = sessionRef.current;
			if (holder) {
				api.saveProfile(holder.userID, keeperRef.current).catch(oops);
			}
		}, AUTOSAVE_DELAY);
	}, [oops]);

	// ---- the figurehead shop ----

	const replaceDesign = useCallback((saved: FigureheadDesign) => {
		setDesigns((cur) => {
			const at = cur.findIndex((d) => d.id === saved.id);
			return at === -1 ? [...cur, saved] : cur.map((d) => (d.id === saved.id ? saved : d));
		});
	}, []);

	// Explicit save: designs are documents, they never ride the copy autosave.
	// A null id POSTs a fresh draft; otherwise a full-replace PUT (the server
	// preserves pose/published/seed). Returns the saved doc so the editor can
	// adopt the new id, or null when the harbor swallowed an error.
	const saveDesign = useCallback(async (id: string | null, fields: DesignFields): Promise<FigureheadDesign | null> => {
		try {
			let saved: FigureheadDesign;
			if (id) {
				const current = designs.find((d) => d.id === id);
				if (!current) {
					return null;
				}
				saved = await api.figurehead.update(id, { ...current, ...fields });
				showToast('♆ design saved to the shelf');
			} else {
				saved = await api.figurehead.create(fields);
				showToast('♆ a fresh draft joins the shelf');
			}
			replaceDesign(saved);
			refreshActivity();
			return saved;
		} catch (error) {
			oops(error);
			return null;
		}
	}, [designs, replaceDesign, showToast, oops, refreshActivity]);

	const renameDesign = useCallback(async (d: FigureheadDesign, label: string) => {
		const trimmed = label.trim();
		if (!trimmed || trimmed === d.label) {
			return;
		}
		try {
			replaceDesign(await api.figurehead.update(d.id, { ...d, label: trimmed }));
			showToast('⚒ relabeled and hung back up');
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [replaceDesign, showToast, oops, refreshActivity]);

	const deleteDesign = useCallback(async (d: FigureheadDesign) => {
		// the API's 409 guards, honored before the wire: seeds are carved for
		// good, and the published design leads its pose until superseded
		if (d.seed || d.published) {
			showToast(d.seed ? '⚠ v1 is carved, it stays' : '⚠ publish another first, the bow needs a cat');
			return;
		}
		try {
			await api.figurehead.remove(d.id);
			setDesigns((cur) => cur.filter((x) => x.id !== d.id));
			showToast('🪓 scrapped. sawdust and all.');
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [showToast, oops, refreshActivity]);

	const publishDesign = useCallback(async (d: FigureheadDesign) => {
		try {
			const saved = await api.figurehead.publish(d.id);
			// the swap is atomic within the pose; mirror it locally
			setDesigns((cur) => cur.map((x) =>
				x.id === saved.id ? saved : x.pose === saved.pose ? { ...x, published: false } : x));
			showToast(`♆ ${saved.label} leads the ${saved.pose} pose on next hoist`);
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [showToast, oops, refreshActivity]);

	// ---- marginalia (doodles) ----

	const replaceDoodle = useCallback((saved: Doodle) => {
		setDoodles((cur) => {
			const at = cur.findIndex((d) => d.id === saved.id);
			return at === -1 ? [...cur, saved] : cur.map((d) => (d.id === saved.id ? saved : d));
		});
	}, []);

	// Explicit save: doodles are documents, they never ride the copy
	// autosave. A null id POSTs a fresh doodle; otherwise a full-replace PUT.
	// Returns the saved doc so the editor can adopt the new id, or null when
	// the harbor swallowed an error.
	const saveDoodle = useCallback(async (id: string | null, fields: DoodleFields): Promise<Doodle | null> => {
		try {
			let saved: Doodle;
			if (id) {
				const current = doodles.find((d) => d.id === id);
				if (!current) {
					return null;
				}
				saved = await api.doodle.update(id, { ...current, ...fields });
				showToast('✎ doodle saved to the desk');
			} else {
				saved = await api.doodle.create(fields);
				showToast('✎ a fresh sketch joins the desk');
			}
			replaceDoodle(saved);
			refreshActivity();
			return saved;
		} catch (error) {
			oops(error);
			return null;
		}
	}, [doodles, replaceDoodle, showToast, oops, refreshActivity]);

	const renameDoodle = useCallback(async (d: Doodle, name: string) => {
		const trimmed = name.trim();
		if (!trimmed || trimmed === d.name) {
			return;
		}
		try {
			replaceDoodle(await api.doodle.update(d.id, { ...d, name: trimmed }));
			showToast('⚒ renamed and set back down');
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [replaceDoodle, showToast, oops, refreshActivity]);

	const deleteDoodle = useCallback(async (d: Doodle) => {
		try {
			await api.doodle.remove(d.id);
			setDoodles((cur) => cur.filter((x) => x.id !== d.id));
			showToast('🪓 torn out and binned');
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [showToast, oops, refreshActivity]);

	// ---- the carving shop ----

	const replaceCarving = useCallback((saved: Carving) => {
		setCarvings((cur) => {
			const at = cur.findIndex((c) => c.id === saved.id);
			return at === -1 ? [...cur, saved] : cur.map((c) => (c.id === saved.id ? saved : c));
		});
	}, []);

	// Explicit save, like the shop's designs and marginalia's doodles: carvings
	// are documents, they never ride the copy autosave. A null id POSTs a
	// fresh block; otherwise a full-replace PUT (a builtin's name/svg are
	// frozen server-side regardless of what rides along).
	const saveCarving = useCallback(async (id: string | null, fields: { name: string; svg: string }): Promise<Carving | null> => {
		try {
			let saved: Carving;
			if (id) {
				const current = carvings.find((c) => c.id === id);
				if (!current) {
					return null;
				}
				// the API's 409 guard, honored before the wire: a bolted carving
				// is live markup on the site, blanking it would ship a hole
				if (current.boltedTo.length && !fields.svg.trim()) {
					showToast('⚠ a bolted carving cannot go blank, unbolt the spot first');
					return null;
				}
				saved = await api.carvings.update(id, { ...current, ...fields });
				showToast('⚒ carving saved to the bench');
			} else {
				saved = await api.carvings.create(fields);
				showToast('⚒ a fresh block joins the catalog');
			}
			replaceCarving(saved);
			refreshActivity();
			return saved;
		} catch (error) {
			oops(error);
			return null;
		}
	}, [carvings, replaceCarving, showToast, oops, refreshActivity]);

	// Bolting is its own action, mirroring the figurehead publish pattern: the
	// API auto-swaps (strips the spot from its previous holder) in the same
	// write, so mirror that locally rather than waiting on a second round trip.
	const boltCarving = useCallback(async (c: Carving, spot: string) => {
		if (!c.svg.trim()) {
			showToast('⚠ an empty block has nothing to bolt');
			return;
		}
		if (c.boltedTo.includes(spot)) {
			const label = CARVING_CATALOG.find((entry) => entry.id === spot)?.name ?? spot;
			showToast(`⚒ "${c.name}" already holds ${label.toLowerCase()}. the bolt is tight.`);
			return;
		}
		try {
			const saved = await api.carvings.bolt(c.id, spot);
			setCarvings((cur) => cur.map((x) =>
				x.id === saved.id ? saved : { ...x, boltedTo: x.boltedTo.filter((s) => s !== spot) }));
			const label = CARVING_CATALOG.find((entry) => entry.id === spot)?.name ?? spot;
			showToast(`⚒ "${saved.name}" bolted to ${label.toLowerCase()}. ships with the next hoist.`);
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [showToast, oops, refreshActivity]);

	// ---- the darkroom ----

	// notes carry a doodle now, not a photo print; only projects still count.
	// A print counts once per project even if it leads AND rides the gallery.
	const printUsage = useCallback((filename: string): number =>
		projects.filter((p) => p.image === filename || (p.images ?? []).includes(filename)).length,
	[projects]);

	const developPrints = useCallback(async (files: Iterable<File>) => {
		const images = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp)$/i.test(f.name));
		if (!images.length) {
			showToast('the darkroom only develops images');
			return;
		}
		// settle each upload on its own; one bad file must not drop the
		// prints that developed fine
		const settled = await Promise.allSettled(images.map((f) => api.media.upload(f)));
		const developed = settled
			.filter((r): r is PromiseFulfilledResult<MediaItem> => r.status === 'fulfilled')
			.map((r) => r.value);
		const failed = settled.length - developed.length;
		if (developed.length) {
			setPrints((cur) => [...developed, ...cur]);
			refreshActivity();
		}
		if (failed) {
			showToast(`⚠ ${failed} print${failed === 1 ? '' : 's'} would not develop`);
		} else {
			showToast(developed.length === 1 ? '🖼 developed. hang it to dry.' : `🖼 ${developed.length} prints developed`);
		}
	}, [showToast, refreshActivity]);

	const tearOffPrint = useCallback(async (m: MediaItem) => {
		try {
			// deleting the file does NOT touch referencing documents (pinned
			// contract), detaching is this client's job, via full-replace PUTs.
			// Notes carry a doodle now, not a photo print, so only projects can
			// reference one, either as the lead image or loose in the gallery.
			const usedProjects = projects.filter((p) => p.image === m.filename || (p.images ?? []).includes(m.filename));
			const savedProjects = await Promise.all(usedProjects.map((p) => api.projects.update(p.id, {
				...p,
				image: p.image === m.filename ? null : p.image,
				images: (p.images ?? []).filter((name) => name !== m.filename),
			})));
			savedProjects.forEach(replaceProject);
			await api.media.remove(m.id);
			setPrints((cur) => cur.filter((x) => x.id !== m.id));
			showToast(usedProjects.length
				? 'print torn off its lights and left in the sun'
				: 'print left out in the sun');
			refreshActivity();
		} catch (error) {
			oops(error);
		}
	}, [projects, replaceProject, showToast, oops, refreshActivity]);

	// ---- the lantern ----

	const deploying = lantern !== null && (lantern.state === 'building' || lantern.state === 'swapping');

	// While the boat is out: poll the real status, and let the boat creep on a
	// theater percentage (the API reports states, not progress)
	const wasDeploying = useRef(false);
	useEffect(() => {
		if (!deploying) {
			if (wasDeploying.current && lantern) {
				setDeployPct(0);
				if (lantern.state === 'succeeded') {
					showToast('☀ hoisted. the site is live with the new copy.');
					refreshActivity();
				} else if (lantern.state === 'failed') {
					showToast('⚠ the hoist failed, the old lights stay on');
				}
			}
			wasDeploying.current = false;
			return;
		}
		wasDeploying.current = true;
		const poll = window.setInterval(refreshLantern, 1500);
		const creep = window.setInterval(() => {
			setDeployPct((pct) => Math.min(96, pct + 1.6 + Math.random() * 1.8));
		}, 300);
		return () => {
			window.clearInterval(poll);
			window.clearInterval(creep);
		};
	}, [deploying, lantern, refreshLantern, showToast, refreshActivity]);

	const hoistLantern = useCallback(async () => {
		if (deploying) {
			return;
		}
		try {
			const result = await api.hoist();
			setLantern(result.status);
			setDeployPct(0);
			if (!result.accepted) {
				showToast('the boat is already out, one hoist at a time');
			}
		} catch (error) {
			oops(error);
		}
	}, [deploying, showToast, oops]);

	const rollbackLantern = useCallback(async () => {
		try {
			const result = await api.lanternRollback();
			setLantern(result.status);
			if (result.ok) {
				showToast('↩ previous lantern re-hoisted. the old lights are back on.');
				refreshActivity();
			} else if (result.status.state === 'building' || result.status.state === 'swapping') {
				showToast('the boat is out, wait for it to dock first');
			} else {
				showToast('⚓ no previous lantern to re-hoist');
			}
		} catch (error) {
			oops(error);
		}
	}, [showToast, oops, refreshActivity]);

	// changes in the tower since the last hoist: activity newer than lastHoistedAt,
	// lantern's own entries excluded
	const dirtyCount = useMemo(() => {
		const since = lantern?.lastHoistedAt ?? '';
		return activity.filter((entry) => entry.entityType !== 'lantern' && entry.timestamp > since).length;
	}, [activity, lantern]);

	const keeperName = keeper.name.trim() || session?.userName || 'keeper';

	const openPeek = useCallback((type: PeekState['type'], id: string) => setPeek({ type, id }), []);
	const closePeek = useCallback(() => setPeek(null), []);

	const openFlareRoll = useCallback(() => setFlareRoll(true), []);
	const closeFlareRoll = useCallback(() => setFlareRoll(false), []);

	const value: HarborValue = {
		session, booting, screen, goTo, signIn, goAshore,
		projects, notes, hobbies, suggestions, prints, copy, keeper, activity, designs, doodles, carvings, traffic,
		keeperName, dirtyCount,
		toast, showToast, confirmKey, askConfirm,
		edit, openEdit, patchDraft, patchLight, loadRevision, saveEdit, cancelEdit,
		peek, openPeek, closePeek,
		flareRoll, openFlareRoll, closeFlareRoll,
		toggleProjectStatus, toggleNoteStatus, toggleFeatured, toggleFlagship, moveProject, arrangeProjects, strikeProject, burnNote,
		toggleNoteTie,
		moveHobby, setAdriftOrPort, addSuggestion, removeSuggestion,
		setCopyField, setKeeperField, setWallGhost,
		toggleEgg, toggleCatPage, toggleCatSpot, setProverb, addProverb, removeProverb, setLight, addLight, removeLight,
		saveDesign, renameDesign, deleteDesign, publishDesign,
		saveDoodle, renameDoodle, deleteDoodle,
		saveCarving, boltCarving,
		printUsage, developPrints, tearOffPrint,
		lantern, lanternAbsent, deploying, deployPct, hoistLantern, rollbackLantern,
	};

	return <HarborContext.Provider value={value}>{children}</HarborContext.Provider>;
}
