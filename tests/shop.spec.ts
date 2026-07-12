import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, nav, toast } from './office';

async function openShop(page: Page, mock: MockApi = new MockApi()): Promise<MockApi> {
	await signIn(page, mock);
	await nav(page, 'the carving shop').click();
	await expect(page.locator('.carving-bench')).toBeVisible();
	return mock;
}

function tool(page: Page, name: string) {
	return page.locator(`.carving-tool[title^="${name}"]`);
}

async function drawOnBench(page: Page, from: [number, number], to: [number, number]): Promise<void> {
	const box = (await page.locator('.carving-canvas').boundingBox())!;
	await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 6 });
	await page.mouse.up();
}

test('the catalog groups every carving by page: seven spots plus three catalog-only rows', async ({ page }) => {
	await openShop(page);
	await page.locator('.carving-picker').click();

	const catalog = page.locator('.carving-catalog');
	await expect(catalog.locator('.carving-catalog__count')).toHaveText('10 on the books · 0 fresh');
	await expect(catalog.locator('.carving-tile')).toHaveCount(10);

	for (const name of ['The lighthouse', 'The little boat', 'Message in a bottle', 'Tower on the horizon', 'Paw print', 'The wave line', 'The boat wake', 'Postage lighthouse', 'The wreck', 'The harbor cat']) {
		await expect(catalog.getByText(name, { exact: true })).toBeVisible();
	}
});

test('the default bench holds the lighthouse; the catalog popover swaps the selection', async ({ page }) => {
	await openShop(page);
	await expect(page.locator('.carving-picker__name')).toHaveText('The lighthouse');

	await page.locator('.carving-picker').click();
	await page.locator('.carving-tile[title*="sails the hero"]').click();
	await expect(page.locator('.carving-catalog')).toHaveCount(0);
	await expect(page.locator('.carving-picker__name')).toHaveText('The little boat');
});

test('a builtin carving is locked; copying it makes a fresh, editable block', async ({ page }) => {
	const mock = await openShop(page);

	// the lighthouse (bolted to lighthouse-logo) is the default bench selection,
	// a builtin: tools step back and the markup is read-only
	await expect(tool(page, 'select')).toBeDisabled();
	await page.locator('.carving-drawer__head').click();
	await expect(page.getByLabel('carving source, locked')).toHaveAttribute('readonly', '');

	await page.getByRole('button', { name: 'copy to a fresh block' }).click();
	await expect(toast(page)).toHaveText('⚒ a fresh block joins the catalog');
	await expect(page.locator('.carving-picker__name')).toHaveText('The lighthouse copy');

	await page.locator('.carving-drawer__head').click();
	await expect(page.getByLabel('carving source', { exact: true })).toBeVisible();

	const [post] = mock.find('POST', /^\/1\/carving\/carvings\/?$/);
	expect(post.body.name).toBe('The lighthouse copy');
	expect(post.body.svg).toContain('<svg');
});

test('a fresh block draws and its saved wire carries the serialized model island', async ({ page }) => {
	const mock = await openShop(page);

	await page.getByRole('button', { name: '+ a fresh block' }).click();
	await expect(page.locator('.carving-picker__name')).toHaveText('fresh carving no. 1');
	await expect(page.getByText('◍ unsaved')).toBeVisible();

	await tool(page, 'pencil').click();
	await drawOnBench(page, [.25, .5], [.75, .5]);

	await page.locator('.carving-save').click();
	await expect(toast(page)).toHaveText('⚒ a fresh block joins the catalog');
	await expect(page.getByText('○ saved')).toBeVisible();

	// nextId starts at 100; this is the test's first created document
	const [post] = mock.find('POST', /^\/1\/carving\/carvings\/?$/);
	expect(post.body.svg).toContain('<metadata id="argsea-carving-model">');
	expect(post.body.svg).toContain('<path');

	// a second save edits the same doc through a full-replace PUT, island intact
	await drawOnBench(page, [.3, .3], [.6, .7]);
	await page.locator('.carving-save').click();
	await expect(toast(page)).toHaveText('⚒ carving saved to the bench');
	const [put] = mock.find('PUT', /^\/1\/carving\/carvings\/cv100$/);
	expect(put.body.svg).toContain('<metadata id="argsea-carving-model">');
});

test('reopening a model-backed carving restores its editable shapes', async ({ page }) => {
	await openShop(page);

	await page.getByRole('button', { name: '+ a fresh block' }).click();
	await tool(page, 'pencil').click();
	await drawOnBench(page, [.25, .5], [.75, .5]);
	await page.locator('.carving-save').click();
	await expect(page.getByText('○ saved')).toBeVisible();

	await nav(page, 'the watch room').click();
	await nav(page, 'the carving shop').click();

	await page.locator('.carving-picker').click();
	await page.locator('.carving-tile', { hasText: 'fresh carving no. 1' }).click();

	// the island restores the model: tools are live, and the markup carries both
	// the island and the drawn element, so the shape survived deserialization
	await expect(tool(page, 'select')).toBeEnabled();
	await page.locator('.carving-drawer__head').click();
	const reopened = page.getByLabel('carving source', { exact: true });
	await expect(reopened).toContainText('<metadata id="argsea-carving-model">');
	await expect(reopened).toContainText('<path');
});

test('hand-editing the markup drops the island and steps the tools back', async ({ page }) => {
	await openShop(page);

	await page.getByRole('button', { name: '+ a fresh block' }).click();
	await expect(tool(page, 'select')).toBeEnabled();
	const source = page.getByLabel('carving source', { exact: true });
	await expect(source).toContainText('<metadata id="argsea-carving-model">');

	await source.fill('<svg viewBox="0 0 10 10"><rect width="10" height="10"></rect></svg>');
	await expect(tool(page, 'select')).toBeDisabled();
	await expect(page.locator('.carving-canvas--locked')).toBeVisible();
});

test('a hand edit that keeps the island still saves a clean wire, no stale model', async ({ page }) => {
	const mock = await openShop(page);

	// a saved fresh block: its drawer still carries the machine-written island
	await page.getByRole('button', { name: '+ a fresh block' }).click();
	await tool(page, 'pencil').click();
	await drawOnBench(page, [.25, .5], [.75, .5]);
	await page.locator('.carving-save').click();
	await expect(toast(page)).toHaveText('⚒ a fresh block joins the catalog');

	const source = page.getByLabel('carving source', { exact: true });
	const withIsland = await source.inputValue();
	expect(withIsland).toContain('<metadata id="argsea-carving-model">');

	// hand-edit the visible markup but leave the island block sitting in the text
	await source.fill(withIsland.replace('</svg>', '<rect x="1" y="1" width="4" height="4"></rect></svg>'));
	await expect(tool(page, 'select')).toBeDisabled();

	// the raw save must drop our island, or reopening resurrects the pre-edit
	// shapes and the next save silently reverts this hand edit
	await page.locator('.carving-save').click();
	await expect(toast(page)).toHaveText('⚒ carving saved to the bench');
	const [put] = mock.find('PUT', /^\/1\/carving\/carvings\/cv100$/);
	expect(put.body.svg).not.toContain('<metadata id="argsea-carving-model">');
	expect(put.body.svg).toContain('<rect');
});

test('leaving a dirty bench asks before it tosses the carving', async ({ page }) => {
	await openShop(page);

	// a fresh block with a drawn stroke: dirty, and never saved to the catalog
	await page.getByRole('button', { name: '+ a fresh block' }).click();
	await tool(page, 'pencil').click();
	await drawOnBench(page, [.25, .5], [.75, .5]);
	await expect(page.getByText('◍ unsaved')).toBeVisible();

	// picking another carving arms the confirm and holds the bench where it is
	await page.locator('.carving-picker').click();
	await page.locator('.carving-tile[title*="sails the hero"]').click();
	await expect(page.locator('.carving-catalog__confirm')).toBeVisible();
	await expect(page.locator('.carving-picker__name')).toHaveText('fresh carving no. 1');

	// a second click confirms: it switches, and the discarded draft never landed
	await page.locator('.carving-tile[title*="sails the hero"]').click();
	await expect(page.locator('.carving-picker__name')).toHaveText('The little boat');

	await page.locator('.carving-picker').click();
	await expect(page.locator('.carving-tile', { hasText: 'fresh carving no. 1' })).toHaveCount(0);
});

test('the ghost renders behind the block and never intercepts the pointer', async ({ page }) => {
	await openShop(page);

	// a fresh block off the default lighthouse spot ghosts its current holder
	await page.getByRole('button', { name: '+ a fresh block' }).click();
	const ghost = page.locator('.carving-ghost');
	await expect(ghost).toHaveCount(1);
	expect(await ghost.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');

	// drawing straight over the ghost still lands a stroke on the block
	await tool(page, 'pencil').click();
	await drawOnBench(page, [.3, .4], [.7, .6]);
	await expect(page.getByLabel('carving source', { exact: true })).toContainText('<path');
});

test('the zoom cluster drives the canvas and fit resets it', async ({ page }) => {
	await openShop(page);
	const pct = page.locator('.carving-zoom__pct');
	await expect(pct).toHaveText('100%');

	await page.locator('.carving-zoom__btn[title="zoom in"]').click();
	await expect(pct).not.toHaveText('100%');

	await page.locator('.carving-zoom__fit').click();
	await expect(pct).toHaveText('100%');
});

test('the tool palette drags by its grip and collapses to nothing', async ({ page }) => {
	await openShop(page);
	const pal = page.locator('.carving-pal');
	const before = (await pal.boundingBox())!;

	const grip = page.locator('.carving-pal__grip');
	const g = (await grip.boundingBox())!;
	await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
	await page.mouse.down();
	await page.mouse.move(g.x + 140, g.y + 60, { steps: 6 });
	await page.mouse.up();

	const after = (await pal.boundingBox())!;
	expect(after.x).toBeGreaterThan(before.x + 40);

	await page.locator('.carving-pal__toggle').click();
	await expect(page.locator('.carving-tool')).toHaveCount(0);
});

test('bolting swaps a spot from its previous holder to the newly bolted carving', async ({ page }) => {
	const mock = await openShop(page);

	await page.locator('.carving-picker').click();
	await page.locator('.carving-tile[title*="sails the hero"]').click();
	await expect(page.locator('.carving-picker__name')).toHaveText('The little boat');

	await page.getByLabel('bolt it to').selectOption('lighthouse-logo');
	await page.locator('.carving-bolt').click();
	await expect(toast(page)).toHaveText('⚒ "The little boat" bolted to the lighthouse. ships with the next hoist.');

	const [bolt] = mock.find('POST', /^\/1\/carving\/carvings\/cv-boat\/bolt$/);
	expect(bolt.body.spot).toBe('lighthouse-logo');

	// the lighthouse-logo spot now opens the boat's carving, not the seed cat
	await page.locator('.carving-picker').click();
	await page.locator('.carving-tile[title*="nav, top left"]').click();
	await expect(page.locator('.carving-picker__name')).toHaveText('The little boat');
});

test('a saved fresh block survives navigation: it waits under the bench group and can be bolted', async ({ page }) => {
	const mock = await openShop(page);

	await page.getByRole('button', { name: '+ a fresh block' }).click();
	await page.locator('.carving-save').click();
	await expect(toast(page)).toHaveText('⚒ a fresh block joins the catalog');

	await nav(page, 'the watch room').click();
	await nav(page, 'the carving shop').click();

	await page.locator('.carving-picker').click();
	await expect(page.locator('.carving-catalog__page', { hasText: 'the bench' })).toBeVisible();
	await page.locator('.carving-tile', { hasText: 'fresh carving no. 1' }).click();
	await expect(page.locator('.carving-picker__name')).toHaveText('fresh carving no. 1');

	await page.getByLabel('bolt it to').selectOption('paw');
	await page.locator('.carving-bolt').click();
	await expect(toast(page)).toHaveText('⚒ "fresh carving no. 1" bolted to paw print. ships with the next hoist.');
	const [bolt] = mock.find('POST', /^\/1\/carving\/carvings\/cv100\/bolt$/);
	expect(bolt.body.spot).toBe('paw');
});

test('a displaced seed waits under the bench group; re-bolting it restores its spot', async ({ page }) => {
	const mock = await openShop(page);

	// a fresh block takes the lighthouse spot (the default assign), displacing v1
	await page.getByRole('button', { name: '+ a fresh block' }).click();
	await page.locator('.carving-save').click();
	await expect(toast(page)).toHaveText('⚒ a fresh block joins the catalog');
	await page.locator('.carving-bolt').click();
	await expect(toast(page)).toHaveText('⚒ "fresh carving no. 1" bolted to the lighthouse. ships with the next hoist.');

	// the seed is not orphaned: it waits under the bench group, still locked
	await page.locator('.carving-picker').click();
	const benchGroup = page.locator('.carving-catalog__group', { hasText: 'the bench' });
	await benchGroup.locator('.carving-tile', { hasText: 'The lighthouse' }).click();
	await expect(page.locator('.carving-picker__name')).toHaveText('The lighthouse');
	await expect(tool(page, 'select')).toBeDisabled();

	// re-bolting the seed is the unbolt path: the spot goes back to v1
	await page.locator('.carving-bolt').click();
	await expect(toast(page)).toHaveText('⚒ "The lighthouse" bolted to the lighthouse. ships with the next hoist.');
	const [bolt] = mock.find('POST', /^\/1\/carving\/carvings\/cv-lighthouse\/bolt$/);
	expect(bolt.body.spot).toBe('lighthouse-logo');

	// the fresh block is displaced in turn, back onto the bench group
	await page.locator('.carving-picker').click();
	await expect(benchGroup.locator('.carving-tile', { hasText: 'fresh carving no. 1' })).toBeVisible();
});

test('a catalog-only row shows its note and offers no bench', async ({ page }) => {
	await openShop(page);

	await page.locator('.carving-picker').click();
	await page.locator('.carving-tile', { hasText: 'The wreck' }).click();

	await expect(page.locator('.carving-picker__name')).toHaveText('The wreck');
	await expect(page.getByText('· not on this bench · see the note below ·')).toBeVisible();
	await expect(page.getByText('salvage rights unresolved. edit it where it lies (404.dc.html).')).toBeVisible();
	await expect(page.locator('.carving-canvas')).toHaveCount(0);
	await expect(page.locator('.carving-bolt')).toHaveCount(0);
});

test('an empty block cannot bolt', async ({ page }) => {
	await openShop(page);

	await page.getByRole('button', { name: '+ a fresh block' }).click();
	await page.getByLabel('carving source', { exact: true }).fill('');
	await page.locator('.carving-save').click();
	await expect(toast(page)).toHaveText('⚒ a fresh block joins the catalog');

	await expect(page.locator('.carving-bolt')).toBeDisabled();
});

test('an unsaved draft cannot bolt: the bolt waits for the saved block', async ({ page }) => {
	const mock = await openShop(page);

	await page.getByRole('button', { name: '+ a fresh block' }).click();
	// a brand-new block has nothing persisted to bolt yet
	await expect(page.locator('.carving-bolt')).toBeDisabled();

	await tool(page, 'pencil').click();
	await drawOnBench(page, [.25, .5], [.75, .5]);
	await expect(page.getByText('◍ unsaved')).toBeVisible();
	await expect(page.locator('.carving-bolt')).toBeDisabled();
	expect(mock.find('POST', /\/bolt$/)).toHaveLength(0);

	await page.locator('.carving-save').click();
	await expect(page.getByText('○ saved')).toBeVisible();
	await expect(page.locator('.carving-bolt')).toBeEnabled();
});

test('blanking a bolted carving is caught on the bench, before the wire', async ({ page }) => {
	const mock = await openShop(page);

	await page.getByRole('button', { name: '+ a fresh block' }).click();
	await page.locator('.carving-save').click();
	await expect(toast(page)).toHaveText('⚒ a fresh block joins the catalog');
	await page.locator('.carving-bolt').click();
	await expect(toast(page)).toHaveText('⚒ "fresh carving no. 1" bolted to the lighthouse. ships with the next hoist.');

	// the server would 409 this PUT; the bench pre-checks it and never sends
	await page.getByLabel('carving source', { exact: true }).fill('');
	await page.locator('.carving-save').click();
	await expect(toast(page)).toHaveText('⚠ a bolted carving cannot go blank, unbolt the spot first');
	expect(mock.find('PUT', /^\/1\/carving\/carvings\/cv100$/)).toHaveLength(0);
});

test('bolting a carving onto the spot it already holds says so instead of going quiet', async ({ page }) => {
	const mock = await openShop(page);

	// the seed lighthouse already holds the default pick, lighthouse-logo
	await expect(page.locator('.carving-picker__name')).toHaveText('The lighthouse');
	await page.locator('.carving-bolt').click();
	await expect(toast(page)).toHaveText('⚒ "The lighthouse" already holds the lighthouse. the bolt is tight.');
	expect(mock.find('POST', /\/bolt$/)).toHaveLength(0);
});

test("the figurehead entity keeps its frozen glyph in the keeper's log; the carving shop no longer edits it", async ({ page }) => {
	const mock = new MockApi();
	mock.activity.unshift({
		id: 'a0', timestamp: '2026-07-05T10:00:00Z',
		message: 'figurehead "second fitting" saved', entityType: 'figurehead', entityId: 'fh3',
	});
	await signIn(page, mock);

	const row = page.locator('span[title="figurehead"]');
	await expect(row.first()).toHaveText('♆');
	await expect(page.getByText('figurehead "second fitting" saved')).toBeVisible();
});
