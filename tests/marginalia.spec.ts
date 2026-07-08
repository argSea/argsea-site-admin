import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, nav, toast } from './office';

async function openMarginalia(page: Page, mock: MockApi = new MockApi()): Promise<MockApi> {
	await signIn(page, mock);
	await nav(page, 'marginalia').click();
	return mock;
}

async function dragOnCanvas(page: Page, from: [number, number], to: [number, number]): Promise<void> {
	const box = (await page.locator('.doodle-canvas').boundingBox())!;
	await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 5 });
	await page.mouse.up();
}

test('the desk lists the seeded doodle and opens its editor', async ({ page }) => {
	await openMarginalia(page);
	await expect(page.locator('.doodle-card', { hasText: 'a little wave' })).toBeVisible();

	await page.locator('.doodle-card', { hasText: 'a little wave' }).click();
	await expect(page.getByLabel('doodle name')).toHaveValue('a little wave');
	await expect(page.getByRole('button', { name: 'pen', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'ellipse' })).toHaveCount(0);
});

test('a fresh page draws with the pencil and saves through a POST', async ({ page }) => {
	const mock = await openMarginalia(page);
	await page.getByRole('button', { name: '+ a fresh page' }).click();

	await page.getByRole('button', { name: 'pencil' }).click();
	await dragOnCanvas(page, [.2, .5], [.8, .5]);

	await expect(page.getByText('◍ unsaved')).toBeVisible();
	await page.getByRole('button', { name: 'save', exact: true }).click();
	await expect(toast(page)).toHaveText('✎ a fresh sketch joins the desk');
	await expect(page.getByText('○ saved')).toBeVisible();

	const [post] = mock.find('POST', /^\/1\/doodle\/?$/);
	expect(post.body.name).toBe('untitled doodle');
	expect(post.body.shapes).toHaveLength(1);
	expect(post.body.shapes[0].type).toBe('path');

	await page.getByRole('button', { name: '← the desk' }).click();
	await expect(page.locator('.doodle-card', { hasText: 'untitled doodle' })).toBeVisible();
});
