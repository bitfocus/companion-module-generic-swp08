import { initialLoadTimeoutMs, namesSettleMs } from './consts.js'

export type LoadingFlushReason = 'complete' | 'timeout' | 'no pulls required'

export type LoadingGateStartOptions = {
	namesRequired: boolean
	tallyRequired: boolean
	timeoutMs?: number
	/** Quiet period after the last name/tally packet before that pull is considered done */
	settleMs?: number
	onFlush: (reason: LoadingFlushReason) => void
}

/**
 * Tracks the initial port-load gate (startup / config change).
 * Companion pushes should be deferred while {@link isActive} is true.
 *
 * Tally dumps can span multiple packets per level — we only finish tally after
 * every expected level has been seen at least once AND a settle quiet period
 * elapses with no further dump packets.
 */
export class LoadingGate {
	private gateActive = false
	private namesRequired = false
	private namesLoaded = false
	private tallyRequired = false
	private tallyLoaded = false
	private tallyLevelsExpected = 0
	private tallyLevelsReceived = new Set<number>()
	private namesSettleTimer: ReturnType<typeof setTimeout> | undefined
	private tallySettleTimer: ReturnType<typeof setTimeout> | undefined
	private loadingTimeoutTimer: ReturnType<typeof setTimeout> | undefined
	private settleMs = namesSettleMs
	private onFlush: ((reason: LoadingFlushReason) => void) | undefined

	get isActive(): boolean {
		return this.gateActive
	}

	reset(): void {
		this.clearTimers()
		this.gateActive = false
		this.namesRequired = false
		this.namesLoaded = false
		this.tallyRequired = false
		this.tallyLoaded = false
		this.tallyLevelsExpected = 0
		this.tallyLevelsReceived = new Set()
		this.onFlush = undefined
	}

	/**
	 * Arm the gate for a startup / config-change cycle.
	 * Starts the safety timeout.
	 */
	start(options: LoadingGateStartOptions): void {
		this.clearTimers()
		this.gateActive = true
		this.namesRequired = options.namesRequired
		this.namesLoaded = false
		this.tallyRequired = options.tallyRequired
		this.tallyLoaded = false
		this.tallyLevelsExpected = 0
		this.tallyLevelsReceived = new Set()
		this.settleMs = options.settleMs ?? namesSettleMs
		this.onFlush = options.onFlush

		const timeoutMs = options.timeoutMs ?? initialLoadTimeoutMs
		this.loadingTimeoutTimer = setTimeout(() => {
			this.flush('timeout')
		}, timeoutMs)
	}

	/**
	 * Reset per-connect completion tracking while keeping the gate armed.
	 * Call on TCP connect when the gate is still active (not on reconnects after flush).
	 */
	prepareForConnect(): void {
		if (!this.gateActive) return
		clearTimeout(this.namesSettleTimer)
		clearTimeout(this.tallySettleTimer)
		this.namesSettleTimer = undefined
		this.tallySettleTimer = undefined
		this.namesLoaded = false
		this.tallyLoaded = false
		this.tallyLevelsExpected = 0
		this.tallyLevelsReceived = new Set()
	}

	/** If neither names nor tally pulls are required, flush immediately. */
	completeIfNothingRequired(): void {
		if (!this.gateActive) return
		if (!this.namesRequired && !this.tallyRequired) {
			this.flush('no pulls required')
		}
	}

	setTallyLevelsExpected(count: number): void {
		this.tallyLevelsExpected = count
	}

	markTallyLevelReceived(level: number): void {
		if (!this.gateActive || !this.tallyRequired || this.tallyLoaded) return
		this.tallyLevelsReceived.add(level)

		// Wait until every level has produced at least one packet, then settle so
		// multi-packet dumps for those levels can finish streaming.
		if (this.tallyLevelsReceived.size < this.tallyLevelsExpected) return

		clearTimeout(this.tallySettleTimer)
		this.tallySettleTimer = setTimeout(() => {
			this.tallyLoaded = true
			this.checkComplete()
		}, this.settleMs)
	}

	markNamesPacketReceived(): void {
		if (!this.gateActive || !this.namesRequired || this.namesLoaded) return
		clearTimeout(this.namesSettleTimer)
		this.namesSettleTimer = setTimeout(() => {
			this.namesLoaded = true
			this.checkComplete()
		}, this.settleMs)
	}

	private checkComplete(): void {
		if (!this.gateActive) return
		if (this.namesRequired && !this.namesLoaded) return
		if (this.tallyRequired && !this.tallyLoaded) return
		this.flush('complete')
	}

	private flush(reason: LoadingFlushReason): void {
		if (!this.gateActive) return
		this.clearTimers()
		this.gateActive = false
		this.onFlush?.(reason)
	}

	private clearTimers(): void {
		clearTimeout(this.namesSettleTimer)
		clearTimeout(this.tallySettleTimer)
		clearTimeout(this.loadingTimeoutTimer)
		this.namesSettleTimer = undefined
		this.tallySettleTimer = undefined
		this.loadingTimeoutTimer = undefined
	}
}
