import { createServer, type Socket } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACK, cmds, DLE, ETX, namesSettleMs, namesUpdatedWindowMs, STX } from '../consts.js'
import { FeedbackIds, UpdateFeedbacks } from '../feedbacks.js'
import { NamesRefresh, namesUpdatedKinds, type NameKinds } from '../namesRefresh.js'
import {
	createTestInstance,
	frame,
	lastVariableValue,
	namesResponse,
	type TestableInstance,
	type createInstanceContext,
} from './testHarness.js'

// Lets the 200 ms names debounce run
const afterNamesDebounce = 250

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

// NAMES UPDATED name identifier flags, SW-P-08 Issue 32 §3.2.14
const sourceNames8 = 1 << 1
const destinationNames4 = 1 << 2
const destinationNames8 = 1 << 3
const sourceNames12 = 1 << 8
const umdLabels8 = 1 << 5
const sourceAssociationNames8 = 1 << 11

/** NAMES UPDATED (command 30): 32 bit matrix bitmap (lsb = matrix 1), then 32 bit name flags */
function namesUpdated(matrixBitmap: number, nameFlags: number): number[] {
	const data = Buffer.alloc(9)
	data[0] = cmds.namesUpdated
	data.writeUInt32BE(matrixBitmap >>> 0, 1)
	data.writeUInt32BE(nameFlags >>> 0, 5)
	return [...data]
}

const both: NameKinds = { sources: true, destinations: true }
const none: NameKinds = { sources: false, destinations: false }

describe('namesUpdatedKinds', () => {
	it('reads the name flags for a matrix in the bitmap', () => {
		expect(namesUpdatedKinds(Buffer.from(namesUpdated(0b1, sourceNames8)), 1)).toEqual({
			sources: true,
			destinations: false,
		})
		expect(namesUpdatedKinds(Buffer.from(namesUpdated(0b100, destinationNames4)), 3)).toEqual({
			sources: false,
			destinations: true,
		})
		expect(namesUpdatedKinds(Buffer.from(namesUpdated(1 << 31, sourceNames12 | destinationNames8)), 32)).toEqual(both)
	})

	it('covers nothing when our matrix is not in the bitmap', () => {
		expect(namesUpdatedKinds(Buffer.from(namesUpdated(0b10, sourceNames8)), 1)).toEqual(none)
	})

	it('covers nothing when only UMD labels or source association names changed', () => {
		expect(namesUpdatedKinds(Buffer.from(namesUpdated(0b1, umdLabels8 | sourceAssociationNames8)), 1)).toEqual(none)
	})

	it('re-reads everything when the message does not say', () => {
		// Matrices above 32 do not fit in the bitmap
		expect(namesUpdatedKinds(Buffer.from(namesUpdated(0, sourceNames8)), 33)).toEqual({
			sources: true,
			destinations: false,
		})
		expect(namesUpdatedKinds(Buffer.from(namesUpdated(0b1, 0)), 1)).toEqual(both)
		expect(namesUpdatedKinds(Buffer.from([cmds.namesUpdated, 0, 0, 0, 1]), 1)).toEqual(both)
		expect(namesUpdatedKinds(Buffer.from([cmds.namesUpdated]), 1)).toEqual(both)
	})
})

describe('NamesRefresh', () => {
	let refreshes: { at: number; kinds: NameKinds }[]
	let start: number

	function create(onRefresh?: (kinds: NameKinds) => Promise<boolean>): NamesRefresh {
		return new NamesRefresh(
			onRefresh ??
				(async (kinds) => {
					refreshes.push({ at: Date.now() - start, kinds })
					return true
				}),
		)
	}

	beforeEach(() => {
		refreshes = []
		start = Date.now()
	})

	it('reads everything requested inside the window together, once', async () => {
		const refresh = create()
		refresh.request({ sources: true, destinations: false })
		await vi.advanceTimersByTimeAsync(200)
		refresh.request({ sources: false, destinations: true })
		refresh.request({ sources: true, destinations: false })

		await vi.advanceTimersByTimeAsync(5_000)

		expect(refreshes).toEqual([{ at: namesUpdatedWindowMs, kinds: both }])
	})

	it('ignores a request for nothing', async () => {
		const refresh = create()
		refresh.request(none)
		await vi.advanceTimersByTimeAsync(5_000)
		expect(refreshes).toEqual([])
	})

	it('waits until name packets have stopped arriving', async () => {
		const refresh = create()
		refresh.markPacketReceived()
		refresh.request(both)
		// A read still streaming: one packet every 400 ms until 2 s
		for (let t = 400; t <= 2_000; t += 400) {
			await vi.advanceTimersByTimeAsync(400)
			refresh.markPacketReceived()
		}

		await vi.advanceTimersByTimeAsync(5_000)

		expect(refreshes).toEqual([{ at: 2_000 + namesSettleMs, kinds: both }])
	})

	it('reads again after the current re-read when asked during it', async () => {
		let finishSending!: () => void
		const refresh = create(async (kinds) => {
			refreshes.push({ at: Date.now() - start, kinds })
			if (refreshes.length === 1) await new Promise<void>((resolve) => (finishSending = resolve))
			return true
		})
		refresh.request({ sources: true, destinations: false })
		await vi.advanceTimersByTimeAsync(namesUpdatedWindowMs)
		expect(refreshes).toHaveLength(1)

		// Asked again while the first requests are still going out
		refresh.request({ sources: false, destinations: true })
		await vi.advanceTimersByTimeAsync(3_000)
		expect(refreshes).toHaveLength(1)

		finishSending()
		const sentAt = Date.now() - start
		// ...and the router's answers stream in for a second
		for (let t = 0; t < 1_000; t += 250) {
			await vi.advanceTimersByTimeAsync(250)
			refresh.markPacketReceived()
		}
		await vi.advanceTimersByTimeAsync(5_000)

		expect(refreshes).toEqual([
			{ at: namesUpdatedWindowMs, kinds: { sources: true, destinations: false } },
			{ at: sentAt + 1_000 + namesSettleMs, kinds: { sources: false, destinations: true } },
		])
	})

	it('drops a pending re-read on reset', async () => {
		const refresh = create()
		refresh.request(both)
		refresh.reset()
		await vi.advanceTimersByTimeAsync(5_000)
		expect(refreshes).toEqual([])
	})

	it('keeps one re-read in flight when one from before a reset finishes late', async () => {
		const finish: (() => void)[] = []
		const refresh = create(async (kinds) => {
			refreshes.push({ at: Date.now() - start, kinds })
			await new Promise<void>((resolve) => finish.push(resolve))
			return true
		})
		refresh.request(both)
		await vi.advanceTimersByTimeAsync(namesUpdatedWindowMs)
		// e.g. a config change while the first requests were still going out
		refresh.reset()
		refresh.request(both)
		await vi.advanceTimersByTimeAsync(namesUpdatedWindowMs)
		expect(refreshes).toHaveLength(2)

		// Asked again while the second is in flight, then the first, from before the reset, finishes
		refresh.request(both)
		finish[0]()
		await vi.advanceTimersByTimeAsync(5_000)
		expect(refreshes).toHaveLength(2)

		finish[1]()
		await vi.advanceTimersByTimeAsync(5_000)
		expect(refreshes).toHaveLength(3)
	})

	it('holds a re-read that found no connection until resume()', async () => {
		let connected = false
		const refresh = create(async (kinds) => {
			refreshes.push({ at: Date.now() - start, kinds })
			return connected
		})
		refresh.request({ sources: true, destinations: false })
		await vi.advanceTimersByTimeAsync(namesUpdatedWindowMs)
		refresh.request({ sources: false, destinations: true })
		await vi.advanceTimersByTimeAsync(10_000)
		expect(refreshes).toHaveLength(1)

		connected = true
		refresh.resume()
		await vi.advanceTimersByTimeAsync(namesUpdatedWindowMs)

		expect(refreshes.map((r) => r.kinds)).toEqual([{ sources: true, destinations: false }, both])
	})

	it('lets a full read cover what was asked for before it, and waits for its answers', async () => {
		const refresh = create()
		refresh.request(both)
		refresh.fullReadStarted()
		// Asked during the full read, before any answer has arrived
		refresh.request({ sources: true, destinations: false })
		await vi.advanceTimersByTimeAsync(5_000)

		// Destinations were covered by the full read; sources waited a quiet period from its start
		expect(refreshes).toEqual([{ at: namesSettleMs, kinds: { sources: true, destinations: false } }])
	})
})

describe('NAMES UPDATED from the router', () => {
	let instance: TestableInstance
	let context: ReturnType<typeof createInstanceContext>

	const getSourceNames = [cmds.getSourceNames, 0x00, 0x01] // matrix 1, 8 characters
	const getDestinationNames = [cmds.getDestNames, 0x00, 0x01]

	function sentNameRequests(): number[][] {
		return instance.sendMessage.mock.calls.map(([message]: [number[]]) => message)
	}

	/** Stands in for an open TCPHelper, so re-reads go out (sendMessage itself is mocked) */
	function connectedSocket(): { isConnected: boolean; sendAsync: () => Promise<void>; destroy: () => void } {
		// sendAsync carries the module's link-level ACKs
		return { isConnected: true, sendAsync: vi.fn(async () => {}), destroy: vi.fn() }
	}

	beforeEach(async () => {
		;({ instance, context } = createTestInstance({ read_names_on_connect: true, max_levels: 2 }))
		instance.socket = connectedSocket()
		instance.decode(frame(namesResponse('source', 1, ['CAM 1', 'CAM 2', 'CAM 3'])))
		instance.decode(frame(namesResponse('destination', 1, ['MON 1', 'MON 2'])))
		await vi.advanceTimersByTimeAsync(namesSettleMs + afterNamesDebounce)
		instance.sendMessage = vi.fn().mockResolvedValue(undefined)
		context.setVariableValues.mockClear()
		context.setVariableDefinitions.mockClear()
		context.setActionDefinitions.mockClear()
	})

	it('re-reads only the names it flags, once the window closes', async () => {
		const logSpy = vi.spyOn(instance, 'log')
		instance.decode(frame(namesUpdated(0b1, sourceNames8)))

		await vi.advanceTimersByTimeAsync(namesUpdatedWindowMs - 1)
		expect(sentNameRequests()).toEqual([])
		await vi.advanceTimersByTimeAsync(1)
		expect(sentNameRequests()).toEqual([getSourceNames])

		expect(logSpy).not.toHaveBeenCalledWith('warn', expect.stringContaining('Unsupported response code'))
	})

	it('re-reads source and destination names in one go when both changed', async () => {
		instance.decode(frame(namesUpdated(0b1, sourceNames8)))
		instance.decode(frame(namesUpdated(0b1, destinationNames8)))
		await vi.advanceTimersByTimeAsync(5_000)

		expect(sentNameRequests()).toEqual([getSourceNames, getDestinationNames])
	})

	it('ignores updates for another matrix', async () => {
		instance.decode(frame(namesUpdated(0b10, sourceNames8 | destinationNames8)))
		await vi.advanceTimersByTimeAsync(5_000)

		expect(sentNameRequests()).toEqual([])
	})

	it('re-reads with the extended name requests when extended support is on', async () => {
		const { instance: extended } = createTestInstance({
			read_names_on_connect: true,
			extended_support: true,
			name_chars: '02',
		})
		extended.sendMessage = vi.fn().mockResolvedValue(undefined)
		extended.socket = connectedSocket()
		extended.decode(frame(namesUpdated(0b1, sourceNames12)))
		await vi.advanceTimersByTimeAsync(5_000)

		// matrix 1, level 1, 12 characters
		expect(extended.sendMessage.mock.calls).toEqual([[[cmds.extendedGetSourceNames, 0x00, 0x00, 0x02]]])
	})

	it('reads a NAMES UPDATED whose bitmap has a byte 10 followed by 03', async () => {
		// Matrices 1, 2 and 13: 00 00 10 03, sent as 00 00 10 10 03
		instance.decode(frame(namesUpdated(0x00001003, sourceNames8)))
		await vi.advanceTimersByTimeAsync(5_000)

		expect(sentNameRequests()).toEqual([getSourceNames])
	})

	it('holds a re-read while the connection is down and sends it once it is back', async () => {
		instance.socket.isConnected = false
		instance.decode(frame(namesUpdated(0b1, sourceNames8)))
		await vi.advanceTimersByTimeAsync(10_000)
		expect(sentNameRequests()).toEqual([])

		instance.socket.isConnected = true
		instance.namesRefresh.resume()
		await vi.advanceTimersByTimeAsync(namesUpdatedWindowMs)
		expect(sentNameRequests()).toEqual([getSourceNames])
	})

	it('drops the rest of a re-read when the config changes during it', async () => {
		instance.sendMessage = vi.fn(async () => {
			// configUpdated swaps in the new config while the source request waits for its ACK
			instance.config = { ...instance.config, matrix: 2 }
		})
		instance.decode(frame(namesUpdated(0b1, sourceNames8 | destinationNames8)))
		await vi.advanceTimersByTimeAsync(5_000)

		expect(sentNameRequests()).toEqual([getSourceNames])
	})

	it('lets a Refresh names read cover a NAMES UPDATED that came just before it', async () => {
		instance.decode(frame(namesUpdated(0b1, sourceNames8)))
		await instance.readNames()
		await vi.advanceTimersByTimeAsync(5_000)

		// Only the full read's own requests
		expect(sentNameRequests()).toEqual([getSourceNames, getDestinationNames])
	})

	it('drops a pending re-read when the connection is destroyed', async () => {
		instance.decode(frame(namesUpdated(0b1, sourceNames8)))
		await instance.destroy()
		await vi.advanceTimersByTimeAsync(5_000)

		expect(sentNameRequests()).toEqual([])
	})

	it('ignores updates when names are not read from the router', async () => {
		const { instance: noNames } = createTestInstance({ read_names_on_connect: false })
		noNames.sendMessage = vi.fn().mockResolvedValue(undefined)
		noNames.decode(frame(namesUpdated(0b1, sourceNames8)))
		await vi.advanceTimersByTimeAsync(5_000)

		expect(noNames.sendMessage).not.toHaveBeenCalled()
	})

	it('publishes only the renamed label, without blanking or redefining the rest', async () => {
		instance.decode(frame(namesUpdated(0b1, sourceNames8)))
		await vi.advanceTimersByTimeAsync(namesUpdatedWindowMs)
		instance.decode(frame(namesResponse('source', 1, ['CAM 1', 'STUDIO', 'CAM 3'])))
		await vi.advanceTimersByTimeAsync(afterNamesDebounce)

		expect(context.setVariableValues.mock.calls).toEqual([[{ Source_2: 'STUDIO' }]])
		expect(context.setVariableDefinitions).not.toHaveBeenCalled()
		// Dropdowns and presets carry the names, so they follow the rename
		expect(context.setActionDefinitions).toHaveBeenCalledTimes(1)
		expect(JSON.stringify(context.setActionDefinitions.mock.calls[0])).toContain('{"id":2,"label":"STUDIO"}')
		expect(JSON.stringify(context.setPresetDefinitions.mock.calls.at(-1))).toContain('Select Source STUDIO')
	})

	it('publishes nothing when the re-read finds no change', async () => {
		instance.decode(frame(namesUpdated(0b1, sourceNames8)))
		await vi.advanceTimersByTimeAsync(namesUpdatedWindowMs)
		instance.decode(frame(namesResponse('source', 1, ['CAM 1', 'CAM 2', 'CAM 3'])))
		await vi.advanceTimersByTimeAsync(5_000)

		expect(context.setVariableValues).not.toHaveBeenCalled()
		expect(context.setActionDefinitions).not.toHaveBeenCalled()
	})

	it('adds names the router reports beyond the ones it had', async () => {
		instance.decode(frame(namesUpdated(0b1, destinationNames8)))
		await vi.advanceTimersByTimeAsync(namesUpdatedWindowMs)
		instance.decode(frame(namesResponse('destination', 1, ['MON 1', 'MON 2', 'MON 3'])))
		await vi.advanceTimersByTimeAsync(afterNamesDebounce)

		expect(context.setVariableDefinitions.mock.calls.at(-1)?.[0]).toHaveProperty('Destination_3')
		expect(lastVariableValue(context, 'Destination_3')).toBe('MON 3')
		expect(lastVariableValue(context, 'Destinations')).toBe(3)
	})

	it("updates the selected destination's source name when that source is renamed", async () => {
		instance.selected_dest = 1
		// dest 1 <- source 2 on matrix 1, level 1. Level 2 has no known route.
		instance.decode(frame([cmds.crosspointConnected, 0x00, 0x00, 0x00, 0x01]))
		expect(lastVariableValue(context, 'Sel_Dest_Source_Name_Level_1')).toBe('CAM 2')
		context.setVariableValues.mockClear()

		instance.decode(frame(namesUpdated(0b1, sourceNames8)))
		await vi.advanceTimersByTimeAsync(namesUpdatedWindowMs)
		instance.decode(frame(namesResponse('source', 2, ['STUDIO'])))
		await vi.advanceTimersByTimeAsync(afterNamesDebounce)

		// Only the routed level's name: the rest of the selected destination's variables stay as they are
		expect(context.setVariableValues.mock.calls).toEqual([
			[{ Source_2: 'STUDIO' }],
			[{ Sel_Dest_Source_Name_Level_1: 'STUDIO' }],
		])
	})

	it('still clears the names when the router answers a Refresh names read with none', async () => {
		await instance.readNames()
		instance.decode(frame(namesResponse('source', 1, [])))
		await vi.advanceTimersByTimeAsync(afterNamesDebounce)

		expect(context.setVariableDefinitions.mock.calls.at(-1)?.[0]).not.toHaveProperty('Source_1')
		expect(context.setActionDefinitions).toHaveBeenCalledTimes(1)
	})

	it('re-reads names flagged while the initial load is still running', async () => {
		;({ instance, context } = createTestInstance({ read_names_on_connect: true }))
		instance.sendMessage = vi.fn().mockResolvedValue(undefined)
		instance.socket = connectedSocket()
		instance.startLoadingGate()
		instance.decode(frame(namesResponse('source', 1, ['CAM 1', 'CAM 2', 'CAM 3'])))
		instance.decode(frame(namesUpdated(0b1, sourceNames8)))
		await vi.advanceTimersByTimeAsync(namesSettleMs)

		expect(instance.loadingGate.isActive).toBe(false)
		expect(sentNameRequests()).toEqual([getSourceNames])
		instance.decode(frame(namesResponse('source', 1, ['CAM 1', 'STUDIO', 'CAM 3'])))
		await vi.advanceTimersByTimeAsync(afterNamesDebounce)
		expect(lastVariableValue(context, 'Source_2')).toBe('STUDIO')
	})

	it('waits for a name read that is still streaming before re-reading', async () => {
		instance.decode(frame(namesUpdated(0b1, sourceNames8)))
		// e.g. the Refresh names action, answered one packet every 300 ms
		for (let t = 0; t < 1_500; t += 300) {
			instance.decode(frame(namesResponse('source', 1, ['CAM 1', 'CAM 2', 'CAM 3'])))
			await vi.advanceTimersByTimeAsync(300)
		}
		expect(sentNameRequests()).toEqual([])

		await vi.advanceTimersByTimeAsync(namesSettleMs)
		expect(sentNameRequests()).toEqual([getSourceNames])
	})
})

describe('source name of the selected destination', () => {
	// Name keys are 1-based (since 76b682b), as are the sources in the routemap
	it('names the routed source, not the one before it', async () => {
		const { instance, context } = createTestInstance({ max_levels: 1 })
		instance.decode(frame(namesResponse('source', 1, ['CAM 1', 'CAM 2', 'CAM 3'])))
		vi.advanceTimersByTime(afterNamesDebounce)

		instance.selected_dest = 1
		// dest 1 <- source 2 on matrix 1, level 1
		instance.decode(frame([cmds.crosspointConnected, 0x00, 0x00, 0x00, 0x01]))

		expect(lastVariableValue(context, 'Sel_Dest_Source_Name_Level_1')).toBe('CAM 2')

		UpdateFeedbacks(instance as never)
		const feedbacks = context.setFeedbackDefinitions.mock.calls.at(-1)?.[0]
		const sourceName = await feedbacks[FeedbackIds.DestinationSourceName].callback({ options: { level: 1, dest: 1 } })
		expect(sourceName).toBe('CAM 2')
	})
})

describe('NAMES UPDATED across a reconnect, over TCP', () => {
	let instance: TestableInstance | undefined
	const sockets = new Set<Socket>()
	const server = createServer()

	beforeEach(() => {
		vi.useRealTimers()
	})

	afterEach(async () => {
		await instance?.destroy()
		for (const socket of sockets) socket.destroy()
		await new Promise<void>((resolve) => server.close(() => resolve()))
	})

	async function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
		const start = Date.now()
		while (!condition()) {
			if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out')
			await new Promise((resolve) => setTimeout(resolve, 10))
		}
	}

	it('re-reads names it read by hand once the router is back', async () => {
		// A minimal router: ACKs every message and records its command per connection
		const received: { connection: number; command: number }[] = []
		const connections: Socket[] = []
		server.on('connection', (socket) => {
			connections.push(socket)
			sockets.add(socket)
			const connection = connections.length
			let buffer = Buffer.alloc(0)
			socket.on('error', () => {})
			socket.on('data', (chunk: Buffer) => {
				buffer = Buffer.concat([buffer, chunk])
				for (;;) {
					const start = buffer.indexOf(Buffer.from([DLE, STX]))
					const end = start === -1 ? -1 : buffer.indexOf(Buffer.from([DLE, ETX]), start + 2)
					if (end === -1) break
					received.push({ connection, command: buffer[start + 2] })
					buffer = buffer.subarray(end + 2)
					socket.write(Buffer.from([DLE, ACK]))
				}
			})
		})
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
		const address = server.address()
		if (!address || typeof address === 'string') throw new Error('no port')

		;({ instance } = createTestInstance({ read_names_on_connect: false }))
		instance.config.host = '127.0.0.1'
		instance.config.port = String(address.port)
		// Names read by hand (Refresh names), not on connect
		instance.decode(frame(namesResponse('source', 1, ['CAM 1', 'CAM 2'])))
		instance.init_tcp()
		await waitFor(() => instance?.socket?.isConnected === true, 2_000)

		// NAMES UPDATED, then the router drops the connection before the re-read can go out
		connections[0].end(frame(namesUpdated(0b1, sourceNames8)))
		await waitFor(() => connections.length === 2, 8_000)
		await waitFor(() => received.some((r) => r.command === cmds.getSourceNames), 3_000)

		expect(received.filter((r) => r.command === cmds.getSourceNames)).toEqual([
			{ connection: 2, command: cmds.getSourceNames },
		])
	}, 15_000)
})
