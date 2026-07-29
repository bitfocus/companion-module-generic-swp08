import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoadingGate, type LoadingFlushReason } from './loadingGate.js'

describe('LoadingGate', () => {
	let gate: LoadingGate
	let flushReasons: LoadingFlushReason[]

	beforeEach(() => {
		vi.useFakeTimers()
		gate = new LoadingGate()
		flushReasons = []
	})

	afterEach(() => {
		gate.reset()
		vi.useRealTimers()
	})

	function start(
		opts: { namesRequired?: boolean; tallyRequired?: boolean; timeoutMs?: number; settleMs?: number } = {},
	) {
		gate.start({
			namesRequired: opts.namesRequired ?? false,
			tallyRequired: opts.tallyRequired ?? false,
			timeoutMs: opts.timeoutMs ?? 30_000,
			settleMs: opts.settleMs ?? 1_000,
			onFlush: (reason) => flushReasons.push(reason),
		})
	}

	it('starts inactive', () => {
		expect(gate.isActive).toBe(false)
	})

	it('becomes active on start', () => {
		start({ namesRequired: true })
		expect(gate.isActive).toBe(true)
	})

	it('flushes immediately when no pulls are required', () => {
		start()
		gate.completeIfNothingRequired()
		expect(gate.isActive).toBe(false)
		expect(flushReasons).toEqual(['no pulls required'])
	})

	it('does not flush on completeIfNothingRequired when pulls are required', () => {
		start({ tallyRequired: true })
		gate.completeIfNothingRequired()
		expect(gate.isActive).toBe(true)
		expect(flushReasons).toEqual([])
	})

	it('does not flush on first packet of each tally level — waits for settle', () => {
		start({ tallyRequired: true, settleMs: 1_000 })
		gate.setTallyLevelsExpected(2)

		gate.markTallyLevelReceived(1)
		gate.markTallyLevelReceived(2)
		expect(gate.isActive).toBe(true)
		expect(flushReasons).toEqual([])

		vi.advanceTimersByTime(999)
		expect(gate.isActive).toBe(true)

		vi.advanceTimersByTime(1)
		expect(gate.isActive).toBe(false)
		expect(flushReasons).toEqual(['complete'])
	})

	it('resets tally settle when more dump packets arrive after all levels seen', () => {
		start({ tallyRequired: true, settleMs: 1_000 })
		gate.setTallyLevelsExpected(1)

		gate.markTallyLevelReceived(1)
		vi.advanceTimersByTime(800)
		// Another chunk for the same level (multi-packet dump)
		gate.markTallyLevelReceived(1)
		vi.advanceTimersByTime(800)
		expect(gate.isActive).toBe(true)

		vi.advanceTimersByTime(200)
		expect(gate.isActive).toBe(false)
		expect(flushReasons).toEqual(['complete'])
	})

	it('ignores tally packets until all expected levels have been seen', () => {
		start({ tallyRequired: true, settleMs: 1_000 })
		gate.setTallyLevelsExpected(2)

		gate.markTallyLevelReceived(1)
		gate.markTallyLevelReceived(1)
		vi.advanceTimersByTime(1_000)
		expect(gate.isActive).toBe(true)
		expect(flushReasons).toEqual([])
	})

	it('flushes after names settle window with no further packets', () => {
		start({ namesRequired: true, settleMs: 1_000 })

		gate.markNamesPacketReceived()
		expect(gate.isActive).toBe(true)

		vi.advanceTimersByTime(999)
		expect(gate.isActive).toBe(true)

		vi.advanceTimersByTime(1)
		expect(gate.isActive).toBe(false)
		expect(flushReasons).toEqual(['complete'])
	})

	it('resets names settle timer on each packet', () => {
		start({ namesRequired: true, settleMs: 1_000 })

		gate.markNamesPacketReceived()
		vi.advanceTimersByTime(800)
		gate.markNamesPacketReceived()
		vi.advanceTimersByTime(800)
		expect(gate.isActive).toBe(true)

		vi.advanceTimersByTime(200)
		expect(gate.isActive).toBe(false)
		expect(flushReasons).toEqual(['complete'])
	})

	it('waits for both names and tally settles before flushing', () => {
		start({ namesRequired: true, tallyRequired: true, settleMs: 1_000 })
		gate.setTallyLevelsExpected(1)

		gate.markTallyLevelReceived(1)
		gate.markNamesPacketReceived()
		vi.advanceTimersByTime(1_000)
		expect(gate.isActive).toBe(false)
		expect(flushReasons).toEqual(['complete'])
	})

	it('does not flush on names settle alone when tally is still required', () => {
		start({ namesRequired: true, tallyRequired: true, settleMs: 1_000 })
		gate.setTallyLevelsExpected(1)

		gate.markNamesPacketReceived()
		vi.advanceTimersByTime(1_000)
		expect(gate.isActive).toBe(true)
		expect(flushReasons).toEqual([])
	})

	it('does not flush on tally settle alone when names are still required', () => {
		start({ namesRequired: true, tallyRequired: true, settleMs: 1_000 })
		gate.setTallyLevelsExpected(1)

		gate.markTallyLevelReceived(1)
		vi.advanceTimersByTime(1_000)
		expect(gate.isActive).toBe(true)
		expect(flushReasons).toEqual([])
	})

	it('flushes on timeout even if pulls are incomplete', () => {
		start({ namesRequired: true, tallyRequired: true, timeoutMs: 5_000 })
		gate.setTallyLevelsExpected(2)
		gate.markTallyLevelReceived(1)

		vi.advanceTimersByTime(5_000)
		expect(gate.isActive).toBe(false)
		expect(flushReasons).toEqual(['timeout'])
	})

	it('ignores further marks after flush', () => {
		start({ tallyRequired: true, timeoutMs: 1_000, settleMs: 1_000 })
		gate.setTallyLevelsExpected(1)
		vi.advanceTimersByTime(1_000)
		expect(flushReasons).toEqual(['timeout'])

		gate.markTallyLevelReceived(1)
		gate.markNamesPacketReceived()
		vi.advanceTimersByTime(1_000)
		expect(flushReasons).toEqual(['timeout'])
		expect(gate.isActive).toBe(false)
	})

	it('prepareForConnect resets completion tracking but keeps gate active', () => {
		start({ namesRequired: true, tallyRequired: true, settleMs: 1_000 })
		gate.setTallyLevelsExpected(1)
		gate.markTallyLevelReceived(1)
		gate.markNamesPacketReceived()

		gate.prepareForConnect()
		expect(gate.isActive).toBe(true)

		// Previous settle / tally progress must not complete the gate after prepare
		vi.advanceTimersByTime(1_000)
		expect(gate.isActive).toBe(true)
		expect(flushReasons).toEqual([])

		gate.setTallyLevelsExpected(1)
		gate.markTallyLevelReceived(1)
		gate.markNamesPacketReceived()
		vi.advanceTimersByTime(1_000)
		expect(flushReasons).toEqual(['complete'])
	})

	it('prepareForConnect is a no-op when gate is inactive (reconnect case)', () => {
		start({ tallyRequired: true, settleMs: 1_000 })
		gate.setTallyLevelsExpected(1)
		gate.markTallyLevelReceived(1)
		vi.advanceTimersByTime(1_000)
		expect(gate.isActive).toBe(false)

		gate.prepareForConnect()
		expect(gate.isActive).toBe(false)
		gate.markTallyLevelReceived(1)
		vi.advanceTimersByTime(1_000)
		expect(flushReasons).toEqual(['complete'])
	})

	it('reset clears timers so timeout will not fire', () => {
		start({ namesRequired: true, timeoutMs: 5_000 })
		gate.reset()
		expect(gate.isActive).toBe(false)

		vi.advanceTimersByTime(5_000)
		expect(flushReasons).toEqual([])
	})

	it('only flushes once', () => {
		start({ tallyRequired: true, timeoutMs: 5_000, settleMs: 1_000 })
		gate.setTallyLevelsExpected(1)
		gate.markTallyLevelReceived(1)
		vi.advanceTimersByTime(1_000)
		expect(flushReasons).toEqual(['complete'])

		vi.advanceTimersByTime(5_000)
		expect(flushReasons).toEqual(['complete'])
	})
})
