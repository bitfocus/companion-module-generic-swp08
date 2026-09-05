import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cmds, DLE, STX, ETX } from '../consts.js'
import { createTestInstance, type TestableInstance } from './testHarness.js'

describe('SetCrosspoint - standard command construction', () => {
	let instance: TestableInstance

	beforeEach(() => {
		;({ instance } = createTestInstance())
		instance.sendMessage = vi.fn().mockResolvedValue(undefined)
	})

	it('builds the standard crosspointConnect command for in-range values', async () => {
		// source 5 -> dest 3, level 2 (all comfortably within the 1023/15 standard protocol range)
		await instance.SetCrosspoint(5, 3, 2)

		expect(instance.sendMessage).toHaveBeenCalledTimes(1)
		expect(instance.sendMessage).toHaveBeenCalledWith([
			cmds.crosspointConnect,
			0x01, // (matrix0 << 4) | level0  ->  (0 << 4) | 1
			0x00, // (source0 >> 7) | ((dest0 >> 7) << 4)  ->  (4>>7=0) | (2>>7=0)<<4
			0x02, // dest0 & 0x7f  (dest 3 -> dest0 2)
			0x04, // source0 & 0x7f (source 5 -> source0 4)
		])
	})

	it('rejects out of range source/dest/level without sending anything', async () => {
		await instance.SetCrosspoint(0, 3, 1)
		await instance.SetCrosspoint(3, 0, 1)
		await instance.SetCrosspoint(3, 3, 0)
		await instance.SetCrosspoint(Number.NaN, 3, 1)

		expect(instance.sendMessage).not.toHaveBeenCalled()
	})

	it('falls back to the extended command when level exceeds the standard range, and warns since extended_support is off', async () => {
		const warnSpy = vi.spyOn(instance, 'log')

		// level 20 exceeds the 16-level standard protocol limit
		await instance.SetCrosspoint(1, 1, 20)

		expect(instance.sendMessage).toHaveBeenCalledWith([
			cmds.extendedCrosspointConnect,
			0, // effectiveMatrix - 1
			19, // level0
			0, // dest0 >> 8
			0, // dest0 & 0xff
			0, // source0 >> 8
			0, // source0 & 0xff
		])
		expect(warnSpy).toHaveBeenCalledWith('warn', expect.stringContaining('extended support is not enabled'))
	})
})

describe('getCrosspoints - interrogate command construction', () => {
	let instance: TestableInstance

	beforeEach(() => {
		;({ instance } = createTestInstance())
		instance.sendMessage = vi.fn().mockResolvedValue(undefined)
	})

	it('builds the standard crosspointInterrogate command for a specific level', async () => {
		await instance.getCrosspoints(3, 2)

		expect(instance.sendMessage).toHaveBeenCalledTimes(1)
		expect(instance.sendMessage).toHaveBeenCalledWith([
			cmds.crosspointInterrogate,
			0x01, // (matrix0 << 4) | level0 -> level 2 -> level0 1
			0x00, // (dest0 >> 7) << 4  (dest 3 -> dest0 2, well within 7 bits)
			0x02, // dest0 & 0x7f
		])
	})

	it('queries every configured level when none is specified', async () => {
		await instance.getCrosspoints(3)

		// max_levels: 3 in the test config -> one interrogate per level
		expect(instance.sendMessage).toHaveBeenCalledTimes(3)
	})
})

describe('sendMessage - wire framing', () => {
	let instance: TestableInstance
	let sent: Buffer[]

	beforeEach(() => {
		;({ instance } = createTestInstance())
		sent = []
		// Fake a connected socket: capture the framed bytes and ACK synchronously.
		// Fast routers can reply before the socket write promise resolves, so the
		// ACK waiter must already be registered when sendAsync is called.
		instance.socket = {
			isConnected: true,
			sendAsync: vi.fn(async (buf: Buffer) => {
				sent.push(buf)
				instance.decode(Buffer.from([DLE, 0x06 /* ACK */]))
			}),
		}
	})

	it('wraps the payload in DLE/STX ... DLE/ETX with a correct length and checksum byte', async () => {
		await instance.sendMessage([0x02, 0x01, 0x00, 0x02, 0x04])

		expect(sent).toHaveLength(1)
		const packet = sent[0]

		expect(packet[0]).toBe(DLE)
		expect(packet[1]).toBe(STX)
		expect(packet.at(-2)).toBe(DLE)
		expect(packet.at(-1)).toBe(ETX)

		// BTC (length byte) is the 3rd-from-last byte (before checksum, DLE, ETX)
		const btc = packet.at(-4)
		expect(btc).toBe(5)

		// checksum is the two's complement of the sum of the unescaped data bytes + BTC
		const dataSum = 0x02 + 0x01 + 0x00 + 0x02 + 0x04
		const expectedChecksum = (~(dataSum + 5) + 1) & 0xff
		expect(packet.at(-3)).toBe(expectedChecksum)
	})

	it('byte-stuffs DLE (0x10) bytes that appear in the payload so they are not mistaken for framing', async () => {
		await instance.sendMessage([0x02, DLE, 0x03])

		const packet = sent[0]
		// SOM(2) + [0x02, DLE, DLE(stuffed), 0x03] + BTC + CHK + EOM(2)
		expect(Array.from(packet.subarray(2, 6))).toEqual([0x02, DLE, DLE, 0x03])
	})

	it('a packet built by sendMessage round-trips cleanly through decode() with no framing errors', async () => {
		await instance.sendMessage([cmds.crosspointConnected, 0x01, 0x02, 0x02, 0x04])
		const packet = sent[0]

		const { instance: receiver } = createTestInstance()
		const warnSpy = vi.spyOn(receiver, 'log')

		const consumed = receiver.decode(packet)

		expect(consumed).toBe(packet.length)
		expect(warnSpy).not.toHaveBeenCalledWith('warn', expect.stringContaining('Invalid checksum'))
		expect(warnSpy).not.toHaveBeenCalledWith('warn', expect.stringContaining('Invalid packet length'))
	})
})
