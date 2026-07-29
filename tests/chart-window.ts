// The public Helm's projection, transcribed from the island (argsea-site
// src/components/islands/Helm.tsx) with the ratified southward push the banked
// canon carries. The office's drop math must be its exact inverse: a berth
// pinned here has to project back to the pixel it was dropped on, or it renders
// off its mark on the live site. Every drop assertion round-trips a written
// coord through this proj().
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2)) * R2D;

export const WEST = -8.30, EAST = -6.10, SOUTH = 57.80, NORTH = 58.70;

export const proj = (c: { lat: number; lon: number }) => ({
	x: ((c.lon - WEST) / (EAST - WEST)) * 100,
	y: ((mercY(NORTH) - mercY(c.lat)) / (mercY(NORTH) - mercY(SOUTH))) * 100,
});

export const MEMORIAL = { lat: 58.2882, lon: -7.5872 };

export const mark = (page: Page, key: string) => page.locator(`[data-mark][data-key="${key}"]`);

// The center of an absolutely-anchored mark (translate(-50%,-50%)) is its
// bearing's projected position; read it back as a percent of the chart band.
export async function markPercent(page: Page, key: string): Promise<{ x: number; y: number }> {
	const band = await page.locator('.chart-band').boundingBox();
	const box = await mark(page, key).boundingBox();
	if (!band || !box) {
		throw new Error('missing bounding box');
	}
	return {
		x: ((box.x + box.width / 2 - band.x) / band.width) * 100,
		y: ((box.y + box.height / 2 - band.y) / band.height) * 100,
	};
}

// Drag a mark (by its glyph, the sole grab target) to a percent of the band, or
// to an absolute point when the drop is meant to land off the waters.
export async function dragMark(page: Page, key: string, to: { x: number; y: number } | { at: { x: number; y: number } }) {
	const band = await page.locator('.chart-band').boundingBox();
	const glyph = await mark(page, key).locator('.chart-mark__glyph').boundingBox();
	if (!band || !glyph) {
		throw new Error('missing bounding box');
	}
	const target = 'at' in to ? to.at : { x: band.x + band.width * (to.x / 100), y: band.y + band.height * (to.y / 100) };
	await page.mouse.move(glyph.x + glyph.width / 2, glyph.y + glyph.height / 2);
	await page.mouse.down();
	await page.mouse.move(target.x, target.y, { steps: 8 });
	await page.mouse.up();
}

export async function dragFromShelf(page: Page, key: string, to: { x: number; y: number }) {
	const chipEl = page.locator(`[data-shelf-chip][data-key="${key}"]`);
	await chipEl.scrollIntoViewIfNeeded();
	const chip = await chipEl.boundingBox();
	const band = await page.locator('.chart-band').boundingBox();
	if (!band || !chip) {
		throw new Error('missing bounding box');
	}
	await page.mouse.move(chip.x + chip.width / 2, chip.y + chip.height / 2);
	await page.mouse.down();
	await page.mouse.move(band.x + band.width * (to.x / 100), band.y + band.height * (to.y / 100), { steps: 8 });
	await page.mouse.up();
}

export async function openChartTable(page: Page) {
	await page.locator('.nav-item', { hasText: 'the chart table' }).click();
	await expect(page.locator('.chart-band')).toBeVisible();
	await settle(page);
}

// The sign-in toast sits over the bottom of the chart until it times out, and a
// mouse drop under it lands on the toast instead of the waters.
export async function settle(page: Page) {
	await expect(page.locator('.toast')).toHaveCount(0);
}
