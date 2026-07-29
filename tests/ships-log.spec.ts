import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, nav, toast } from './office';

// A row by its exact title: a bearing line can quote another hobby's name
// ("moored beside the home lab"), so match the row-title, not any substring.
const row = (page: Page, name: string) =>
	page.locator('.content-row').filter({ has: page.getByText(name, { exact: true }) });

test('the enthusiasm gauge clamps into [0,100] on save, and an empty gauge stays absent, never 0', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	// h1 has no gauge seeded; the field opens blank, not "0"
	await row(page, 'The home lab').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');
	const gauge = overlay.getByLabel('enthusiasm gauge · 0-100 · the landing bars');
	await expect(gauge).toHaveValue('');
	await gauge.fill('142');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✳ position updated');
	expect(mock.find('PUT', /^\/1\/hobby\/h1$/)[0].body.gauge).toBe(100);

	// a negative value clamps up to 0, not dropped
	await row(page, 'The home lab').getByText('edit', { exact: true }).click();
	await expect(gauge).toHaveValue('100');
	await gauge.fill('-8');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect.poll(() => mock.find('PUT', /^\/1\/hobby\/h1$/).length).toBe(2);
	expect(mock.find('PUT', /^\/1\/hobby\/h1$/)[1].body.gauge).toBe(0);

	// clearing it back out leaves it absent from the wire, not re-zeroed
	await row(page, 'The home lab').getByText('edit', { exact: true }).click();
	await expect(gauge).toHaveValue('0');
	await gauge.fill('');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect.poll(() => mock.find('PUT', /^\/1\/hobby\/h1$/).length).toBe(3);
	expect('gauge' in mock.find('PUT', /^\/1\/hobby\/h1$/)[2].body).toBe(false);
});

test('the state chips set the hobby state on save', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	await row(page, 'The home lab').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');
	await overlay.getByText('marooned', { exact: true }).click();
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✳ position updated');

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

test('a fresh mark starts moored and uncharted, waiting for the chart table', async ({ page }) => {
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
	// the berth is the chart table's to give: a new mark files uncharted
	expect(create.body.coord).toBeUndefined();
	expect(create.body.from).toBeUndefined();
	await expect(row(page, 'Sourdough')).toBeVisible();
});

test('a hobby with tags survives an edit round-trip with its tags intact', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	// Piano carries tags the admin has no editor for; edit an unrelated field
	await row(page, 'Piano').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('the bearing · how it reads on the chart').fill('Re-charted after a long drift.');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✳ position updated');

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
	await expect(page.locator('.topbar-chip')).toHaveCount(13);
	await expect(page.locator('.topbar-rule')).toHaveCount(3);

	// a nav chip switches screens
	await page.locator('.topbar-chip', { hasText: 'the wandering chart' }).click();
	await expect(page.locator('.page-title')).toHaveText('The wandering chart');

	// the deploy verb fires a hoist
	await page.locator('.topbar-deploy').click();
	await expect.poll(() => mock.find('POST', /^\/1\/lantern\/hoist$/).length).toBeGreaterThan(0);
});

test('the notes-found-here tie picker writes noteIds on a chart mark, both ways', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	// CachyOS tinkering has no noteIds on the wire yet: mirrors the light's
	// notes-found-here box, keyed by the note's stable id
	await row(page, 'CachyOS tinkering').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');
	await overlay.locator('.fieldset-dashed', { hasText: 'notes found here' }).getByPlaceholder('search the book...').fill('weekend');
	await overlay.getByText('+ The home lab ate my weekend').click();
	await expect(overlay.getByText('✓ The home lab ate my weekend · ✕')).toBeVisible();

	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✳ position updated');
	const [put] = mock.find('PUT', /^\/1\/hobby\/h2$/);
	expect(put.body.noteIds).toEqual(['n2']);

	// the other direction: the writing desk's "kept in" box reflects the tie,
	// keyed by the note's stable id, and untying there writes the mark back
	await nav(page, 'writing desk').click();
	await page.locator('.note-row', { hasText: 'The home lab ate my weekend' }).getByText('edit', { exact: true }).click();
	const noteOverlay = page.locator('.overlay-card');
	const keptIn = noteOverlay.getByRole('button', { name: 'CachyOS tinkering' });
	await expect(keptIn).toHaveAttribute('aria-pressed', 'true');
	await keptIn.click();
	await expect.poll(() => mock.find('PUT', /^\/1\/hobby\/h2$/).length).toBe(2);
	const [, untie] = mock.find('PUT', /^\/1\/hobby\/h2$/);
	expect(untie.body.noteIds).toEqual([]);
});

test('a tied note survives a reload, read straight off the mock api', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	await row(page, 'CachyOS tinkering').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');
	await overlay.locator('.fieldset-dashed', { hasText: 'notes found here' }).getByPlaceholder('search the book...').fill('weekend');
	await overlay.getByText('+ The home lab ate my weekend').click();
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✳ position updated');
	expect(mock.find('PUT', /^\/1\/hobby\/h2$/)[0].body.noteIds).toEqual(['n2']);

	// the PUT lands in the mock's own store, so a fresh GET on reload reflects it
	await page.reload();
	await nav(page, 'the wandering chart').click();
	await row(page, 'CachyOS tinkering').getByText('edit', { exact: true }).click();
	await expect(page.locator('.overlay-card').getByText('✓ The home lab ate my weekend · ✕')).toBeVisible();
});

test('a mark with no noteIds on the wire opens with an empty tie box and degrades cleanly', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();

	// The home lab (h1) has no noteIds field at all in the fixture: the same
	// null-like-tags fallback the light side already leans on
	await row(page, 'The home lab').getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');
	const ties = overlay.locator('.fieldset-dashed', { hasText: 'notes found here' });
	await expect(ties).toBeVisible();
	await expect(ties.getByText('✕')).toHaveCount(0);
	await expect(ties.getByText('2 entries in the book · search to tuck one in.')).toBeVisible();

	await ties.getByPlaceholder('search the book...').fill('queue');
	await ties.getByText('+ The queue is the product').click();
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✳ position updated');
	expect(mock.find('PUT', /^\/1\/hobby\/h1$/)[0].body.noteIds).toEqual(['n1']);
});
