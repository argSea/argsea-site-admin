import { test, expect } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, toast } from './office';

test('the dirty counter reads the log — lantern entries excluded', async ({ page }) => {
	await signIn(page);
	// seeded: two content entries newer than lastHoistedAt, one lantern entry
	await expect(page.getByText('◍ 2 changes aboard since last hoist')).toBeVisible();
});

test('hoist: 202, the boat goes out, polling brings it home', async ({ page }) => {
	const mock = await signIn(page);
	await page.getByRole('button', { name: 'hoist the lantern' }).click();

	expect(mock.find('POST', /^\/1\/lantern\/hoist$/)).toHaveLength(1);
	await expect(page.getByText(/rebuilding · \d+%/)).toBeVisible();

	// the mock succeeds after two status polls (~3s)
	await expect(toast(page)).toHaveText('⚓ hoisted. the site sails with the new cargo.', { timeout: 10_000 });
	await expect(page.getByText('last hoisted: just now')).toBeVisible();
	await expect(page.getByText('○ nothing new aboard')).toBeVisible();
});

test('a 409 on hoist adopts the in-flight status instead of erroring', async ({ page }) => {
	const mock = new MockApi();
	mock.hoistBusy = true;
	await signIn(page, mock);

	await page.getByRole('button', { name: 'hoist the lantern' }).click();
	await expect(toast(page)).toHaveText('the boat is already out — one hoist at a time');
});

test('rollback wants a second click, then re-points the lantern', async ({ page }) => {
	const mock = await signIn(page);

	await page.getByText('↩ re-hoist the previous lantern').click();
	expect(mock.find('POST', /^\/1\/lantern\/rollback$/)).toHaveLength(0);
	await page.getByText('↩ sure? sail backwards.').click();

	await expect(toast(page)).toHaveText('↩ previous lantern re-hoisted. the old lights are back on.');
	expect(mock.find('POST', /^\/1\/lantern\/rollback$/)).toHaveLength(1);
});

test('rollback with nothing to fall back to gets the 409 message', async ({ page }) => {
	const mock = new MockApi();
	mock.rollbackAvailable = false;
	await signIn(page, mock);

	await page.getByText('↩ re-hoist the previous lantern').click();
	await page.getByText('↩ sure? sail backwards.').click();
	await expect(toast(page)).toHaveText('⚓ no previous lantern to re-hoist');
});

test('no lantern config, no hoist button', async ({ page }) => {
	const mock = new MockApi();
	mock.lanternMounted = false;
	await signIn(page, mock);
	await expect(page.getByText('○ not rigged in this harbor')).toBeVisible();
	await expect(page.getByRole('button', { name: 'hoist the lantern' })).toHaveCount(0);
});
