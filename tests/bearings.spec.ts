import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { signIn, nav, toast } from './office';
import { MEMORIAL, dragMark, mark, markPercent, proj, settle } from './chart-window';

// The wandering chart's own slot: the same surface as the chart table, narrowed
// to hobbies, with the scatter chip that only makes sense for a fleet.

async function openHobbyChart(page: Page) {
	await nav(page, 'the wandering chart').click();
	await page.getByText('the chart', { exact: true }).click();
	await expect(page.locator('.chart-band')).toBeVisible();
	await settle(page);
}

test('the chart tab plots a mark per charted hobby at the bearing the public chart renders, the uncharted wait on the shelf', async ({ page }) => {
	await signIn(page);
	await openHobbyChart(page);

	// h1-h4 carry coords; h5 (Chess) came through the migration uncharted. The
	// lens is hobbies only, so no light or note shows up here.
	await expect(page.locator('.chart-mark')).toHaveCount(4);
	await expect(page.locator('[data-shelf-chip]')).toHaveText(['Chess']);

	// Piano sits exactly where proj() puts it on the public site
	const want = proj({ lat: 58.42, lon: -7.12 });
	const got = await markPercent(page, 'hobby:h3');
	expect(got.x).toBeCloseTo(want.x, 0);
	expect(got.y).toBeCloseTo(want.y, 0);
});

test('the pin sits disabled until a berth moves', async ({ page }) => {
	await signIn(page);
	await openHobbyChart(page);

	await expect(page.getByRole('button', { name: 'pin the chart' })).toBeDisabled();
	await page.getByText('↯ scatter the fleet').click();
	await expect(page.getByRole('button', { name: 'pin the chart' })).toBeEnabled();
});

test('a drag to a known pixel writes the projected bearing and nothing saves before the pin', async ({ page }) => {
	const mock = await signIn(page);
	await openHobbyChart(page);

	await dragMark(page, 'hobby:h3', { x: 60, y: 40 });

	// local until pinned: the drag alone writes nothing to the wire
	expect(mock.find('PUT', /^\/1\/hobby\//)).toHaveLength(0);

	await page.getByRole('button', { name: 'pin the chart' }).click();
	await expect(toast(page)).toHaveText('⚓ pinned. 1 berths updated.');

	// exactly the one moved hobby is PUT, and only its bearing changed
	expect(mock.find('PUT', /^\/1\/hobby\//)).toHaveLength(1);
	const [put] = mock.find('PUT', /^\/1\/hobby\/h3$/);

	// the round trip: the written coord projects back to the pixel it dropped on
	const back = proj(put.body.coord);
	expect(back.x).toBeCloseTo(60, 1);
	expect(back.y).toBeCloseTo(40, 1);

	// dragging the mark leaves the wake's origin where the model had it
	expect(put.body.from).toEqual({ lat: 58.24, lon: -7.44 });
});

test('a wake origin drags on its own handle, independent of its mark', async ({ page }) => {
	const mock = await signIn(page);
	await openHobbyChart(page);

	const band = await page.locator('.chart-band').boundingBox();
	const handle = await page.locator('[data-from-handle][data-key="hobby:h3"]').boundingBox();
	if (!band || !handle) {
		throw new Error('missing bounding box');
	}

	// drag only Piano's origin handle to 30% across, 70% down
	await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
	await page.mouse.down();
	await page.mouse.move(band.x + band.width * 0.30, band.y + band.height * 0.70, { steps: 8 });
	await page.mouse.up();

	await page.getByRole('button', { name: 'pin the chart' }).click();
	await expect(toast(page)).toHaveText('⚓ pinned. 1 berths updated.');

	const [put] = mock.find('PUT', /^\/1\/hobby\/h3$/);
	// the origin moved to the drop, the mark stayed put
	expect(proj(put.body.from).x).toBeCloseTo(30, 1);
	expect(proj(put.body.from).y).toBeCloseTo(70, 1);
	expect(put.body.coord).toEqual({ lat: 58.42, lon: -7.12 });
});

test('scatter re-plots the whole fleet: every moored ship clusters off Eilean Mòr, the uncharted are charted', async ({ page }) => {
	const mock = await signIn(page);
	await openHobbyChart(page);

	await page.getByText('↯ scatter the fleet').click();
	// still local: the scatter touches nothing on the wire
	expect(mock.find('PUT', /^\/1\/hobby\//)).toHaveLength(0);
	// Chess left the shelf for the waters
	await expect(page.locator('[data-shelf-chip]')).toHaveCount(0);
	await expect(page.locator('.chart-mark')).toHaveCount(5);

	await page.getByRole('button', { name: 'pin the chart' }).click();
	await expect(toast(page)).toHaveText('⚓ pinned. 5 berths updated.');

	expect(mock.find('PUT', /^\/1\/hobby\//)).toHaveLength(5);

	// the moored ships (h1, h2, and the once-uncharted h5) land within the tight
	// radius of the memorial; the uncharted one now carries a real coord
	for (const id of ['h1', 'h2', 'h5']) {
		const [put] = mock.find('PUT', new RegExp(`^/1/hobby/${id}$`));
		expect(put.body.coord).not.toBeNull();
		const d = Math.hypot(put.body.coord.lat - MEMORIAL.lat, put.body.coord.lon - MEMORIAL.lon);
		expect(d).toBeLessThanOrEqual(0.051);
	}
});

test('the scatter chip is the hobby lens\'s own chrome, absent from the chart table', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the chart table').click();
	await expect(page.locator('.chart-band')).toBeVisible();
	await expect(page.getByText('↯ scatter the fleet')).toHaveCount(0);

	await openHobbyChart(page);
	await expect(page.getByText('↯ scatter the fleet')).toHaveCount(1);
	await expect(mark(page, 'hobby:h3')).toBeVisible();
});
