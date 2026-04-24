import { DropdownChoice } from '@companion-module/base'

export function stripNumber(str: string): string {
	const n = str.indexOf(':')
	if (n > 0) {
		return str.slice(n + 2)
	}
	return str
}

export function getRouteVariableName(level: number, dest: number): string {
	return `Route_${level}_${dest}`
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
