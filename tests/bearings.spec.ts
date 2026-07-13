import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { signIn, nav, toast } from './office';

// The public chart's projection, transcribed verbatim from the island
// (argsea-site src/components/islands/ShipsLog.tsx). The office's drop math must
// be its exact inverse: a bearing pinned here has to project back to the pixel
// it was dropped on, or it renders off its mark on the live site. Every drop
// assertion below round-trips a written coord through this proj().
const CHART_WIN = { latTop: 58.58, latBot: 57.80, lonLeft: -7.98, lonRight: -6.55 };
const proj = (c: { lat: number; lon: number }) => ({
	x: ((c.lon - CHART_WIN.lonLeft) / (CHART_WIN.lonRight - CHART_WIN.lonLeft)) * 100,
	y: ((CHART_WIN.latTop - c.lat) / (CHART_WIN.latTop - CHART_WIN.latBot)) * 100,
});
const MEMORIAL = { lat: 58.283, lon: -7.583 };

async function openChart(page: Page) {
	await nav(page, 'the wandering chart').click();
	await page.getByText('the chart', { exact: true }).click();
	await expect(page.locator('.bearing-chart')).toBeVisible();
}

const mark = (page: Page, name: string) => page.locator('.bearing-mark', { hasText: name });
// the dot is the sole grab target on a mark; grabbing the container center could
// land on the pointer-transparent gap between the dot and its name pill
const markDot = (page: Page, name: string) => mark(page, name).locator('.bearing-mark__dot');

// The center of an absolutely-anchored element (translate(-50%,-50%)) is its
// bearing's projected position; read it back as a percent of the chart band.
async function markPercent(page: Page, name: string): Promise<{ x: number; y: number }> {
	const band = await page.locator('.bearing-chart').boundingBox();
	const box = await mark(page, name).boundingBox();
	if (!band || !box) {
		throw new Error('missing bounding box');
	}
	return {
		x: ((box.x + box.width / 2 - band.x) / band.width) * 100,
		y: ((box.y + box.height / 2 - band.y) / band.height) * 100,
	};
}

test('the chart tab plots a mark per charted hobby at the bearing the public chart renders, the uncharted wait in the tray', async ({ page }) => {
	await signIn(page);
	await openChart(page);

	// h1-h4 carry coords; h5 (Chess) came through the migration uncharted
	await expect(page.locator('.bearing-mark')).toHaveCount(4);
	await expect(page.locator('[data-tray-chip]')).toHaveText(['Chess']);

	// Piano sits exactly where proj() puts it on the public site
	const want = proj({ lat: 58.42, lon: -7.12 });
	const got = await markPercent(page, 'Piano');
	expect(got.x).toBeCloseTo(want.x, 0);
	expect(got.y).toBeCloseTo(want.y, 0);
});

test('the pin sits disabled until a bearing moves', async ({ page }) => {
	await signIn(page);
	await openChart(page);

	await expect(page.getByRole('button', { name: 'pin the fleet' })).toBeDisabled();
	await page.getByText('↯ scatter the fleet').click();
	await expect(page.getByRole('button', { name: 'pin the fleet' })).toBeEnabled();
});

test('a drag to a known pixel writes the projected bearing and nothing saves before the pin', async ({ page }) => {
	const mock = await signIn(page);
	await openChart(page);

	const band = await page.locator('.bearing-chart').boundingBox();
	const from = await markDot(page, 'Piano').boundingBox();
	if (!band || !from) {
		throw new Error('missing bounding box');
	}

	// drop Piano's mark at 60% across, 40% down: the exact inverse of proj puts
	// that at 58.268 N, 7.122 W
	const dropX = band.x + band.width * 0.60;
	const dropY = band.y + band.height * 0.40;
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
	await page.mouse.down();
	await page.mouse.move(dropX, dropY, { steps: 8 });
	await page.mouse.up();

	// local until pinned: the drag alone writes nothing to the wire
	expect(mock.find('PUT', /^\/1\/hobby\//)).toHaveLength(0);

	await page.getByRole('button', { name: 'pin the fleet' }).click();
	await expect(toast(page)).toHaveText('⚓ pinned. 1 bearings updated.');

	// exactly the one moved hobby is PUT, and only its bearing changed
	const puts = mock.find('PUT', /^\/1\/hobby\//);
	expect(puts).toHaveLength(1);
	const [put] = mock.find('PUT', /^\/1\/hobby\/h3$/);
	expect(put.body.coord.lat).toBeCloseTo(58.268, 2);
	expect(put.body.coord.lon).toBeCloseTo(-7.122, 2);

	// the round trip: the written coord projects back to the pixel it dropped on
	const back = proj(put.body.coord);
	expect(back.x).toBeCloseTo(60, 1);
	expect(back.y).toBeCloseTo(40, 1);

	// dragging the mark leaves the wake's origin where the model had it
	expect(put.body.from).toEqual({ lat: 58.24, lon: -7.44 });
});

test('a wake origin drags on its own handle, independent of its mark', async ({ page }) => {
	const mock = await signIn(page);
	await openChart(page);

	const band = await page.locator('.bearing-chart').boundingBox();
	const handle = await page.locator('[data-from-handle][data-hobby-id="h3"]').boundingBox();
	if (!band || !handle) {
		throw new Error('missing bounding box');
	}

	// drag only Piano's origin handle to 30% across, 70% down
	await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
	await page.mouse.down();
	await page.mouse.move(band.x + band.width * 0.30, band.y + band.height * 0.70, { steps: 8 });
	await page.mouse.up();

	await page.getByRole('button', { name: 'pin the fleet' }).click();
	await expect(toast(page)).toHaveText('⚓ pinned. 1 bearings updated.');

	const [put] = mock.find('PUT', /^\/1\/hobby\/h3$/);
	// the origin moved to the drop, the mark stayed put
	expect(proj(put.body.from).x).toBeCloseTo(30, 1);
	expect(proj(put.body.from).y).toBeCloseTo(70, 1);
	expect(put.body.coord).toEqual({ lat: 58.42, lon: -7.12 });
});

test('scatter re-plots the whole fleet: every moored ship clusters off Eilean Mòr, the uncharted are charted', async ({ page }) => {
	const mock = await signIn(page);
	await openChart(page);

	await page.getByText('↯ scatter the fleet').click();
	// still local: the scatter touches nothing on the wire
	expect(mock.find('PUT', /^\/1\/hobby\//)).toHaveLength(0);
	// Chess left the tray for the waters
	await expect(page.locator('[data-tray-chip]')).toHaveCount(0);
	await expect(page.locator('.bearing-mark')).toHaveCount(5);

	await page.getByRole('button', { name: 'pin the fleet' }).click();
	await expect(toast(page)).toHaveText('⚓ pinned. 5 bearings updated.');

	const puts = mock.find('PUT', /^\/1\/hobby\//);
	expect(puts).toHaveLength(5);

	// the moored ships (h1, h2, and the once-uncharted h5) land within the tight
	// radius of the memorial; the uncharted one now carries a real coord
	for (const id of ['h1', 'h2', 'h5']) {
		const [put] = mock.find('PUT', new RegExp(`^/1/hobby/${id}$`));
		expect(put.body.coord).not.toBeNull();
		const d = Math.hypot(put.body.coord.lat - MEMORIAL.lat, put.body.coord.lon - MEMORIAL.lon);
		expect(d).toBeLessThanOrEqual(0.051);
	}
});
