import { describe, expect, it } from 'vitest'
import { buttonOrPageExpression, crosspointTextExpression } from './presets.js'
import {
	checkSourceDestRange,
	getHighestKey,
	isUnusedPortName,
	parseColour,
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
		expect(getRouteVariableName(1, 5, 1, 1)).toBe('Route_1_5')
		expect(getRouteVariableName(17, 128, 1, 1)).toBe('Route_17_128')
	})

	it('scopes the name for a non-primary matrix', () => {
		expect(getRouteVariableName(1, 5, 2, 1)).toBe('Route_Matrix_2_1_5')
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

describe('isUnusedPortName', () => {
	it('treats N/C and empty names as unused', () => {
		expect(isUnusedPortName('N/C')).toBe(true)
		expect(isUnusedPortName('12: n/c ')).toBe(true)
		expect(isUnusedPortName('')).toBe(true)
		expect(isUnusedPortName('MN MV OUT 1')).toBe(false)
		expect(isUnusedPortName('3: DVB IN 1')).toBe(false)
	})

	it('uses a custom comma separated list of names', () => {
		expect(isUnusedPortName('Spare', 'n/c, spare')).toBe(true)
		expect(isUnusedPortName('4: NOT USED', 'Not Used')).toBe(true)
		expect(isUnusedPortName('N/C', 'Spare')).toBe(false)
		expect(isUnusedPortName('N/C', '')).toBe(false)
		expect(isUnusedPortName('', 'Spare')).toBe(true)
	})
})

describe('crosspointTextExpression', () => {
	it('hides the destination name only for 0 or false, so empty shows it', () => {
		const text = crosspointTextExpression('$(c:Source_$(local:source))', '$(c:Destination_$(local:dest))')
		const showDest = buttonOrPageExpression('show_dest_name')
		expect(text).toBe(
			`${showDest} == '0' || ${showDest} == 'false'` +
				" ? parseVariables('$(c:Source_$(local:source))')" +
				" : parseVariables('$(c:Source_$(local:source))\\n>\\n$(c:Destination_$(local:dest))')",
		)
		expect(text).not.toContain('$(page:')
	})
})

describe('parseColour', () => {
	it('accepts hex, short hex, rgb() and numbers', () => {
		expect(parseColour('#204080')).toBe(0x204080)
		expect(parseColour('204080')).toBe(0x204080)
		expect(parseColour('0xFF0000')).toBe(0xff0000)
		expect(parseColour('#f00')).toBe(0xff0000)
		expect(parseColour('rgb(32, 64, 128)')).toBe(0x204080)
		expect(parseColour(255)).toBe(255)
		expect(parseColour('255')).toBe(255)
	})

	it('ignores empty and invalid values', () => {
		expect(parseColour('')).toBeUndefined()
		expect(parseColour(undefined)).toBeUndefined()
		expect(parseColour('blue')).toBeUndefined()
		expect(parseColour('rgb(300, 0, 0)')).toBeUndefined()
		expect(parseColour(-1)).toBeUndefined()
	})
})

describe('buttonOrPageExpression', () => {
	it('prefers a set button value, then falls back to the page variable', () => {
		const local = 'concat($(local:bg_color))'
		const page = "parseVariables(concat('$', '(page:bg_color)'))"
		expect(buttonOrPageExpression('bg_color')).toBe(`(${local} == '' || ${local} == '$NA' ? ${page} : ${local})`)
		// a literal $(page:...) gets rewritten to the connection label by Companion
		expect(buttonOrPageExpression('bg_color')).not.toContain('$(page:')
	})
})
