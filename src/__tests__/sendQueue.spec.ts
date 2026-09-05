// Send-queue pacing against a fake SW-P-08 router on a real loopback TCP socket.
//
// SW-P-88 (Issue 4a) §7.2.2 "Transmission Protocol": "Following transmission of a message, the remote
// device must wait for an ACK response" with "a notional 1 second timeout" - the ACK is the protocol's
// flow control. These tests pin down that the queue is gated on ACK/NAK/timeout and nothing else:
// no fixed inter-message interval, never more than one message outstanding, retry once on NAK, and a
// bounded wait when the router never answers.
import { createServer, type Server, type Socket } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { ACK, DLE, ETX, NAK, STX } from '../consts.js'
import { createTestInstance, type TestableInstance } from './testHarness.js'

type AckMode = { kind: 'immediate' } | { kind: 'delayed'; ms: number } | { kind: 'nak-first' } | { kind: 'never' }

interface ReceivedFrame {
	at: number
	data: Buffer
}

/**
 * Minimal SW-P-08 router: unframes DLE STX ... DLE ETX messages (DLE-stuffed) from the controller and
 * answers each with a data-link ACK/NAK per `mode`. Records when each frame arrived and the largest
 * number of frames that were unanswered at any one time.
 */
class FakeRouter {
	readonly frames: ReceivedFrame[] = []
	maxOutstanding = 0
	port = 0

	private outstanding = 0
	private buffer = Buffer.alloc(0)
	private readonly server: Server
	private readonly sockets = new Set<Socket>()
	private readonly timers = new Set<NodeJS.Timeout>()

	constructor(private readonly mode: AckMode) {
		this.server = createServer((socket) => {
			this.sockets.add(socket)
			socket.on('data', (chunk: Buffer) => this.onData(socket, chunk))
			socket.on('close', () => this.sockets.delete(socket))
		})
	}

	async listen(): Promise<void> {
		await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve))
		const address = this.server.address()
		if (!address || typeof address === 'string') throw new Error('fake router did not get a port')
		this.port = address.port
	}

	async close(): Promise<void> {
		for (const timer of this.timers) clearTimeout(timer)
		for (const socket of this.sockets) socket.destroy()
		await new Promise<void>((resolve) => this.server.close(() => resolve()))
	}

	private onData(socket: Socket, chunk: Buffer): void {
		this.buffer = Buffer.concat([this.buffer, chunk])
		while (this.buffer.length >= 2) {
			if (this.buffer[0] !== DLE) {
				this.buffer = this.buffer.subarray(1)
				continue
			}
			if (this.buffer[1] === ACK || this.buffer[1] === NAK) {
				// the controller's own link-level replies - not a message
				this.buffer = this.buffer.subarray(2)
				continue
			}
			if (this.buffer[1] !== STX) {
				this.buffer = this.buffer.subarray(1)
				continue
			}
			const end = this.findEndOfMessage()
			if (end === -1) return
			const frame = Buffer.from(this.buffer.subarray(0, end + 2))
			this.buffer = this.buffer.subarray(end + 2)
			this.onFrame(socket, frame)
		}
	}

	/** Index of the DLE in the terminating DLE ETX, skipping stuffed DLE DLE pairs; -1 if incomplete. */
	private findEndOfMessage(): number {
		for (let i = 2; i < this.buffer.length - 1; i++) {
			if (this.buffer[i] !== DLE) continue
			if (this.buffer[i + 1] === DLE) {
				i++
				continue
			}
			if (this.buffer[i + 1] === ETX) return i
		}
		return -1
	}

	private onFrame(socket: Socket, data: Buffer): void {
		this.outstanding++
		this.maxOutstanding = Math.max(this.maxOutstanding, this.outstanding)
		this.frames.push({ at: performance.now(), data })

		const reply = (byte: number): void => {
			this.outstanding--
			if (!socket.destroyed) socket.write(Buffer.from([DLE, byte]))
		}

		switch (this.mode.kind) {
			case 'immediate':
				reply(ACK)
				break
			case 'delayed': {
				const timer = setTimeout(() => {
					this.timers.delete(timer)
					reply(ACK)
				}, this.mode.ms)
				this.timers.add(timer)
				break
			}
			case 'nak-first':
				reply(this.frames.length === 1 ? NAK : ACK)
				break
			case 'never':
				break
		}
	}
}

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
	const start = Date.now()
	while (!condition()) {
		if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out')
		await new Promise((resolve) => setTimeout(resolve, 2))
	}
}

async function connectInstance(router: FakeRouter): Promise<TestableInstance> {
	const { instance } = createTestInstance()
	instance.config.host = '127.0.0.1'
	instance.config.port = String(router.port)
	instance.init_tcp()
	await waitFor(() => instance.socket?.isConnected === true)
	return instance
}

/** The `set_crosspoint` action fans a multi-level take out as one SetCrosspoint per level, awaited in turn. */
async function takeOnLevels(instance: TestableInstance, levels: number): Promise<number> {
	const start = performance.now()
	for (let level = 1; level <= levels; level++) {
		await instance.SetCrosspoint(1, 1, level)
	}
	return performance.now() - start
}

function gapsBetweenFrames(router: FakeRouter): number[] {
	return router.frames.slice(1).map((frame, i) => frame.at - router.frames[i].at)
}

describe('send queue - ACK-gated pacing', () => {
	let router: FakeRouter
	let instance: TestableInstance

	afterEach(async () => {
		await instance?.destroy()
		await router?.close()
	})

	it('sends the next message as soon as the previous one is ACKed, with no fixed interval', async () => {
		router = new FakeRouter({ kind: 'immediate' })
		await router.listen()
		instance = await connectInstance(router)

		// 17 levels = 1 video + 16 audio, the shape of a full take. A fixed 10 ms interval would put a
		// floor of 16 * 10 ms = 160 ms under this regardless of how fast the router answers.
		const elapsed = await takeOnLevels(instance, 17)

		expect(router.frames).toHaveLength(17)
		expect(router.maxOutstanding).toBe(1)
		expect(elapsed).toBeLessThan(120)
	})

	it('never sends the next message before the previous one is acknowledged', async () => {
		const ackDelay = 25
		router = new FakeRouter({ kind: 'delayed', ms: ackDelay })
		await router.listen()
		instance = await connectInstance(router)

		const elapsed = await takeOnLevels(instance, 4)

		expect(router.frames).toHaveLength(4)
		expect(router.maxOutstanding).toBe(1)
		for (const gap of gapsBetweenFrames(router)) {
			expect(gap).toBeGreaterThanOrEqual(ackDelay - 1)
		}
		expect(elapsed).toBeGreaterThanOrEqual(4 * (ackDelay - 1))
	})

	it('resends a NAKed message once, then carries on with the queue', async () => {
		router = new FakeRouter({ kind: 'nak-first' })
		await router.listen()
		instance = await connectInstance(router)

		await takeOnLevels(instance, 3)

		// first message, its resend, then the remaining two
		expect(router.frames).toHaveLength(4)
		expect(router.frames[1].data.equals(router.frames[0].data)).toBe(true)
		expect(router.frames[2].data.equals(router.frames[0].data)).toBe(false)
		expect(router.maxOutstanding).toBe(1)
		expect(instance.consecutiveAckFailures).toBe(0)
	})

	it('gives up on a message after ackMaxAttempts timeouts so a silent router cannot stall the queue', async () => {
		router = new FakeRouter({ kind: 'never' })
		await router.listen()
		instance = await connectInstance(router)
		// shorten the spec's notional 1 s so the test stays fast; the shape is what matters
		const ackTimeoutMs = 40
		instance.ackTimeoutMs = ackTimeoutMs

		const elapsed = await takeOnLevels(instance, 2)

		// each message: first send + one resend, both unanswered
		expect(router.frames).toHaveLength(4)
		expect(router.frames[1].data.equals(router.frames[0].data)).toBe(true)
		expect(router.frames[3].data.equals(router.frames[2].data)).toBe(true)
		expect(elapsed).toBeGreaterThanOrEqual(2 * 2 * (ackTimeoutMs - 1))
		expect(elapsed).toBeLessThan(2 * 2 * ackTimeoutMs + 200)
		expect(instance.consecutiveAckFailures).toBe(4)
		expect(instance.ackCallbacks).toHaveLength(0)
	})
})
