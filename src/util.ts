// import { Buffer } from 'node:buffer'

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
