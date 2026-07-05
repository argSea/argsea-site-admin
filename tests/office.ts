// Shared spec plumbing: install the mock, walk through the front door.
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MockApi } from './mock-api';

export async function signIn(page: Page, mock: MockApi = new MockApi()): Promise<MockApi> {
	await mock.install(page);
	await page.goto('/');
	await page.getByPlaceholder('who goes there?').fill('meo');
	await page.getByPlaceholder('passphrase').fill('lantern');
	await page.getByRole('button', { name: 'unlock the office' }).click();
	await expect(page.getByText('quick errands')).toBeVisible();
	return mock;
}

export function nav(page: Page, label: string) {
	return page.locator('.nav-item', { hasText: label });
}

export function toast(page: Page) {
	return page.locator('.toast');
}
