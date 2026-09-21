import { test, expect } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, toast } from './office';

test('the dirty counter beats the default activity window, lantern entries excluded', async ({ page }) => {
	const mock = await signIn(page);
	// seeded: EIGHT content entries newer than lastHoistedAt (more than the
	// API's default recent window of 6), plus one lantern entry to exclude
	await expect(page.getByText('◍ 8 changes in the tower since last hoist')).toBeVisible();
	// only possible because the client asked for more than the default window
	const activityReads = mock.find('GET', /^\/1\/activity\/$/);
	expect(activityReads.length).toBeGreaterThan(0);
	expect(activityReads[0].search).toBe('?limit=100');
});

test('hoist: 202, the boat goes out, polling brings it home', async ({ page }) => {
	const mock = await signIn(page);
	await page.getByRole('button', { name: 'hoist the lantern' }).click();

	expect(mock.find('POST', /^\/1\/lantern\/hoist$/)).toHaveLength(1);
	await expect(page.getByText(/rebuilding · \d+%/)).toBeVisible();

	// the mock succeeds after two status polls (~3s)
	await expect(toast(page)).toHaveText('☀ hoisted. the site is live with the new copy.', { timeout: 10_000 });
	await expect(page.getByText('last hoisted: just now')).toBeVisible();
	await expect(page.getByText('○ nothing new in the tower')).toBeVisible();
});

test('a 409 on hoist adopts the in-flight status instead of erroring', async ({ page }) => {
	const mock = new MockApi();
	mock.hoistBusy = true;
	await signIn(page, mock);

	await page.getByRole('button', { name: 'hoist the lantern' }).click();
	await expect(toast(page)).toHaveText('the boat is already out, one hoist at a time');
});

test('rollback wants a second click, then re-points the lantern', async ({ page }) => {
	const mock = await signIn(page);

	await page.getByText('↩ re-hoist the previous lantern').click();
	expect(mock.find('POST', /^\/1\/lantern\/rollback$/)).toHaveLength(0);
	await page.getByText('↩ sure? go back to the previous hoist.').click();

	await expect(toast(page)).toHaveText('↩ previous lantern re-hoisted. the old lights are back on.');
	expect(mock.find('POST', /^\/1\/lantern\/rollback$/)).toHaveLength(1);
});

test('rollback with nothing to fall back to gets the 409 message', async ({ page }) => {
	const mock = new MockApi();
	mock.rollbackAvailable = false;
	await signIn(page, mock);

	await page.getByText('↩ re-hoist the previous lantern').click();
	await page.getByText('↩ sure? go back to the previous hoist.').click();
	await expect(toast(page)).toHaveText('⚓ no previous lantern to re-hoist');
});

test('a refusal the office has never heard of reaches the keeper in the API\'s own words', async ({ page }) => {
	const mock = new MockApi();
	// the resume guard: 412 before anything is staged, with the reason in the body
	mock.hoistRefusal = 'no resume is published; the site would go up without one';
	await signIn(page, mock);

	await page.getByRole('button', { name: 'hoist the lantern' }).click();
	await expect(toast(page)).toHaveText('⚠ no resume is published; the site would go up without one');
	// the boat never left: the panel still offers the hoist
	await expect(page.getByRole('button', { name: 'hoist the lantern' })).toBeVisible();
});

test('a refusal with nothing readable in the body still names the status', async ({ page }) => {
	await signIn(page);
	// registered after the mock, so it wins the hoist route
	await page.route(/\/1\/lantern\/hoist/, (route) =>
		route.fulfill({ status: 503, contentType: 'text/html', headers: { 'Access-Control-Allow-Origin': '*' }, body: '<h1>503 bad gateway</h1>' }));

	await page.getByRole('button', { name: 'hoist the lantern' }).click();
	await expect(toast(page)).toHaveText('⚠ hoist failed (503)');
});

test('no lantern config, no hoist button', async ({ page }) => {
	const mock = new MockApi();
	mock.lanternMounted = false;
	await signIn(page, mock);
	await expect(page.getByText('○ not rigged in this harbor')).toBeVisible();
	await expect(page.getByRole('button', { name: 'hoist the lantern' })).toHaveCount(0);
});
