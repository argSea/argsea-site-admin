import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, nav, toast } from './office';

async function openShop(page: Page, mock: MockApi = new MockApi()): Promise<MockApi> {
	await signIn(page, mock);
	await nav(page, 'the figurehead shop').click();
	return mock;
}

async function dragOnCanvas(page: Page, from: [number, number], to: [number, number]): Promise<void> {
	const box = (await page.locator('.shop-canvas').boundingBox())!;
	await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 5 });
	await page.mouse.up();
}

test('a drawn rect lands in the layers and saves through a POST draft', async ({ page }) => {
	const mock = await openShop(page);
	await page.locator('.card', { hasText: 'Perched' }).getByRole('button', { name: '+ carve a fresh blank' }).click();

	await expect(page.getByText('a bare hull, draw something.')).toBeVisible();
	await page.getByRole('button', { name: 'rect' }).click();
	await dragOnCanvas(page, [.35, .35], [.6, .6]);

	await expect(page.locator('.shop-layer')).toHaveCount(1);
	await expect(page.locator('.shop-layer').getByLabel('layer name')).toHaveValue('rect-1');
	await expect(page.getByText('◍ unsaved')).toBeVisible();

	await page.getByRole('button', { name: 'save', exact: true }).click();
	await expect(toast(page)).toHaveText('♆ a fresh draft joins the shelf');
	await expect(page.getByText('○ saved')).toBeVisible();

	const [post] = mock.find('POST', /^\/1\/figurehead\/designs\/?$/);
	expect(post.body.pose).toBe('perched');
	expect(post.body.viewBox).toBe('0 0 64 74');
	expect(post.body.shapes).toHaveLength(1);
	expect(post.body.shapes[0].type).toBe('rect');
	expect(post.body.shapes[0].w).toBeGreaterThan(0);

	// back on the shelf, the fresh draft hangs with the others
	await page.getByRole('button', { name: '← the shelf' }).click();
	await expect(page.locator('.shelf-row', { hasText: 'untitled figurehead' })).toBeVisible();
});

test('the nodes tool drags an anchor and the reshaped path rides the PUT', async ({ page }) => {
	const mock = await openShop(page);
	await page.locator('.shelf-row', { hasText: 'second fitting' }).getByRole('button', { name: 'open', exact: true }).click();

	await page.getByRole('button', { name: 'nodes' }).click();
	// the name input bubbles the click up to the row; a reliable target
	await page.locator('[data-layer="arc"]').getByLabel('layer name').click();
	await expect(page.locator('.shop-node')).toHaveCount(2);

	const node = page.locator('.shop-node').first();
	const box = (await node.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 30, { steps: 4 });
	await page.mouse.up();

	await page.getByRole('button', { name: 'save', exact: true }).click();
	await expect(toast(page)).toHaveText('♆ design saved to the shelf');

	const [put] = mock.find('PUT', /^\/1\/figurehead\/designs\/fh3$/);
	const arc = put.body.shapes.find((s: { id: string }) => s.id === 'arc');
	expect(arc.d).toMatch(/^M/);
	expect(arc.d).not.toBe('M10 50 C20 20 44 20 54 50');
});

test('undo and redo walk the shapes history', async ({ page }) => {
	await openShop(page);
	await page.locator('.card', { hasText: 'Lying' }).getByRole('button', { name: '+ carve a fresh blank' }).click();

	await page.getByRole('button', { name: 'ellipse' }).click();
	await dragOnCanvas(page, [.3, .3], [.5, .55]);
	await dragOnCanvas(page, [.55, .35], [.7, .6]);
	await expect(page.locator('.shop-layer')).toHaveCount(2);

	await expect(page.getByText('◍ unsaved')).toBeVisible();

	await page.getByTitle('undo').click();
	await expect(page.locator('.shop-layer')).toHaveCount(1);
	await page.getByTitle('undo').click();
	await expect(page.locator('.shop-layer')).toHaveCount(0);
	// undone all the way back to the opened document, clean again
	await expect(page.getByText('○ saved')).toBeVisible();
	await page.getByTitle('redo').click();
	await expect(page.locator('.shop-layer')).toHaveCount(1);
	await expect(page.getByText('◍ unsaved')).toBeVisible();
	await page.getByTitle('redo').click();
	await expect(page.locator('.shop-layer')).toHaveCount(2);
});

test('an armed origin picker disarms on Escape', async ({ page }) => {
	await openShop(page);
	await page.locator('.shelf-row', { hasText: 'second fitting' }).getByRole('button', { name: 'open', exact: true }).click();

	const moonRow = page.locator('[data-layer="moon"]');
	await moonRow.getByLabel('role').selectOption('eyes');
	await moonRow.getByTitle('set the animation origin, then tap the canvas').click();
	await expect(page.getByText('tap the canvas to plant the origin')).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(page.getByText('tap the canvas to plant the origin')).toHaveCount(0);

	// a later canvas tap is an ordinary select tap, not a surprise origin
	const box = (await page.locator('.shop-canvas').boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(page.locator('.shop-origin')).toHaveCount(0);
});

test('role tag and canvas-tapped origin round-trip through the PUT payload', async ({ page }) => {
	const mock = await openShop(page);
	await page.locator('.shelf-row', { hasText: 'second fitting' }).getByRole('button', { name: 'open', exact: true }).click();

	const moonRow = page.locator('[data-layer="moon"]');
	await moonRow.getByLabel('role').selectOption('eyes');
	await moonRow.getByTitle('set the animation origin, then tap the canvas').click();
	await expect(page.getByText('tap the canvas to plant the origin')).toBeVisible();
	const box = (await page.locator('.shop-canvas').boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

	await page.getByRole('button', { name: 'save', exact: true }).click();
	await expect(toast(page)).toHaveText('♆ design saved to the shelf');

	const [put] = mock.find('PUT', /^\/1\/figurehead\/designs\/fh3$/);
	const moon = put.body.shapes.find((s: { id: string }) => s.id === 'moon');
	expect(moon.role).toBe('eyes');
	expect(moon.origin).toHaveLength(2);
	expect(typeof moon.origin[0]).toBe('number');
});

test('the editor warns when the open design is live, or carved', async ({ page }) => {
	await openShop(page);

	// a seed opens under the carved banner, and save offers a copy instead
	const perched = page.locator('.card', { hasText: 'Perched' });
	await perched.locator('.shelf-row', { hasText: 'v1' }).getByRole('button', { name: 'open', exact: true }).click();
	await expect(page.locator('.shop-banner--seed')).toBeVisible();
	await expect(page.getByRole('button', { name: 'save a draft copy' })).toBeVisible();
	await page.getByRole('button', { name: '← the shelf' }).click();

	// publish the draft, open it: editing it now edits the live cat in place
	const draftRow = perched.locator('.shelf-row', { hasText: 'second fitting' });
	await draftRow.getByRole('button', { name: 'publish' }).click();
	await draftRow.getByRole('button', { name: /sure\?/ }).click();
	await draftRow.getByRole('button', { name: 'open', exact: true }).click();
	await expect(page.locator('.shop-banner')).toContainText("it's the live perched cat");
});
