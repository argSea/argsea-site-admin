import { test, expect } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, nav, toast } from './office';

test('the door reads The Keeper\'s Office, not the retired harbormaster name', async ({ page }) => {
	const mock = new MockApi();
	await mock.install(page);
	await page.goto('/');
	await expect(page.getByText("The Keeper's Office")).toBeVisible();
	await expect(page.getByText("The Harbormaster's Office")).toHaveCount(0);
});

test('empty fields get the door microcopy', async ({ page }) => {
	const mock = new MockApi();
	await mock.install(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'unlock the office' }).click();
	await expect(page.getByText('the harbor needs a name.')).toBeVisible();
	await page.getByPlaceholder('who goes there?').fill('meo');
	await page.getByRole('button', { name: 'unlock the office' }).click();
	await expect(page.getByText('no passphrase, no lantern.')).toBeVisible();
	// nothing reached the API
	expect(mock.find('POST', /login/)).toHaveLength(0);
});

test('a wrong passphrase is turned away', async ({ page }) => {
	const mock = new MockApi();
	await mock.install(page);
	await page.goto('/');
	await page.getByPlaceholder('who goes there?').fill('meo');
	await page.getByPlaceholder('passphrase').fill('wrong');
	await page.getByRole('button', { name: 'unlock the office' }).click();
	await expect(page.getByText('the harbor does not know that name and passphrase.')).toBeVisible();
});

test('a barred caller sees the keeper\'s own barred line verbatim', async ({ page }) => {
	const mock = new MockApi();
	await mock.install(page);
	// the API's rate-limit lockout, keyed on "barred" (cross-repo marker word)
	await page.route((url) => url.pathname === '/1/auth/login/', (route) => route.fulfill({
		status: 400, contentType: 'application/json',
		body: JSON.stringify({ status: 'error', code: 400, message: 'the door is barred for the night. come back with the tide.' }),
	}));
	await page.goto('/');
	await page.getByPlaceholder('who goes there?').fill('meo');
	await page.getByPlaceholder('passphrase').fill('wrong');
	await page.getByRole('button', { name: 'unlock the office' }).click();
	await expect(page.getByText('the door is barred for the night. come back with the tide.')).toBeVisible();
	await expect(page.getByText('the harbor does not know that name and passphrase.')).toHaveCount(0);
});

test('login lands on the watch room; every read carries the bearer token; drafts stay visible', async ({ page }) => {
	const mock = await signIn(page);
	await expect(toast(page)).toHaveText('⚓ welcome back, keeper. token stowed.');

	// auth on ALL reads; unauth reads are published-only and would lose drafts
	const reads = mock.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/1/'));
	expect(reads.length).toBeGreaterThan(0);
	for (const read of reads) {
		expect(read.headers['authorization'], `${read.path} must be authed`).toBe('Bearer test-token');
	}

	// and the draft light is in the rack
	await nav(page, 'the light list').click();
	await expect(page.getByText('The home lab', { exact: true })).toBeVisible();
	await expect(page.getByText('○ draft')).toBeVisible();
});

test('a stowed token is revalidated on boot', async ({ page }) => {
	const mock = await signIn(page);
	await page.reload();
	await expect(page.getByText('quick errands')).toBeVisible();
	expect(mock.find('GET', /^\/1\/auth\/validate\/$/).length).toBeGreaterThan(0);
});

test('go ashore drops the token and returns to the door', async ({ page }) => {
	const mock = await signIn(page);
	await page.getByText('← go ashore').click();
	await expect(page.getByText("The Keeper's Office")).toBeVisible();
	expect(mock.find('GET', /^\/1\/auth\/logout\/$/)).toHaveLength(1);
	// the stowed session is gone; a reload stays at the door
	await page.reload();
	await expect(page.getByText("The Keeper's Office")).toBeVisible();
});
