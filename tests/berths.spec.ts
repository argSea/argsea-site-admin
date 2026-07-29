import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { signIn, nav, toast } from './office';
import { MockApi } from './mock-api';
import { dragFromShelf, dragMark, mark, markPercent, openChartTable, proj } from './chart-window';

// The chart berth on the three chartables: coord decides chart presence, plate
// picks which of the entry's own prints leads, cap is the line under it. The
// wire contract is caravan's 2026-07-28 chart-berths document; the admin's one
// home for all of it is the chart table, so every assertion here reads a
// recorded body, since the berth's whole job is what rides the PUT.

const hobbyRow = (page: Page, name: string) =>
	page.locator('.content-row').filter({ has: page.getByText(name, { exact: true }) });

const sheet = (page: Page) => page.locator('[data-sheet]');

test('the chart table lays all three chartables on one window, the uncharted on the shelf', async ({ page }) => {
	await signIn(page);
	await openChartTable(page);

	// p2 (a light), h1-h4 (hobbies) and n1 (a note) carry berths
	await expect(mark(page, 'project:p2')).toBeVisible();
	await expect(mark(page, 'hobby:h1')).toBeVisible();
	await expect(mark(page, 'note:n1')).toBeVisible();
	await expect(page.locator('.chart-mark')).toHaveCount(6);

	// the light sits exactly where the public Helm would draw it
	const want = proj({ lat: 58.10, lon: -7.30 });
	const got = await markPercent(page, 'project:p2');
	expect(got.x).toBeCloseTo(want.x, 0);
	expect(got.y).toBeCloseTo(want.y, 0);

	// p1, p3, p4, h5 and n2 predate the berth or lost it in the migration
	await expect(page.locator('[data-shelf-chip]')).toHaveCount(5);
});

test('the edit overlay no longer carries a berth section on any of the three', async ({ page }) => {
	await signIn(page);
	const overlay = page.locator('.overlay-card');
	const gone = [
		'chart berth · where it lies on the Helm',
		'charted position · latitude',
		'plate · which photo-plate',
		'caption · the line under the plate',
		'slipped from · where the drift began',
	];

	await nav(page, 'the light list').click();
	await page.locator('.content-row', { hasText: 'Meo Wave Race' }).getByText('edit', { exact: true }).click();
	for (const label of gone) {
		await expect(overlay.getByText(label)).toHaveCount(0);
	}
	await overlay.getByText('never mind').click();

	await nav(page, 'writing desk').click();
	await page.locator('.note-row', { hasText: 'The queue is the product' }).getByText('edit', { exact: true }).click();
	for (const label of gone) {
		await expect(overlay.getByText(label)).toHaveCount(0);
	}
	await overlay.getByText('never mind').click();

	await nav(page, 'the wandering chart').click();
	await hobbyRow(page, 'Piano').getByText('edit', { exact: true }).click();
	for (const label of gone) {
		await expect(overlay.getByText(label)).toHaveCount(0);
	}
});

test('an editor save leaves the placement and the caption as the chart table left them', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	await page.locator('.content-row', { hasText: 'Meo Wave Race' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('moral of the story').fill('Moral: still the boat.');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p2$/);
	expect(put.body.coord).toEqual({ lat: 58.10, lon: -7.30 });
	expect(put.body.cap).toBe('A cat, mid-race.');
	// the plate is the one berth field a save can correct: p2 is seeded leading
	// with plate 3 over an empty archive, and the clamp walks it back
	expect(put.body.plate).toBe(0);
});

test('the sheet picks the leading print and writes the caption, and both ride the pin', async ({ page }) => {
	const mock = await signIn(page);
	await openChartTable(page);

	// Piano hangs two prints and leads with the first
	await mark(page, 'hobby:h3').locator('.chart-mark__glyph').click();
	await expect(sheet(page).locator('[data-plate]')).toHaveCount(2);
	await expect(sheet(page).locator('[data-plate="0"]')).toHaveClass(/chart-plate--leading/);

	await sheet(page).locator('[data-plate="1"]').click();
	await expect(sheet(page).locator('[data-plate="1"]')).toHaveClass(/chart-plate--leading/);
	await sheet(page).getByLabel('caption · the line under the plate').fill('  The second night.  ');

	// nothing saves until the pin
	expect(mock.find('PUT', /^\/1\/hobby\//)).toHaveLength(0);
	await page.getByRole('button', { name: 'pin the chart' }).click();
	await expect(toast(page)).toHaveText('⚓ pinned. 1 berths updated.');

	const [put] = mock.find('PUT', /^\/1\/hobby\/h3$/);
	expect(put.body.plate).toBe(1);
	// the server stores the caption verbatim, so the trim is ours to do
	expect(put.body.cap).toBe('The second night.');
	expect(put.body.coord).toEqual({ lat: 58.42, lon: -7.12 });
});

test('the sheet picks from what is hung and hangs nothing: no kind gets a darkroom here', async ({ page }) => {
	await signIn(page);
	await openChartTable(page);

	await mark(page, 'hobby:h3').locator('.chart-mark__glyph').click();
	await expect(sheet(page).locator('[data-plate]')).toHaveCount(2);
	await expect(sheet(page).locator('[data-print]')).toHaveCount(0);

	// an empty gallery sends the keeper to the hobby's own editor, not below
	await mark(page, 'hobby:h1').locator('.chart-mark__glyph').click();
	await expect(sheet(page).getByText('// nothing hung on this mark · hang prints in the wandering chart')).toBeVisible();
	await expect(sheet(page).locator('[data-print]')).toHaveCount(0);
});

test('a note keeps its doodle: its sheet offers no plate to pick', async ({ page }) => {
	await signIn(page);
	await openChartTable(page);

	await mark(page, 'note:n1').locator('.chart-mark__glyph').click();
	await expect(sheet(page).getByText("// a note's sheet shows its doodle · there is no plate to pick here")).toBeVisible();
	await expect(sheet(page).locator('[data-plate]')).toHaveCount(0);
	await expect(sheet(page).getByLabel('caption · the line under the plate')).toHaveValue('The queue, at rest.');
});

test('charting a light and a note from the shelf writes each through its own endpoint', async ({ page }) => {
	const mock = await signIn(page);
	await openChartTable(page);

	await dragFromShelf(page, 'project:p3', { x: 25, y: 30 });
	await dragFromShelf(page, 'note:n2', { x: 70, y: 65 });

	await page.getByRole('button', { name: 'pin the chart' }).click();
	await expect(toast(page)).toHaveText('⚓ pinned. 2 berths updated.');

	const [light] = mock.find('PUT', /^\/1\/project\/p3$/);
	expect(proj(light.body.coord).x).toBeCloseTo(25, 1);
	expect(proj(light.body.coord).y).toBeCloseTo(30, 1);

	const [note] = mock.find('PUT', /^\/1\/note\/n2$/);
	expect(proj(note.body.coord).x).toBeCloseTo(70, 1);
	expect(proj(note.body.coord).y).toBeCloseTo(65, 1);
});

test('a mark dragged off the waters comes off the chart, dressing intact', async ({ page }) => {
	const mock = await signIn(page);
	await openChartTable(page);

	const shelf = await page.locator('[data-shelf]').boundingBox();
	if (!shelf) {
		throw new Error('missing bounding box');
	}
	await dragMark(page, 'project:p2', { at: { x: shelf.x + shelf.width / 2, y: shelf.y + shelf.height / 2 } });

	await expect(mark(page, 'project:p2')).toHaveCount(0);
	await expect(page.locator('[data-shelf-chip][data-key="project:p2"]')).toBeVisible();

	await page.getByRole('button', { name: 'pin the chart' }).click();
	await expect(toast(page)).toHaveText('⚓ pinned. 1 berths updated.');

	// off the chart, still dressed: the plate and the caption outlive the coord
	const [put] = mock.find('PUT', /^\/1\/project\/p2$/);
	expect(put.body.coord).toBeNull();
	expect(put.body.plate).toBe(3);
	expect(put.body.cap).toBe('A cat, mid-race.');
});

test('the shelf holds a hundred mixed entries: it scrolls, and one drags out onto the waters and back off again', async ({ page }) => {
	const mock = new MockApi();
	// ~100 uncharted entries across all three kinds, on top of the seeded five
	for (let i = 0; i < 32; i++) {
		mock.projects.push({
			id: `bp${i}`, title: `Bulk light ${i}`, category: 'backend', tags: [], shortDesc: '', body: '',
			moral: '', postcardTo: '', postcardFrom: '', postmarked: '', slug: `bulk-light-${i}`, image: null,
			light: { kind: 'fixed', color: 'white', period: 0, letter: '', extinguished: '' },
			images: [], firstLit: '', facts: [], caseStudy: '', noteIds: [], flagship: false,
			coord: null, plate: 0, cap: '',
			order: 100 + i, featured: false, status: 'draft',
			publishedAt: '', createdAt: '2026-05-01T12:00:00Z', updatedAt: '2026-05-01T12:00:00Z',
		});
		mock.hobbies.push({
			id: `bh${i}`, name: `Bulk hobby ${i}`, service: '', state: 'adrift', coord: null, from: null,
			images: null, seasons: '', bearing: '', lastLog: '', floats: '', offCourse: '', odds: '',
			order: 100 + i, createdAt: '2026-05-01T12:00:00Z', updatedAt: '2026-05-01T12:00:00Z',
		});
		mock.notes.push({
			id: `bn${i}`, title: `Bulk note ${i}`, teaser: '', body: '', date: '', conditions: '',
			doodleId: null, doodleCaption: '', coord: null, plate: 0, cap: '', status: 'draft',
			publishedAt: '', createdAt: '2026-05-01T12:00:00Z', updatedAt: '2026-05-01T12:00:00Z',
		});
	}
	await signIn(page, mock);
	await openChartTable(page);

	// 96 bulk entries plus the five seeded uncharted ones
	await expect(page.locator('[data-shelf-chip]')).toHaveCount(101);
	await expect(page.locator('[data-shelf-chip][data-kind="project"]').first()).toBeVisible();
	await expect(page.locator('[data-shelf-chip][data-kind="note"]').first()).toBeVisible();

	// the shelf scrolls rather than pushing the chart off the screen
	const chips = page.locator('.chart-shelf__chips');
	const overflow = await chips.evaluate((el) => el.scrollHeight - el.clientHeight);
	expect(overflow).toBeGreaterThan(0);
	await chips.evaluate((el) => { el.scrollTop = 200; });
	expect(await chips.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	await chips.evaluate((el) => { el.scrollTop = 0; });

	// drag one off the shelf onto the waters, at that scale
	await dragFromShelf(page, 'hobby:bh7', { x: 45, y: 55 });
	await expect(mark(page, 'hobby:bh7')).toBeVisible();
	await expect(page.locator('[data-shelf-chip]')).toHaveCount(100);

	await page.getByRole('button', { name: 'pin the chart' }).click();
	await expect(toast(page)).toHaveText('⚓ pinned. 1 berths updated.');
	const [charted] = mock.find('PUT', /^\/1\/hobby\/bh7$/);
	expect(proj(charted.body.coord).x).toBeCloseTo(45, 1);
	expect(proj(charted.body.coord).y).toBeCloseTo(55, 1);

	// and back off again: the shelf takes it in and the pin clears the coord
	const shelf = await page.locator('[data-shelf]').boundingBox();
	if (!shelf) {
		throw new Error('missing bounding box');
	}
	await dragMark(page, 'hobby:bh7', { at: { x: shelf.x + shelf.width / 2, y: shelf.y + 12 } });
	await expect(page.locator('[data-shelf-chip]')).toHaveCount(101);

	await page.getByRole('button', { name: 'pin the chart' }).click();
	await expect(toast(page)).toHaveText('⚓ pinned. 1 berths updated.');
	const puts = mock.find('PUT', /^\/1\/hobby\/bh7$/);
	expect(puts[puts.length - 1].body.coord).toBeNull();
});

// A hobby can sit uncharted on the wire and still carry the origin of the wake
// it used to trail: `from` outlives a coord that was cleared. No coord, no wake,
// so the table has to read that document as unmoved, or the whole shelf counts
// as moved at load and the first pin writes those origins away.
function withStrandedOrigin(): MockApi {
	const mock = new MockApi();
	mock.hobbies.push({
		id: 'h9', name: 'Bouldering', service: '2022', state: 'adrift',
		coord: null, from: { lat: 58.31, lon: -7.20 }, images: null, seasons: '1',
		bearing: 'Uncharted, but the chart remembers where it drifted from.',
		lastLog: '', floats: '', offCourse: '', odds: '',
		order: 9, createdAt: '2026-01-09T00:00:00Z', updatedAt: '2026-01-09T00:00:00Z',
	});
	return mock;
}

test('an uncharted mark that still carries a wake origin counts as unmoved: the pin stays dark at load', async ({ page }) => {
	await signIn(page, withStrandedOrigin());
	await openChartTable(page);

	await expect(page.locator('[data-shelf-chip][data-key="hobby:h9"]')).toBeVisible();
	// uncharted means no wake drawn, and nothing to save
	await expect(page.locator('[data-from-handle][data-key="hobby:h9"]')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'pin the chart' })).toBeDisabled();
});

test('a stored wake origin survives a pin it had nothing to do with', async ({ page }) => {
	const mock = await signIn(page, withStrandedOrigin());
	await openChartTable(page);

	// touch an entirely different mark, then pin
	await mark(page, 'hobby:h3').locator('.chart-mark__glyph').click();
	await sheet(page).getByLabel('caption · the line under the plate').fill('One night, both hands.');
	await page.getByRole('button', { name: 'pin the chart' }).click();
	await expect(toast(page)).toHaveText('⚓ pinned. 1 berths updated.');

	// the stranded origin is not in the pin, so the stored document keeps it
	expect(mock.find('PUT', /^\/1\/hobby\/h9$/)).toHaveLength(0);
	expect(mock.hobbies.find((h) => h.id === 'h9')?.from).toEqual({ lat: 58.31, lon: -7.20 });
});
