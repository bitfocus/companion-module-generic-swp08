import { Buffer } from 'node:buffer'

export function stripNumber(str) {
	const n = str.indexOf(':')
	if (n > 0) {
		return str.slice(n + 2)
	}
	return str
}
