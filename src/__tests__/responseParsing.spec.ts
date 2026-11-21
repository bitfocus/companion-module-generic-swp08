import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACK, cmds, DLE, NAK, STX } from '../consts.js'
import { createTestInstance, frame, type TestableInstance } from './testHarness.js'

describe('decode - packet framing', () => {
	let instance: TestableInstance

	beforeEach(() => {
		;({ instance } = createTestInstance())
	})

	it('resolves a pending ACK callback', () => {
		const resolve = vi.fn()
		const reject = vi.fn()
		instance.ackCallbacks.push({ resolve, reject })

		const consumed = instance.decode(Buffer.from([DLE, ACK]))

		expect(consumed).toBe(2)
		expect(resolve).toHaveBeenCalled()
		expect(reject).not.toHaveBeenCalled()
	})

	it('rejects a pending ACK callback on NAK', () => {
		const resolve = vi.fn()
		const reject = vi.fn()
		instance.ackCallbacks.push({ resolve, reject })

		instance.decode(Buffer.from([DLE, NAK]))

		expect(reject).toHaveBeenCalled()
		expect(resolve).not.toHaveBeenCalled()
	})

	it('warns and does not throw on an unexpected ACK with nothing pending', () => {
		const warnSpy = vi.spyOn(instance, 'log')
		instance.decode(Buffer.from([DLE, ACK]))
		expect(warnSpy).toHaveBeenCalledWith('warn', expect.stringContaining('unexpected ACK/NAK'))
	})

	it('returns 0 and waits for more data when no ETX has arrived yet', () => {
		const consumed = instance.decode(Buffer.from([DLE, STX, 0x01, 0x02]))
		expect(consumed).toBe(0)
	})

	it('detects a corrupted checksum and sends a NAK instead of processing the message', () => {
		const packet = frame([cmds.crosspointConnected, 0x01, 0x02, 0x02, 0x04])
		// Flip a data byte after framing so the checksum no longer matches
		packet[3] = packet[3] ^ 0xff

		const warnSpy = vi.spyOn(instance, 'log')
		const nakSpy = vi.spyOn(instance, 'sendNak' as any)

		instance.decode(packet)

		expect(warnSpy).toHaveBeenCalledWith('warn', expect.stringContaining('Invalid checksum'))
		expect(nakSpy).toHaveBeenCalled()
		// A bad packet must not be routed as a valid crosspoint update
		expect(instance.hasDestInRoutemap(3)).toBe(false)
	})
})

describe('decode - DLE stuffing', () => {
	it('does not end a message at an escaped DLE followed by 03', () => {
		const { instance } = createTestInstance({ matrix: 1 })
		const warnSpy = vi.spyOn(instance, 'log')
		// dest 17 <- source 4: the data bytes 10 03 go out as 10 10 03, which is not DLE ETX
		const packet = frame([cmds.crosspointConnected, 0x00, 0x00, 0x10, 0x03])
		expect(packet.includes(Buffer.from([DLE, DLE, 0x03]))).toBe(true)

		const consumed = instance.decode(packet)

		expect(consumed).toBe(packet.length)
		expect(warnSpy).not.toHaveBeenCalledWith('warn', expect.stringContaining('Invalid packet length'))
		expect(instance.getRoutemapEntries(17)).toEqual({ 1: 4 })
	})
})

describe('processMessage - crosspoint connected (standard)', () => {
	let instance: TestableInstance

	beforeEach(() => {
		;({ instance } = createTestInstance({ matrix: 1 }))
	})

	it('updates the routemap for source -> dest on the given level', () => {
		// matrix 1, level 2, dest 3, source 5 encoded per the SW-P-08 standard command layout
		const data = Buffer.from([
			cmds.crosspointConnected,
			0x01, // (matrix0 << 4) | level0  -> matrix 1, level 2
			0x00, // dest hi bits | source hi bits (both 0, well within 128)
			0x02, // dest0 (dest 3 -> 2)
			0x04, // source0 (source 5 -> 4)
		])

		instance.decode(frame(Array.from(data)))

		expect(instance.getRoutemapEntries(3)).toEqual({ 2: 5 })
	})

	it('ignores a crosspoint update for a different matrix than configured', () => {
		const warnSpy = vi.spyOn(instance, 'log')
		// matrix nibble = 1 (matrix 2), but instance is configured for matrix 1
		const data = Buffer.from([cmds.crosspointConnected, 0x11, 0x00, 0x02, 0x04])

		instance.decode(frame(Array.from(data)))

		expect(warnSpy).toHaveBeenCalledWith('warn', expect.stringContaining('Ignoring matrix'))
		expect(instance.hasDestInRoutemap(3)).toBe(false)
	})
})

describe('processMessage - extended crosspoint connected', () => {
	it('updates the routemap using the extended (16-bit) layout', () => {
		const { instance } = createTestInstance({ extended_support: true, matrix_ext: 1 })

		const dest = 300 // exceeds the standard 10-bit range, only reachable via extended commands
		const source = 500
		const level = 4
		const data = Buffer.from([
			cmds.extendedCrosspointConnected,
			0, // matrix0
			level - 1,
			(dest - 1) >> 8,
			(dest - 1) & 0xff,
			(source - 1) >> 8,
			(source - 1) & 0xff,
		])

		instance.decode(frame(Array.from(data)))

		expect(instance.getRoutemapEntries(dest)).toEqual({ [level]: source })
	})
})

describe('processMessage - crosspoint tally dump', () => {
	it('populates the routemap for every destination in a byte-format dump', () => {
		const { instance } = createTestInstance({ matrix: 1, max_levels: 1 })

		// matrix 1, level 1, 3 tallies starting at dest 10, sources 20/21/22
		const data = Buffer.from([cmds.crosspointTallyDumpByteResponse, 0x00, 3, 9, 19, 20, 21])

		instance.decode(frame(Array.from(data)))

		expect(instance.getRoutemapEntries(10)).toEqual({ 1: 20 })
		expect(instance.getRoutemapEntries(11)).toEqual({ 1: 21 })
		expect(instance.getRoutemapEntries(12)).toEqual({ 1: 22 })
	})
})

describe('processMessage - names', () => {
	// SW-P-08 Issue 32 §3.2.19: length codes 03 and 04 are 16 and 32 character names
	it.each([
		[0x03, 16],
		[0x04, 32],
	])('reads names with length code %i (%i characters)', (code, length) => {
		const { instance } = createTestInstance()
		const names = ['A LONG SOURCE NAME', 'ANOTHER ONE']
		const data = [cmds.sourceNamesResponse, 0x00, code, 0x00, 0x00, names.length]
		for (const name of names) data.push(...Buffer.from(name.slice(0, length).padEnd(length, ' ')))

		instance.decode(frame(data))

		expect(instance.source_names.get(1)?.label).toBe(names[0].slice(0, length).trim())
		expect(instance.source_names.get(2)?.label).toBe(names[1])
	})

	it('ignores a names reply with an unknown length code instead of blanking the names', () => {
		const { instance } = createTestInstance()
		instance.decode(frame([cmds.sourceNamesResponse, 0x00, 0x01, 0x00, 0x00, 1, ...Buffer.from('CAM 1   ')]))

		instance.decode(frame([cmds.sourceNamesResponse, 0x00, 0x07, 0x00, 0x00, 1, ...Buffer.from('XXXXXXXX')]))

		expect(instance.source_names.get(1)?.label).toBe('CAM 1')
	})
})

describe('processMessage - unrecognised command', () => {
	it('logs a warning and does not throw', () => {
		const { instance } = createTestInstance()
		const warnSpy = vi.spyOn(instance, 'log')

		expect(() => instance.decode(frame([0xd0]))).not.toThrow()
		expect(warnSpy).toHaveBeenCalledWith('warn', expect.stringContaining('Unsupported response code'))
	})
})
