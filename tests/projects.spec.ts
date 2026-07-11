import { test, expect } from '@playwright/test';
import { signIn, nav, toast } from './office';

test('a new light is filed as a draft, defaulting to fixed white and no gallery', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	await page.getByRole('button', { name: '+ kindle a light' }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('title').fill('Test Light');
	await overlay.getByLabel('the register line · short description').fill('a light for testing');
	await overlay.getByLabel('the entry · the full story').fill('para one\n\npara two');
	await overlay.getByRole('button', { name: 'file it' }).click();

	await expect(toast(page)).toHaveText('🕯 a light was kindled, into the rack');
	await expect(page.getByText('Test Light')).toBeVisible();

	const [create] = mock.find('POST', /^\/1\/project\/$/);
	expect(create.body.title).toBe('Test Light');
	expect(create.body.status).toBe('draft');
	expect(create.body.body).toBe('<p>para one</p>\n<p>para two</p>');
	expect(create.body.light).toEqual({ kind: 'fixed', color: 'white', period: 0, letter: '', extinguished: '' });
	expect(create.body.images).toEqual([]);
	// the postcard-era fields are dormant now; a fresh light never invents any of them
	expect('stamp' in create.body).toBe(false);
	expect('postcardTo' in create.body).toBe(false);
	expect('image' in create.body).toBe(false);
});

test('editing a light preserves the dormant postcard-era fields (full-replace pass-through)', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	const row = page.locator('.content-row', { hasText: 'The Great Un-monolithing' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('title').fill('The Great Un-monolithing, renamed');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	// none of these ride the form anymore; without the pass-through spread
	// this full-replace PUT would wipe them on the very first edit
	const [put] = mock.find('PUT', /^\/1\/project\/p1$/);
	expect(put.body.title).toBe('The Great Un-monolithing, renamed');
	expect(put.body.postcardTo).toBe('everyone');
	expect(put.body.postcardFrom).toBe('justin');
	expect(put.body.postmarked).toBe('2024 – ongoing');
	expect(put.body.stamp).toEqual({ shape: 'rect', motif: 'lighthouse', ink: '#f0d9a8', cents: '3¢' });
	expect(put.body.image).toBe('unmonolith-diagram.png');
});

test('a morse light\'s letter rides the full-replace PUT unharmed', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	const row = page.locator('.content-row', { hasText: 'This website' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('title').fill('This website, renamed');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	// letter never touches the form on a title-only edit; without it riding
	// through with the rest of light this PUT would clear the letter to ""
	const [put] = mock.find('PUT', /^\/1\/project\/p4$/);
	expect(put.body.title).toBe('This website, renamed');
	expect(put.body.light.kind).toBe('morse');
	expect(put.body.light.letter).toBe('J');
});

test('editing a stampless light never invents a stamp ({} is invalid, omit entirely)', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	const row = page.locator('.content-row', { hasText: 'The home lab' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('title').fill('The home lab, renamed');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p3$/);
	expect(put.body.title).toBe('The home lab, renamed');
	expect('stamp' in put.body).toBe(false);
	// full-replace: the complete document went over the wire
	expect(put.body.shortDesc).toBeTruthy();
	expect(put.body.tags.length).toBeGreaterThan(0);
});

test('the kind chips drive the mono code and hide the rhythm slider on fixed', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the light list').click();
	const row = page.locator('.content-row', { hasText: 'The Great Un-monolithing' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	// seeded flash, white, 8s
	await expect(overlay.getByText('Fl W 8s')).toBeVisible();
	await expect(overlay.getByText('every 8 seconds', { exact: true })).toBeVisible();

	await overlay.getByText('occulting', { exact: true }).click();
	await expect(overlay.getByText('Oc W 8s')).toBeVisible();

	await overlay.getByText('fixed · steady', { exact: true }).click();
	await expect(overlay.getByText('F W', { exact: true })).toBeVisible();
	await expect(overlay.locator('input[type="range"]')).toHaveCount(0);

	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');
});

test('quick and veryquick hide the rhythm slider; morse shows a 6-30s range and a letter picker that clears when the kind moves on', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the light list').click();
	const row = page.locator('.content-row', { hasText: 'The Great Un-monolithing' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	// seeded flash, white, 8s: the slider starts visible
	await expect(overlay.locator('input[type="range"]')).toHaveCount(1);

	await overlay.getByText('quick', { exact: true }).click();
	await expect(overlay.getByText('Q W', { exact: true })).toBeVisible();
	await expect(overlay.locator('input[type="range"]')).toHaveCount(0);
	await expect(overlay.getByLabel('the letter · spelled in morse')).toHaveCount(0);

	await overlay.getByText('very quick', { exact: true }).click();
	await expect(overlay.getByText('VQ W', { exact: true })).toBeVisible();
	await expect(overlay.locator('input[type="range"]')).toHaveCount(0);

	await overlay.getByText('morse', { exact: true }).click();
	const letterPicker = overlay.getByLabel('the letter · spelled in morse');
	await expect(letterPicker).toBeVisible();
	const slider = overlay.locator('input[type="range"]');
	await expect(slider).toHaveCount(1);
	await expect(slider).toHaveAttribute('min', '6');
	await expect(slider).toHaveAttribute('max', '30');
	await expect(overlay.getByText(/^Mo\(.\) W \d+s$/)).toBeVisible();

	await letterPicker.selectOption('Z');
	await expect(overlay.getByText('Mo(Z) W 8s')).toBeVisible();

	// a long morse rhythm clamps into the target slider's range on the way
	// out, so the thumb never pins past its own max with a lying label
	await slider.fill('30');
	await expect(overlay.getByText('every 30 seconds', { exact: true })).toBeVisible();
	await overlay.getByText('flashing', { exact: true }).click();
	await expect(slider).toHaveValue('12');
	await expect(overlay.getByText('every 12 seconds', { exact: true })).toBeVisible();
	await overlay.getByText('morse', { exact: true }).click();

	// leaving morse clears the letter; coming back seeds a fresh one, not the stale pick
	await overlay.getByText('fixed · steady', { exact: true }).click();
	await expect(letterPicker).toHaveCount(0);
	await overlay.getByText('morse', { exact: true }).click();
	await expect(overlay.getByLabel('the letter · spelled in morse')).toHaveValue('A');
});

test('extinguishing a light adds a dark chip on the row, orthogonal to publish state', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	const row = page.locator('.content-row', { hasText: 'Meo Wave Race' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('extinguished').fill('2025');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p2$/);
	expect(put.body.light.extinguished).toBe('2025');
	// publish state never moves through this PUT; the two stay orthogonal
	expect(put.body.status).toBe('published');
	await expect(row.getByText('● published')).toBeVisible();
	await expect(row.getByText('dark · 2025')).toBeVisible();
});

test('the pictures box adds prints and sends images alongside the untouched legacy image', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	const row = page.locator('.content-row', { hasText: 'The Great Un-monolithing' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	// unmonolith-diagram.png already leads the archive (seeded); add a second print
	await expect(overlay.getByText('unmonolith-diagram.png')).toBeVisible();
	await overlay.getByText('homelab-rack.jpg', { exact: true }).click();

	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p1$/);
	expect(put.body.images).toEqual(['unmonolith-diagram.png', 'homelab-rack.jpg']);
	// the legacy single print is untouched pass-through, not re-derived from the archive
	expect(put.body.image).toBe('unmonolith-diagram.png');
});

test('the pictures box marks the first picture as the entry photo and caps the archive at six', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	// Meo Wave Race starts with no pictures; there are 7 seeded prints, one over the cap
	const row = page.locator('.content-row', { hasText: 'Meo Wave Race' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	const box = overlay.locator('.fieldset-dashed', { hasText: 'the pictures' });
	for (const name of ['meo-wave-title.png', 'meo-wave-track1.png', 'meo-wave-track2.png', 'meo-wave-track3.png', 'meo-wave-track4.png', 'unmonolith-diagram.png']) {
		await box.getByText(name, { exact: true }).click();
	}
	// six aboard, the entry photo marker sits on the first one added
	await expect(box.getByText('⚑ entry photo')).toBeVisible();
	// capped: the seventh, untouched print never gets an "add" thumbnail once full
	await expect(box.getByText('homelab-rack.jpg', { exact: true })).toHaveCount(0);

	await overlay.getByRole('button', { name: 'save changes' }).click();
	const [put] = mock.find('PUT', /^\/1\/project\/p2$/);
	expect(put.body.images).toEqual([
		'meo-wave-title.png', 'meo-wave-track1.png', 'meo-wave-track2.png',
		'meo-wave-track3.png', 'meo-wave-track4.png', 'unmonolith-diagram.png',
	]);
});

test('the pictures box search filters the archive client-side', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the light list').click();
	const row = page.locator('.content-row', { hasText: 'Meo Wave Race' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	const box = overlay.locator('.fieldset-dashed', { hasText: 'the pictures' });
	await box.getByPlaceholder('search prints...').fill('meo-wave');
	await expect(box.getByText('meo-wave-title.png')).toBeVisible();
	await expect(box.getByText('homelab-rack.jpg', { exact: true })).toHaveCount(0);
});

test('the facts editor adds heading/fact rows and caps at six', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	const row = page.locator('.content-row', { hasText: 'Meo Wave Race' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	const box = overlay.locator('.fieldset-dashed', { hasText: 'the facts' });
	for (let i = 0; i < 6; i++) {
		await box.getByText('+ add a fact').click();
	}
	// six filed, the add chip is gone
	await expect(box.getByText('+ add a fact')).toHaveCount(0);
	await expect(box.locator('input[placeholder="ownership"]')).toHaveCount(6);

	await box.locator('input[placeholder="ownership"]').first().fill('ownership');
	await box.locator('input[placeholder="design to operations, solo"]').first().fill('design to operations, solo');

	await overlay.getByRole('button', { name: 'save changes' }).click();
	const [put] = mock.find('PUT', /^\/1\/project\/p2$/);
	expect(put.body.facts).toHaveLength(6);
	expect(put.body.facts[0]).toEqual({ heading: 'ownership', fact: 'design to operations, solo' });
});

test('the notes-found-here tie picker writes noteIds both ways and the amber nudge clears once tied', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	// Meo Wave Race starts with no ties and no case study: the nudge should show
	const row = page.locator('.content-row', { hasText: 'Meo Wave Race' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByText('no note, no full log')).toBeVisible();

	await overlay.locator('.fieldset-dashed', { hasText: 'notes found here' }).getByPlaceholder('search the book...').fill('queue');
	await overlay.getByText('+ The queue is the product').click();
	await expect(overlay.getByText('✓ The queue is the product · ✕')).toBeVisible();
	await expect(overlay.getByText('no note, no full log')).toHaveCount(0);

	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p2$/);
	expect(put.body.noteIds).toEqual(['n1']);

	// the other direction: the writing desk's "kept in" box reflects the tie,
	// keyed by the note's stable id, and untying there writes the project back
	await nav(page, 'writing desk').click();
	await page.locator('.note-row', { hasText: 'The queue is the product' }).getByText('edit', { exact: true }).click();
	const noteOverlay = page.locator('.overlay-card');
	const keptIn = noteOverlay.getByRole('button', { name: 'Meo Wave Race' });
	await expect(keptIn).toHaveAttribute('aria-pressed', 'true');
	await keptIn.click();
	await expect.poll(() => mock.find('PUT', /^\/1\/project\/p2$/).length).toBe(2);
	const [, untie] = mock.find('PUT', /^\/1\/project\/p2$/);
	expect(untie.body.noteIds).toEqual([]);
});

test('the publish pill goes through the lifecycle endpoint, not PUT', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	const row = page.locator('.content-row', { hasText: 'The home lab' });
	await row.getByText('○ draft').click();
	await expect(toast(page)).toHaveText('● stamped and published');
	await expect(row.getByText('● published')).toBeVisible();
	expect(mock.find('POST', /^\/1\/project\/p3\/publish$/)).toHaveLength(1);
	expect(mock.find('PUT', /^\/1\/project\/p3$/)).toHaveLength(0);
});

test('the front window only fits three', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();

	// three seeded featured lights; a fourth is refused client-side
	const draftRow = page.locator('.content-row', { hasText: 'The home lab' });
	await draftRow.getByText('☆ feature').click();
	await expect(toast(page)).toHaveText('the window only fits three, take one down first');
	expect(mock.find('POST', /feature$/)).toHaveLength(0);

	// take one down from the window chips, then the spot is free
	await page.locator('.sway-chip', { hasText: 'Meo Wave Race' }).locator('.chip-x').click();
	await expect(toast(page)).toHaveText('☆ taken out of the window');
	expect(mock.find('POST', /^\/1\/project\/p2\/unfeature$/)).toHaveLength(1);

	await draftRow.getByText('☆ feature').click();
	await expect(toast(page)).toHaveText('★ set in the front window');
	expect(mock.find('POST', /^\/1\/project\/p3\/feature$/)).toHaveLength(1);
});

test('moving a light down the rack swaps orders via two reorder calls', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();

	const titles = page.locator('.content-row .row-title');
	await expect(titles.first()).toHaveText('The Great Un-monolithing');

	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByTitle('move down the rack').click();
	await expect(titles.first()).toHaveText('Meo Wave Race');

	const reorders = mock.find('POST', /^\/1\/project\/[^/]+\/reorder$/);
	expect(reorders).toHaveLength(2);
	expect(reorders.find((c) => c.path.includes('p1'))?.body).toEqual({ order: 2 });
	expect(reorders.find((c) => c.path.includes('p2'))?.body).toEqual({ order: 1 });
});

test('striking takes two clicks', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	const row = page.locator('.content-row', { hasText: 'Meo Wave Race' });

	await row.getByText('strike', { exact: true }).click();
	expect(mock.find('DELETE', /^\/1\/project\/p2$/)).toHaveLength(0);
	await row.getByText('sure? strike.').click();
	await expect(toast(page)).toHaveText('🌫 struck from the chart. the fog closes over it.');
	await expect(row).toHaveCount(0);
	expect(mock.find('DELETE', /^\/1\/project\/p2$/)).toHaveLength(1);
});

test('peek renders a project as a light entry: status pill, mono code, decoded line, first lit, moral, and tags', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the light list').click();
	const row = page.locator('.content-row', { hasText: 'This website' });
	await row.getByText('peek', { exact: true }).click();

	const peek = page.locator('.overlay-card');
	await expect(peek.getByText('This website')).toBeVisible();
	await expect(peek.getByText('● lit')).toBeVisible();
	await expect(peek.getByText('Mo(J) W 8s')).toBeVisible();
	await expect(peek.getByText('morse white, blinking J every 8 seconds')).toBeVisible();
	await expect(peek.getByText('first lit')).toBeVisible();
	await expect(peek.getByText('2026')).toBeVisible();
	await expect(peek.getByText('Moral: the portfolio is also the hobby.')).toBeVisible();
	await expect(peek.getByText('html  ·  whimsy')).toBeVisible();

	// the postcard-era fields the peek used to show are gone
	await expect(peek.getByText('to:')).toHaveCount(0);
	await expect(peek.getByText('postmarked:')).toHaveCount(0);
});
