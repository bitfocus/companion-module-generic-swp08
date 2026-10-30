import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cmds } from '../consts.js'
import { parseMatrices, getRouteVariableName } from '../util.js'
import { createTestInstance, type TestableInstance } from './testHarness.js'

function frame(data: number[]): Buffer {
	const packet = Array.from(data)
	const length = data.length
	let crc = 0
	for (let j = 0; j < packet.length; ++j) {
		crc += packet[j]
		if (packet[j] === 0x10) {
			packet.splice(j, 0, 0x10)
			j++
		}
	}
	crc += length
	const checksum = (~crc + 1) & 0xff
	packet.unshift(0x10, 0x02)
	packet.push(length, checksum, 0x10, 0x03)
	return Buffer.from(packet)
}

describe('parseMatrices', () => {
	it('parses an id:label list', () => {
		expect(parseMatrices('1:Video, 2:Audio', 1, 16)).toEqual([
			{ id: 1, label: 'Video' },
			{ id: 2, label: 'Audio' },
		])
	})

	it('parses a bare id list and auto-labels', () => {
		expect(parseMatrices('1,3,2', 1, 16)).toEqual([
			{ id: 1, label: 'Matrix 1' },
			{ id: 2, label: 'Matrix 2' },
			{ id: 3, label: 'Matrix 3' },
		])
	})

	it('expands a bare count', () => {
		expect(parseMatrices('3', 1, 16)).toEqual([
			{ id: 1, label: 'Matrix 1' },
			{ id: 2, label: 'Matrix 2' },
			{ id: 3, label: 'Matrix 3' },
		])
	})

	it('falls back to the single fallback matrix when blank or unusable', () => {
		expect(parseMatrices('', 2, 16)).toEqual([{ id: 2, label: 'Matrix 2' }])
		expect(parseMatrices('   ', 5, 16)).toEqual([{ id: 5, label: 'Matrix 5' }])
		expect(parseMatrices(':::,', 1, 16)).toEqual([{ id: 1, label: 'Matrix 1' }])
	})

	it('clamps ids into range and de-dupes keeping the first label', () => {
		expect(parseMatrices('0:low, 99:high, 2:two, 2:again', 1, 16)).toEqual([
			{ id: 1, label: 'low' },
			{ id: 2, label: 'two' },
			{ id: 16, label: 'high' },
		])
	})
})

describe('getRouteVariableName', () => {
	it('keeps the historic name for the primary matrix', () => {
		expect(getRouteVariableName(2, 5, 1, 1)).toBe('Route_2_5')
	})
	it('scopes the name for non-primary matrices', () => {
		expect(getRouteVariableName(2, 5, 3, 1)).toBe('Route_Matrix_3_2_5')
	})
})

describe('multi-matrix routing', () => {
	let instance: TestableInstance

	beforeEach(() => {
		;({ instance } = createTestInstance({ matrices: '1:Video, 2:Audio' }))
		instance.sendMessage = vi.fn().mockResolvedValue(undefined)
	})

	it('exposes both matrices and a primary', () => {
		expect(instance.matrices).toEqual([
			{ id: 1, label: 'Video' },
			{ id: 2, label: 'Audio' },
		])
		expect(instance.primaryMatrix).toBe(1)
		expect(instance.selected_matrix).toBe(1)
	})

	it('routes Set crosspoint to the requested matrix', async () => {
		await instance.SetCrosspoint(1, 1, 1, 2)
		expect(instance.sendMessage).toHaveBeenCalledWith([cmds.crosspointConnect, 0x10, 0x00, 0x00, 0x00])
	})

	it('interrogates every configured matrix when none is specified', async () => {
		await instance.getCrosspoints(3, 1)
		expect(instance.sendMessage).toHaveBeenCalledTimes(2)
		const matricesQueried = instance.sendMessage.mock.calls.map((c: number[][]) => (c[0][1] & 0xf0) >> 4)
		expect(matricesQueried).toEqual([0, 1])
	})

	it('reads names for every configured matrix', async () => {
		await instance.readNames()
		// 2 matrices x (source names + dest names) = 4 requests
		expect(instance.sendMessage).toHaveBeenCalledTimes(4)
	})
})

describe('multi-matrix tally isolation', () => {
	let instance: TestableInstance

	beforeEach(() => {
		;({ instance } = createTestInstance({ matrices: '1:Video, 2:Audio' }))
	})

	it('stores a crosspoint tally under the matrix it names and nowhere else', () => {
		// matrix nibble 1 (matrix 2 / Audio), level 1, dest 3, source 5
		instance.decode(frame([cmds.crosspointConnected, 0x10, 0x00, 0x02, 0x04]))

		expect(instance.getRoutemapEntries(2, 3)).toEqual({ 1: 5 })
		expect(instance.getRoutemapEntries(1, 3)).toEqual({})
		expect(instance.hasSourceInAnyLevelRoutemap(2, 3, 5)).toBe(true)
		expect(instance.hasSourceInAnyLevelRoutemap(1, 3, 5)).toBe(false)
	})

	it('ignores a tally for a matrix that is not configured', () => {
		const logSpy = vi.spyOn(instance, 'log')
		// matrix nibble 2 (matrix 3) - not in "1:Video, 2:Audio"
		instance.decode(frame([cmds.crosspointConnected, 0x20, 0x00, 0x02, 0x04]))

		expect(logSpy).toHaveBeenCalledWith('debug', expect.stringContaining('unconfigured matrix'))
		expect(instance.hasSourceInAnyLevelRoutemap(3, 3, 5)).toBe(false)
	})
})
