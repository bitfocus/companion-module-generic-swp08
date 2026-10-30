import { DropdownChoice } from '@companion-module/base'

/** A routing matrix the connection is configured to control. */
export interface MatrixDef {
	/** 1-based matrix number as used on the wire (wire value is `id - 1`). */
	id: number
	/** Human readable label shown in action/feedback dropdowns. */
	label: string
}

export function stripNumber(str: string): string {
	const n = str.indexOf(':')
	if (n > 0) {
		return str.slice(n + 2)
	}
	return str
}

/**
 * Parse a user supplied colour into Companion's 24-bit RGB number.
 *
 * Accepts `#RRGGBB`, `RRGGBB`, `0xRRGGBB`, `#RGB`, `rgb(r, g, b)` and plain
 * decimal numbers (as Companion stores colours). Anything else, including an
 * empty value, gives `undefined` so the button keeps its own colour.
 *
 * @param value Raw value, usually a button's `bg_color` preset variable
 */
export function parseColour(value: unknown): number | undefined {
	if (typeof value === 'number') {
		return Number.isInteger(value) && value >= 0 && value <= 0xffffff ? value : undefined
	}
	if (typeof value !== 'string') return undefined
	const str = value.trim().toLowerCase()
	if (str === '') return undefined

	const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(str)
	if (rgb) {
		const [r, g, b] = rgb.slice(1).map(Number)
		if (r > 255 || g > 255 || b > 255) return undefined
		return (r << 16) | (g << 8) | b
	}

	const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(str)
	if (short)
		return Number.parseInt(
			short
				.slice(1)
				.map((c) => c + c)
				.join(''),
			16,
		)

	const hex = /^(?:#|0x)?([0-9a-f]{6})$/.exec(str)
	if (hex) return Number.parseInt(hex[1], 16)

	if (/^\d+$/.test(str)) return parseColour(Number(str))
	return undefined
}

/** Default for the `unused_port_names` config field. */
export const DEFAULT_UNUSED_PORT_NAMES = 'N/C'

/**
 * True when a router name marks an unused port: empty, or one of the names in
 * `unusedNames`, ignoring any `<number>: ` prefix, case and surrounding spaces.
 *
 * @param label Port name as stored from the router
 * @param unusedNames Comma separated names to treat as unused
 */
export function isUnusedPortName(label: string, unusedNames: string = DEFAULT_UNUSED_PORT_NAMES): boolean {
	const name = stripNumber(label).trim().toUpperCase()
	if (name === '') return true
	return unusedNames.split(',').some((unused) => unused.trim().toUpperCase() === name)
}

/**
 * Parse the `matrices` config field into an ordered, de-duped list of matrices.
 *
 * Accepted forms:
 * - `"1:Video, 2:Audio"` — explicit ids with labels
 * - `"1,2,3"` — explicit ids, auto labelled `Matrix <id>`
 * - `"3"` — a bare count, expands to ids `1..3`
 * - `""` (or only whitespace/garbage) — falls back to a single matrix `fallbackId`
 *
 * Ids are clamped to `1..max`; duplicates keep their first label; the result is
 * sorted ascending by id and always contains at least one entry.
 *
 * @param spec Raw config string
 * @param fallbackId Matrix id to use when nothing valid is supplied
 * @param max Highest legal matrix id for the active protocol mode
 */
export function parseMatrices(spec: string, fallbackId: number, max: number): MatrixDef[] {
	const clamp = (n: number): number => Math.min(Math.max(Math.round(n), 1), max)
	const fallback: MatrixDef[] = [{ id: clamp(fallbackId), label: `Matrix ${clamp(fallbackId)}` }]

	const trimmed = (spec ?? '').trim()
	if (trimmed === '') return fallback

	// Bare count, e.g. "4" -> matrices 1..4
	if (/^\d+$/.test(trimmed)) {
		const count = clamp(Number.parseInt(trimmed, 10))
		return Array.from({ length: count }, (_, i) => ({ id: i + 1, label: `Matrix ${i + 1}` }))
	}

	const byId = new Map<number, string>()
	for (const part of trimmed.split(',')) {
		const token = part.trim()
		if (token === '') continue
		const [idRaw, ...labelRest] = token.split(':')
		const id = Number.parseInt(idRaw.trim(), 10)
		if (!Number.isFinite(id)) continue
		const clamped = clamp(id)
		const label = labelRest.join(':').trim() || `Matrix ${clamped}`
		if (!byId.has(clamped)) byId.set(clamped, label)
	}

	if (byId.size === 0) return fallback

	return Array.from(byId.entries())
		.sort((a, b) => a[0] - b[0])
		.map(([id, label]) => ({ id, label }))
}

/**
 * Variable name for the source routed to a destination on a level.
 *
 * The primary matrix keeps the historic un-namespaced name so existing buttons
 * and hand-written expressions keep working; other matrices get a scoped name.
 */
export function getRouteVariableName(level: number, dest: number, matrix: number, primaryMatrix: number): string {
	return matrix === primaryMatrix ? `Route_${level}_${dest}` : `Route_Matrix_${matrix}_${level}_${dest}`
}

export function checkSourceDestRange(srcDst: number, action: string, max: number = 0xffff): void {
	if (!Number.isInteger(srcDst) || srcDst < 1 || srcDst > max) {
		throw new Error(`${action}has been passed an out of range variable ${srcDst}`)
	}
}

export function getHighestKey(map: Map<number, DropdownChoice>): number | undefined {
	if (map.size === 0) return undefined
	return Math.max(...map.keys())
}

export function mapNamesToTemplateValues(
	names: Map<number, DropdownChoice>,
	type: 'Source' | 'Destination',
): { name: string; value: number | string }[] {
	return Array.from(names.values()).map((entry) => ({
		name: `Select ${type} ${entry.label}`,
		value: entry.id,
	}))
}
