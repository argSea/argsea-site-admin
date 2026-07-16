import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, nav, toast } from './office';

// A row by its exact title: a bearing line can quote another hobby's name
// ("moored beside the home lab"), so match the row-title, not any substring.
const row = (page: Page, name: string) =>
	page.locator('.content-row').filter({ has: page.getByText(name, { exact: true }) });

test('the chart editor round-trips the new shape: blank coords save null, a half-filled pair is rejected', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	// clear both coordinates on a charted hobby: the wire takes null, no zero-fill
	await row(page, 'Piano').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('charted position · latitude').fill('');
	await overlay.getByLabel('· longitude').fill('');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✳ position updated');
	expect(mock.find('PUT', /^\/1\/hobby\/h3$/)[0].body.coord).toBeNull();

	// a half-filled pair (one bearing, one blank) bounces before the wire
	await row(page, 'Piano').getByText('edit', { exact: true }).click();
	await overlay.getByLabel('charted position · latitude').fill('58.5');
	await overlay.getByLabel('· longitude').fill('');
	mock.calls.length = 0;
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('⚠ a mark needs both bearings, or neither');
	expect(mock.find('PUT', /^\/1\/hobby\//)).toHaveLength(0);
	await expect(overlay).toBeVisible();
});

test('the state chips set the hobby state on save', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	await row(page, 'The home lab').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');
	await overlay.getByText('marooned', { exact: true }).click();
	await overlay.getByRole('button', { name: 'save changes' }).click();

	const [put] = mock.find('PUT', /^\/1\/hobby\/h1$/);
	expect(put.body.state).toBe('marooned');
});

test('set adrift and bring to port flip the state through a full-replace PUT', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	// an on-watch hobby: set adrift
	await row(page, 'The home lab').getByText('set adrift').click();
	await expect(toast(page)).toHaveText('≈ logged adrift. still afloat.');
	const [adrift] = mock.find('PUT', /^\/1\/hobby\/h1$/);
	expect(adrift.body.state).toBe('adrift');
	expect(adrift.body.name).toBe('The home lab');

	// it dropped into the off-fairway group; bring it back into port
	mock.calls.length = 0;
	await row(page, 'The home lab').getByText('bring to port').click();
	await expect(toast(page)).toHaveText('⚓ brought into port');
	expect(mock.find('PUT', /^\/1\/hobby\/h1$/)[0].body.state).toBe('port');
});

test('reorder stays inside the group and swaps orders via PUT (hobbies snapshot nothing)', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	// in-port group: the home lab (h1), CachyOS (h2), Chess (h5); move h1 down
	await row(page, 'The home lab').getByTitle('move down').click();
	await expect(page.locator('.content-row .row-title').first()).toHaveText('CachyOS tinkering');

	const puts = mock.calls.filter((c) => c.method === 'PUT' && /^\/1\/hobby\//.test(c.path));
	expect(puts).toHaveLength(2);
	expect(puts.find((c) => c.path.endsWith('h1'))?.body.order).toBe(2);
	expect(puts.find((c) => c.path.endsWith('h2'))?.body.order).toBe(1);

	// moving the last off-fairway hobby down goes nowhere and calls nothing
	mock.calls.length = 0;
	await row(page, 'Running').getByTitle('move down').click();
	expect(mock.calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
});

test('a fresh mark starts moored with the default coordinates and files onto the chart', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();
	await page.getByRole('button', { name: '+ pick something up' }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('keeper (hobby)').fill('Sourdough');
	await overlay.getByLabel('the bearing · how it reads on the chart').fill('Alive on the counter, watched daily.');
	await overlay.getByRole('button', { name: 'file it' }).click();

	await expect(toast(page)).toHaveText('✳ a new mark on the chart');
	const [create] = mock.find('POST', /^\/1\/hobby\/$/);
	expect(create.body.name).toBe('Sourdough');
	expect(create.body.state).toBe('moored');
	// the mock's starting coordinates parse to numbers on the wire
	expect(create.body.coord).toEqual({ lat: 58.2, lon: -7.4 });
	expect(create.body.from).toBeNull();
	await expect(row(page, 'Sourdough')).toBeVisible();
});

test('a migrated hobby opens with blank coordinate inputs and saves clean', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	// h5 came through the migration with null coords: it lists, and the editor
	// opens with the coordinate inputs blank, ready to be charted by hand
	await row(page, 'Chess').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByLabel('charted position · latitude')).toHaveValue('');
	await expect(overlay.getByLabel('· longitude')).toHaveValue('');

	// saving without charting keeps coord null: no silent zero-fill
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✳ position updated');
	const [put] = mock.find('PUT', /^\/1\/hobby\/h5$/);
	expect(put.body.coord).toBeNull();
	expect(put.body.from).toBeNull();
});

test('every coordinate input snaps an out-of-band bearing to the chart edge on blur, at both bounds', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the wandering chart').click();

	await row(page, 'Piano').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');

	// each of the four inputs snaps to its own band on blur: lat to
	// [57.82, 58.56], lon to [-7.94, -6.59], and the snapped value shows at once
	const bands = [
		{ label: 'charted position · latitude', hi: '58.56', lo: '57.82' },
		{ label: '· longitude', hi: '-6.59', lo: '-7.94' },
		{ label: 'origin lat', hi: '58.56', lo: '57.82' },
		{ label: 'origin lon', hi: '-6.59', lo: '-7.94' },
	];
	for (const band of bands) {
		const input = overlay.getByLabel(band.label);
		await input.fill('99');
		await input.blur();
		await expect(input).toHaveValue(band.hi);
		await input.fill('-99');
		await input.blur();
		await expect(input).toHaveValue(band.lo);
	}
});

test('an in-band bearing stays as typed, a blank origin stays blank, and the snapped values ride the PUT', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	await row(page, 'The home lab').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');

	// inside the band the text is left exactly as typed, trailing zero and all
	const lat = overlay.getByLabel('charted position · latitude');
	await lat.fill('58.10');
	await lat.blur();
	await expect(lat).toHaveValue('58.10');

	// west of the edge it snaps to the bound
	const lon = overlay.getByLabel('· longitude');
	await lon.fill('-9');
	await lon.blur();
	await expect(lon).toHaveValue('-7.94');

	// the blank origin pair stays blank on blur, no zero-fill
	const fromLat = overlay.getByLabel('origin lat');
	await fromLat.fill('');
	await fromLat.blur();
	await expect(fromLat).toHaveValue('');

	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✳ position updated');
	const [put] = mock.find('PUT', /^\/1\/hobby\/h1$/);
	expect(put.body.coord).toEqual({ lat: 58.1, lon: -7.94 });
	expect(put.body.from).toBeNull();
});

test('a mono hint under the coordinates names the chart band', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the wandering chart').click();

	await row(page, 'The home lab').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByText(
		'// the chart runs 57.82 to 58.56 north, 7.94 to 6.59 west · a bearing off the edge snaps back onto it',
	)).toBeVisible();
});

test('a hobby with tags survives an edit round-trip with its tags intact', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	// Piano carries tags the admin has no editor for; edit an unrelated field
	await row(page, 'Piano').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('the bearing · how it reads on the chart').fill('Re-charted after a long drift.');
	await overlay.getByRole('button', { name: 'save changes' }).click();

	const [put] = mock.find('PUT', /^\/1\/hobby\/h3$/);
	expect(put.body.bearing).toBe('Re-charted after a long drift.');
	// the pass-through rides the full-replace PUT untouched
	expect(put.body.tags).toEqual(['keys', 'practice']);
});

test('the suggestion pool feeds and un-tempts fate', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	await page.getByPlaceholder('blacksmithing? kayaking?').fill('chess');
	await page.getByRole('button', { name: '+ tempt fate' }).click();
	await expect(toast(page)).toHaveText('the pool deepens');
	// the chip gains its question mark on the way in
	expect(mock.find('POST', /^\/1\/suggestion\/$/)[0].body).toEqual({ value: 'chess?' });
	await expect(page.locator('.sway-chip', { hasText: 'chess?' })).toBeVisible();

	await page.locator('.sway-chip', { hasText: 'kayaking?' }).locator('.chip-x').click();
	await expect(toast(page)).toHaveText('fate un-tempted');
	expect(mock.find('DELETE', /^\/1\/suggestion\/s2$/)).toHaveLength(1);
});

test('the flares tile reads the traffic tally and the roll call resolves names and bars', async ({ page }) => {
	await signIn(page);

	// the tile reads the tally: label, the most-wanted line, the roll-call hint
	await expect(page.getByText('flares from the coast')).toBeVisible();
	await expect(page.getByText('most wanted back: piano')).toBeVisible();
	await expect(page.getByText('tap for the roll call →')).toBeVisible();

	// tapping opens the roll call: the total line, resolved names, proportional bars
	await page.getByText('tap for the roll call →').click();
	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByText('12 flares logged · they want piano back most')).toBeVisible();
	await expect(overlay.getByText('Piano', { exact: true })).toBeVisible();
	await expect(overlay.getByText('Running', { exact: true })).toBeVisible();
	await expect(overlay.getByText('// one flare is one visitor, fired from a bearing card on the hobby chart. the coast votes with light.')).toBeVisible();

	// the top hobby's bar fills the track; the runner-up is proportional (5/7)
	await expect(overlay.locator('div[style*="width: 100%"]')).toHaveCount(1);
	await expect(overlay.locator('div[style*="width: 71%"]')).toHaveCount(1);

	// Escape closes the roll call
	await page.keyboard.press('Escape');
	await expect(overlay).toHaveCount(0);
});

test('with no flares logged, the roll call shows the empty state', async ({ page }) => {
	const mock = new MockApi();
	mock.traffic = { ...mock.traffic, flares: 0, flareRolls: [] };
	await signIn(page, mock);

	// a present count of zero reads quiet, and opening the roll call shows why
	await expect(page.getByText('the coast is quiet. no flares yet.')).toBeVisible();
	await page.getByText('tap for the roll call →').click();
	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByText('the coast is quiet · no flares logged yet')).toBeVisible();
	await expect(overlay.getByText(/No flares yet\. When a visitor opens/)).toBeVisible();
});

test('an older traffic report without flare fields falls soft to a quiet tile and empty roll call', async ({ page }) => {
	const mock = new MockApi();
	delete mock.traffic.flares;
	delete mock.traffic.flareRolls;
	await signIn(page, mock);

	// wait for the report to land (the ships tile settles) so the only quiet
	// tile left is the flares one: its placeholder is the fail-soft, not a zero
	await expect(page.getByText('1,204')).toBeVisible();
	await expect(page.getByText('· · ·')).toBeVisible();
	await expect(page.getByText('the coast is quiet. no flares yet.')).toBeVisible();

	// and the roll call still opens to the empty state, not a broken board
	await page.getByText('tap for the roll call →').click();
	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByText('the coast is quiet · no flares logged yet')).toBeVisible();
	await expect(overlay.getByText(/No flares yet/)).toBeVisible();
});

test('at 390px the sidebar hides, the topbar chips navigate, and the deploy verb fires', async ({ page }) => {
	const mock = await signIn(page);
	await page.setViewportSize({ width: 390, height: 780 });

	// the desktop rail is gone; the sticky topbar stands in for it, chips
	// grouped by the same three upright rules as the rail
	await expect(page.locator('.office-sidebar')).toBeHidden();
	await expect(page.locator('.office-topbar')).toBeVisible();
	await expect(page.locator('.topbar-chip')).toHaveCount(12);
	await expect(page.locator('.topbar-rule')).toHaveCount(3);

	// a nav chip switches screens
	await page.locator('.topbar-chip', { hasText: 'the wandering chart' }).click();
	await expect(page.locator('.page-title')).toHaveText('The wandering chart');

	// the deploy verb fires a hoist
	await page.locator('.topbar-deploy').click();
	await expect.poll(() => mock.find('POST', /^\/1\/lantern\/hoist$/).length).toBeGreaterThan(0);
});
