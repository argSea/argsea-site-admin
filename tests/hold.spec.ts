import { test, expect } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, nav, toast } from './office';

test('stowing an egg autosaves the complete copy singleton', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, "smuggler's hold").click();

	await expect(page.getByText('3 of 3 loose on the site right now')).toBeVisible();

	const bottle = page.locator('.card', { hasText: 'Message in a bottle' });
	await bottle.getByTitle('stow it away').click();
	await expect(toast(page)).toHaveText('· Message in a bottle — stowed away.');
	await expect(page.getByText('2 of 3 loose on the site right now')).toBeVisible();

	// "saved as you type" is the same debounced PUT the signal flags ride
	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBe(1);
	const [put] = mock.find('PUT', /^\/1\/copy\/?$/);
	expect(put.body.eggs).toEqual({ bottle: false, cat: true, lights: true });
	// the rest of the doc rode along — PUT is full-replace
	expect(put.body.quipHello).toBe('The boats run on schedule. Ish.');
	expect(put.body.catLocs).toEqual({ postcards: true, notes: true, p404: true });
	expect(put.body.bottleProverbs).toHaveLength(2);
	expect(put.body.lighthouses).toHaveLength(2);
});

test("the cat's rounds and the light list edit in place", async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, "smuggler's hold").click();

	// keep the cat off the wreck (rows: postcards, notes, the wreck)
	const cat = page.locator('.card', { hasText: 'The harbor cat' });
	await cat.getByTitle('keep it off here').nth(2).click();
	await expect(toast(page)).toHaveText('🐱 kept off the wreck.');
	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBe(1);
	const [catPut] = mock.find('PUT', /^\/1\/copy\/?$/);
	expect(catPut.body.catLocs).toEqual({ postcards: true, notes: true, p404: false });
	expect(catPut.body.eggs).toEqual({ bottle: true, cat: true, lights: true });

	// rename a light in place; its position stays put
	await page.getByPlaceholder('the light').first().fill('La Jument');
	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBe(2);
	const [lightPut] = mock.find('PUT', /^\/1\/copy\/?$/).slice(-1);
	expect(lightPut.body.lighthouses[0]).toEqual({ name: 'La Jument', pos: '51°23′N 9°36′W', line: 'Ireland’s teardrop — the last light the emigrants saw.' });
	expect(lightPut.body.lighthouses).toHaveLength(2);

	// chart another light — a blank row joins the chart
	const lights = page.locator('.card', { hasText: 'The light list' });
	await lights.getByRole('button', { name: '+ chart another light' }).click();
	await expect(lights.getByText('3 on the chart · one per wreck')).toBeVisible();
	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBe(3);
	const [addPut] = mock.find('PUT', /^\/1\/copy\/?$/).slice(-1);
	expect(addPut.body.lighthouses[2]).toEqual({ name: '', pos: '', line: '' });
});

test('the proverb editor casts and tosses', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, "smuggler's hold").click();

	const bottle = page.locator('.card', { hasText: 'Message in a bottle' });
	await expect(bottle.getByText('2 in the bottle · one shows per poke')).toBeVisible();

	// cast a new one and write it — one debounced save for both
	await bottle.getByRole('button', { name: '+ cast a new one out' }).click();
	await expect(bottle.getByText('3 in the bottle · one shows per poke')).toBeVisible();
	await bottle.locator('input').nth(2).fill('The sea provides. Usually a merge conflict.');
	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBe(1);
	const [castPut] = mock.find('PUT', /^\/1\/copy\/?$/);
	expect(castPut.body.bottleProverbs).toEqual([
		'A migration nobody notices is a migration done right.',
		'Ship the boring version. Boring floats.',
		'The sea provides. Usually a merge conflict.',
	]);

	// toss the first one overboard
	await bottle.getByTitle('toss this one overboard').first().click();
	await expect(bottle.getByText('2 in the bottle · one shows per poke')).toBeVisible();
	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBe(2);
	const [tossPut] = mock.find('PUT', /^\/1\/copy\/?$/).slice(-1);
	expect(tossPut.body.bottleProverbs).toEqual([
		'Ship the boring version. Boring floats.',
		'The sea provides. Usually a merge conflict.',
	]);
});

test('a copy doc from before the hold comes up with everything loose', async ({ page }) => {
	const mock = new MockApi();
	delete mock.copy.eggs;
	delete mock.copy.catLocs;
	delete mock.copy.bottleProverbs;
	delete mock.copy.lighthouses;
	await signIn(page, mock);
	await nav(page, "smuggler's hold").click();

	// absent = on: the missing fields are seeded enabled
	await expect(page.getByText('3 of 3 loose on the site right now')).toBeVisible();

	// and the first autosave persists the seeds explicitly
	const lights = page.locator('.card', { hasText: 'The light list' });
	await lights.getByTitle('stow it away').click();
	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBe(1);
	const [put] = mock.find('PUT', /^\/1\/copy\/?$/);
	expect(put.body.eggs).toEqual({ bottle: true, cat: true, lights: false });
	expect(put.body.catLocs).toEqual({ postcards: true, notes: true, p404: true });
	expect(put.body.bottleProverbs).toEqual([]);
	expect(put.body.lighthouses).toEqual([]);
});

test('null hold fields from a legacy API are seeded — on load and on the PUT echo', async ({ page }) => {
	// the real wire shape for a pre-hold doc is JSON null, not absent keys —
	// and the API echoes those nulls straight back on the PUT
	const mock = new MockApi();
	mock.copyPredatesHold = true;
	await signIn(page, mock);
	await nav(page, "smuggler's hold").click();

	await expect(page.getByText('3 of 3 loose on the site right now')).toBeVisible();

	const lights = page.locator('.card', { hasText: 'The light list' });
	await lights.getByTitle('stow it away').click();
	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBe(1);
	const [put] = mock.find('PUT', /^\/1\/copy\/?$/);
	expect(put.body.eggs).toEqual({ bottle: true, cat: true, lights: false });
	expect(put.body.catLocs).toEqual({ postcards: true, notes: true, p404: true });
	expect(put.body.bottleProverbs).toEqual([]);
	expect(put.body.lighthouses).toEqual([]);

	// the echo nulled everything again — seedHold adopts it as a fresh legacy
	// doc (the server kept nothing), everything reads loose, and the screen
	// is still standing instead of crashing on eggs being null
	await expect(page.getByText('3 of 3 loose on the site right now')).toBeVisible();

	// and the next flip still works, sending a fully seeded doc again
	const bottle = page.locator('.card', { hasText: 'Message in a bottle' });
	await bottle.getByTitle('stow it away').click();
	await expect(page.getByText('2 of 3 loose on the site right now')).toBeVisible();
	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBe(2);
	const [echoPut] = mock.find('PUT', /^\/1\/copy\/?$/).slice(-1);
	expect(echoPut.body.eggs).toEqual({ bottle: false, cat: true, lights: true });
	expect(echoPut.body.catLocs).toEqual({ postcards: true, notes: true, p404: true });
});

test('keystrokes typed while a slow PUT is in flight survive the echo', async ({ page }) => {
	// W1: a proverb edited across the debounce boundary — the first half fires a
	// save, the rest is typed while it's still on the wire. The stale echo must
	// not revert the field, and the wire must end up with the whole string.
	const mock = new MockApi();
	mock.copyPutLatency = 700;
	await signIn(page, mock);
	await nav(page, "smuggler's hold").click();

	const bottle = page.locator('.card', { hasText: 'Message in a bottle' });
	const field = bottle.locator('input').first();
	await field.click();
	await field.fill('');
	await field.pressSequentially('The sea', { delay: 40 });
	// past the 800ms debounce: the PUT dispatches and is now 700ms in flight
	await page.waitForTimeout(900);
	await field.pressSequentially(' remembers', { delay: 40 });

	await expect(field).toHaveValue('The sea remembers');
	await expect.poll(() => {
		const puts = mock.find('PUT', /^\/1\/copy\/?$/);
		return puts.length ? puts[puts.length - 1].body.bottleProverbs[0] : null;
	}).toBe('The sea remembers');
});
