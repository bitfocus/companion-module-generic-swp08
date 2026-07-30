import { describe, expect, it } from 'vitest'
import {
	checkSourceDestRange,
	getHighestKey,
	getRouteVariableName,
	mapNamesToTemplateValues,
	stripNumber,
} from './util.js'

describe('stripNumber', () => {
	it('strips a leading "N: " style prefix', () => {
		expect(stripNumber('12: Camera 1')).toBe('Camera 1')
	})

	it('returns the string unchanged when there is no colon', () => {
		expect(stripNumber('Camera 1')).toBe('Camera 1')
	})

	it('returns the string unchanged when the colon is the first character', () => {
		expect(stripNumber(': Camera 1')).toBe(': Camera 1')
	})
})

describe('getRouteVariableName', () => {
	it('builds a stable Route_<level>_<dest> variable name', () => {
		expect(getRouteVariableName(1, 5)).toBe('Route_1_5')
		expect(getRouteVariableName(17, 128)).toBe('Route_17_128')
	})
})

describe('checkSourceDestRange', () => {
	it('does not throw for values within range', () => {
		expect(() => checkSourceDestRange(1, 'test')).not.toThrow()
		expect(() => checkSourceDestRange(0xffff, 'test')).not.toThrow()
	})

	it('throws for 0, the "nothing selected" sentinel', () => {
		expect(() => checkSourceDestRange(0, 'test')).toThrow(/out of range/)
	})

	it('throws for non-integer or out of range values', () => {
		expect(() => checkSourceDestRange(1.5, 'test')).toThrow()
		expect(() => checkSourceDestRange(-1, 'test')).toThrow()
		expect(() => checkSourceDestRange(10, 'test', 5)).toThrow()
	})
})

describe('getHighestKey', () => {
	it('returns undefined for an empty map', () => {
		expect(getHighestKey(new Map())).toBeUndefined()
	})

	it('returns the highest numeric key', () => {
		const map = new Map([
			[1, { id: 1, label: 'a' }],
			[42, { id: 42, label: 'b' }],
			[7, { id: 7, label: 'c' }],
		])
		expect(getHighestKey(map)).toBe(42)
	})
})

describe('mapNamesToTemplateValues', () => {
	it('maps names into preset dropdown-style entries', () => {
		const map = new Map([[1, { id: 1, label: 'Camera 1' }]])
		expect(mapNamesToTemplateValues(map, 'Source')).toEqual([{ name: 'Select Source Camera 1', value: 1 }])
	})
})
