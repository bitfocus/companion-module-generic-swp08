import { namesUpdatedWindowMs, namesSettleMs } from './consts.js'

/** Which name tables to re-read from the router */
export interface NameKinds {
	readonly sources: boolean
	readonly destinations: boolean
}

const noNames: NameKinds = { sources: false, destinations: false }

function merge(a: NameKinds, b: NameKinds): NameKinds {
	return { sources: a.sources || b.sources, destinations: a.destinations || b.destinations }
}

// NAMES UPDATED name identifier flags (SW-P-08 Issue 32 §3.2.14). UMD labels (bits 4-7) and
// source association names (bits 10-12) are not read by this module.
const sourceNameFlags = (1 << 0) | (1 << 1) | (1 << 8) // 4, 8 and 12 character source names
const destinationNameFlags = (1 << 2) | (1 << 3) | (1 << 9) // 4, 8 and 12 character destination names

/**
 * Work out which of our names a NAMES UPDATED message (command 30) covers.
 *
 * SW-P-08 Issue 32 §3.2.14: bytes 1-4 are a 32 bit matrix bitmap, high byte first, lsb = matrix 1.
 * Bytes 5-8 are the name identifier flags, high byte first. The message carries no names.
 *
 * Errs towards re-reading: a message too short to carry a field, a matrix above 32 (the bitmap
 * cannot name it) or empty flags count as "everything changed". Flags for any name length count,
 * since re-reading names that did not change only costs traffic.
 *
 * @param data Message data, command byte first
 * @param matrix Configured matrix, 1-based
 */
export function namesUpdatedKinds(data: Buffer, matrix: number): NameKinds {
	if (data.length >= 5 && matrix <= 32) {
		const matrixBitmap = data.readUInt32BE(1)
		if (((matrixBitmap >>> (matrix - 1)) & 1) === 0) return noNames
	}

	const nameFlags = data.length >= 9 ? data.readUInt32BE(5) : 0
	if (nameFlags === 0) return { sources: true, destinations: true }

	return {
		sources: (nameFlags & sourceNameFlags) !== 0,
		destinations: (nameFlags & destinationNameFlags) !== 0,
	}
}

/**
 * Turns the router's NAMES UPDATED messages into as few name re-reads as possible.
 *
 * The router already holds the message back until 5 seconds after the last edit, but it may send
 * one per matrix or name type, and a re-read of a large router streams for a while. So:
 *
 * - The first request opens a window (namesUpdatedWindowMs), and everything requested inside it is
 *   read together.
 * - A re-read never starts while name packets are still arriving, whether from the initial read,
 *   the Refresh names action or the previous re-read. It waits until they have stopped for
 *   namesSettleMs.
 * - One re-read at a time. A request that arrives during one is read again after it, because the
 *   edit may have landed after the router had already sent that name.
 * - A re-read that finds no connection is held until resume(), so a reconnect does not lose it.
 * - A full name read covers everything asked for before it started.
 */
export class NamesRefresh {
	private pending = noNames
	private timer: ReturnType<typeof setTimeout> | undefined
	private sending = false
	/** The last re-read found no connection: hold requests until resume() */
	private held = false
	// Monotonic, so a wall clock stepping backwards cannot hold a re-read back
	private lastPacketAt = Number.NEGATIVE_INFINITY
	private generation = 0

	/**
	 * @param onRefresh Sends the name requests. Resolves true once they have gone out, false when there
	 * was no connection to send them on.
	 */
	constructor(private readonly onRefresh: (kinds: NameKinds) => Promise<boolean>) {}

	private get hasPending(): boolean {
		return this.pending.sources || this.pending.destinations
	}

	request(kinds: NameKinds): void {
		this.pending = merge(this.pending, kinds)
		if (!this.hasPending || this.sending || this.timer || this.held) return
		this.arm(namesUpdatedWindowMs)
	}

	/** The connection is back: send a re-read that was held for lack of one */
	resume(): void {
		if (!this.held) return
		this.held = false
		if (this.hasPending && !this.sending && !this.timer) this.arm(namesUpdatedWindowMs)
	}

	/**
	 * A full name read is starting. It answers everything asked for so far, and requests from now on
	 * wait until its answers have stopped arriving.
	 */
	fullReadStarted(): void {
		this.reset()
		this.markPacketReceived()
	}

	/** Call for every name packet received, whatever asked for it */
	markPacketReceived(): void {
		this.lastPacketAt = performance.now()
	}

	/** Drop anything pending (config change / destroy) */
	reset(): void {
		clearTimeout(this.timer)
		this.timer = undefined
		this.pending = noNames
		this.sending = false
		this.held = false
		this.lastPacketAt = Number.NEGATIVE_INFINITY
		this.generation++
	}

	private arm(ms: number): void {
		this.timer = setTimeout(() => {
			this.timer = undefined
			this.fire()
		}, ms)
	}

	private fire(): void {
		const quietFor = performance.now() - this.lastPacketAt
		if (quietFor < namesSettleMs) {
			this.arm(namesSettleMs - quietFor)
			return
		}

		const kinds = this.pending
		this.pending = noNames
		this.sending = true
		const generation = this.generation

		void this.onRefresh(kinds)
			.catch(() => true)
			.then((sent) => {
				if (generation !== this.generation) return
				this.sending = false
				if (!sent) {
					this.pending = merge(this.pending, kinds)
					this.held = true
					return
				}
				// The answers follow the requests, so the next re-read waits for them to finish
				this.lastPacketAt = performance.now()
				if (this.hasPending) this.arm(namesUpdatedWindowMs)
			})
	}
}
