import { test, expect } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn } from './office';

async function badHail(page: import('@playwright/test').Page, pass: string): Promise<void> {
	await page.getByPlaceholder('who goes there?').fill('meo');
	await page.getByPlaceholder('passphrase').fill(pass);
	await page.getByRole('button', { name: 'unlock the office' }).click();
}

test('a failed hail floods the door with a rickroll, and it multiplies', async ({ page }) => {
	const mock = new MockApi();
	await mock.install(page);
	await page.goto('/');

	const frames = page.locator('iframe[src*="dQw4w9WgXcQ"]');
	await expect(frames).toHaveCount(0);

	// first miss: one autoplaying frame
	await badHail(page, 'wrong');
	await expect(frames).toHaveCount(1);
	await expect(frames.first()).toHaveAttribute('src', /autoplay=1/);

	// and the console marked its own hail so the API answered JSON, not the trap
	const login = mock.find('POST', /\/1\/auth\/login\/$/);
	expect(login.length).toBeGreaterThan(0);
	expect(login[login.length - 1].headers['x-argsea-console']).toBe('1');

	// second miss: the flood multiplies (1 -> 4)
	await badHail(page, 'wrong-again');
	await expect(frames).toHaveCount(4);

	// keeper register on the miss, never a raw error
	await expect(page.getByText('the harbor does not know that name and passphrase.')).toBeVisible();
});

test('a good hail proceeds with no flood', async ({ page }) => {
	await signIn(page);
	await expect(page.locator('iframe[src*="dQw4w9WgXcQ"]')).toHaveCount(0);
});
