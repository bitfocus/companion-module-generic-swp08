// Generic SWP08 Routing
// Grass Valley - Snell - Probel - Ross
// https://wwwapps.grassvalley.com/docs/Manuals/sam/Protocols%20and%20MIBs/Router%20Control%20Protocols%20SW-P-88%20Issue%204b.pdf
//
// @author Peter Daniel
//
// Updated for Companion v3 July 2024, Phillip Ivan Pietruschka
// Converted to Typescript April 2026, Phillip Ivan Pietruschka
// Updated to Companion API 2.0 April/May 2026, Phillip Ivan Pietruschka

import {
	InstanceBase,
	InstanceStatus,
	TCPHelper,
	type SomeCompanionConfigField,
	DropdownChoice,
	CompanionVariableDefinitions,
	CompanionVariableDefinition,
} from '@companion-module/base'
import { Buffer } from 'node:buffer'
import { UpgradeScripts } from './upgrades.js'
import { GetConfigFields, type SwP08Config } from './config.js'
import {
	ACK,
	NAK,
	DLE,
	STX,
	ETX,
	cmds,
	getCommandName,
	keepAliveTime,
	ackTimeout,
	ackMaxAttempts,
	supportedCommandsTimeout,
	crosspointConfirmDelay,
} from './consts.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks, FeedbackIds } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import type { AckCallback, Level, ProcessLabelsOptions, VarList, InstanceBaseExt, SWP08Types } from './types.js'
import { stripNumber, getRouteVariableName, parseMatrices, type MatrixDef } from './util.js'
import { LoadingGate } from './loadingGate.js'
import _ from 'lodash'
import PQueue from 'p-queue'

export { UpgradeScripts }

export default class SW_P_08 extends InstanceBase<SWP08Types> implements InstanceBaseExt {
	config!: SwP08Config
	// One message in flight at a time: each queued send awaits the router's ACK/NAK (or the ackTimeout)
	// before the next one goes out, per SW-P-88 §7.2.2. No fixed interval on top of that - the ACK is
	// the protocol's flow control, and a router that has acknowledged is ready for the next message.
	private queue = new PQueue({ concurrency: 1 })
	private ackTimeoutMs = ackTimeout
	private ackCallbacks: AckCallback[] = []
	private commands: number[] = []
	// routeMap: matrix -> dest -> level -> source
	private routeMap: Map<number, Map<number, Map<number, number>>> = new Map()
	private lastVariables: Map<string, number | string> = new Map()
	private lastVariableDefinitions: Map<string, CompanionVariableDefinition<Record<string, string | number>>> = new Map()
	private isRecordingActions = false
	private socket: TCPHelper | null = null
	private keepAliveTimer: NodeJS.Timeout | undefined
	/** Fallback timer for routers that never answer the protocol implementation request. */
	private supportedCommandsTimer: NodeJS.Timeout | undefined
	public feedbacksToCheck: Set<FeedbackIds> = new Set()

	// Primary-matrix name maps. Kept for backwards compatibility: every existing
	// consumer (actions/feedbacks/presets/variables) reads these and they always
	// mirror the primary matrix. Per-matrix names live in namesByMatrix.
	public dest_names: Map<number, DropdownChoice> = new Map()
	public source_names: Map<number, DropdownChoice> = new Map()
	// Full per-matrix names: matrix -> (number -> DropdownChoice)
	private namesByMatrix: {
		source: Map<number, Map<number, DropdownChoice>>
		dest: Map<number, Map<number, DropdownChoice>>
	} = { source: new Map(), dest: new Map() }
	public levels: DropdownChoice<number>[] = []

	/** Matrices this connection controls (always at least one). */
	public matrices: MatrixDef[] = [{ id: 1, label: 'Matrix 1' }]
	/** Dropdown choices mirroring {@link matrices}. */
	public matrixChoices: DropdownChoice<number>[] = [{ id: 1, label: 'Matrix 1' }]

	public selected_source: number = 0
	public selected_dest: number = 0
	public selected_matrix: number = 1
	public selected_level: Level[] = []

	private lastAckAt = 0
	private consecutiveAckFailures = 0

	private loadingGate = new LoadingGate()

	private debouncedUpdate = _.debounce(
		async () => {
			if (this.loadingGate.isActive) return
			this.updateVariableDefinitions()
			this.updateAllNames()
			this.updateActions()
			this.updateFeedbacks()
			this.updatePresets()
		},
		200,
		{
			maxWait: 2000,
		},
	)

	private debouncedCrosspointUpdate = _.debounce(
		() => {
			if (this.loadingGate.isActive) return
			// Crosspoint changes only change values. Re-publishing variable definitions here is
			// extremely expensive on large routers with tally_dump_variables enabled, because
			// every tally/update batch walks and sends the full Route_<level>_<dest> definition set.
			this.updateAllCrosspoints()
		},
		200,
		{
			maxWait: 2000,
		},
	)

	private throttledFeedbackCheck = _.throttle(() => {
		if (this.loadingGate.isActive) return
		if (this.feedbacksToCheck.size == 0) return
		this.checkFeedbacks(...([...this.feedbacksToCheck] as [FeedbackIds, ...FeedbackIds[]]))
		this.feedbacksToCheck.clear()
	}, 25)

	constructor(internal: unknown) {
		super(internal)
	}

	public async init(config: SwP08Config): Promise<void> {
		void this.configUpdated(config)
	}

	public async configUpdated(config: SwP08Config): Promise<void> {
		this.queue.clear()
		this.throttledFeedbackCheck.cancel()
		this.debouncedCrosspointUpdate.cancel()
		this.debouncedUpdate.cancel()
		this.updateStatus(InstanceStatus.Connecting)

		this.config = config
		this.startLoadingGate()
		this.setupVariables()
		this.init_tcp()
	}

	public async destroy(): Promise<void> {
		this.log('debug', `destroy. ID: ${this.id}`)
		this.queue.clear()
		this.throttledFeedbackCheck.cancel()
		this.debouncedCrosspointUpdate.cancel()
		this.debouncedUpdate.cancel()
		this.loadingGate.reset()
		this.stopKeepAliveTimer()
		this.clearSupportedCommandsTimer()
		this.clearCrosspointConfirmTimers()
		if (this.socket) {
			this.socket.destroy()
		}
		this.updateStatus(InstanceStatus.Disconnected)
	}

	public handleStartStopRecordActions(isRecording: boolean): void {
		this.isRecordingActions = isRecording
	}

	public getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	private updateActions(): void {
		UpdateActions(this)
	}

	private updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	private updatePresets(): void {
		UpdatePresets(this)
	}

	public addFeedbacksToCheck(...feedbacks: FeedbackIds[]): void {
		if (this.loadingGate.isActive) return
		for (const fb of feedbacks) {
			this.feedbacksToCheck.add(fb)
		}
		this.throttledFeedbackCheck()
	}

	/**
	 * Get maximum configured levels
	 **/

	private get effectiveLevels(): number {
		return this.config.extended_support ? this.config.max_levels_ext : this.config.max_levels
	}

	/**
	 * Get clamped maximum configured levels for use with non extended mode commands
	 **/

	private get protocolLevels(): number {
		return Math.min(this.effectiveLevels, 16)
	}

	/**
	 * Get maximum configured matrix
	 **/

	private get effectiveMatrix(): number {
		return this.config.extended_support ? this.config.matrix_ext : this.config.matrix
	}

	/**
	 * Highest legal matrix id for the active protocol mode.
	 */
	private get matrixMax(): number {
		return this.config.extended_support ? 256 : 16
	}

	/**
	 * The primary matrix - the first configured matrix. Keeps the historic
	 * un-namespaced variables and is the default for actions/feedbacks that were
	 * saved before multi-matrix support existed.
	 */
	public get primaryMatrix(): number {
		return this.matrices[0]?.id ?? this.effectiveMatrix
	}

	/**
	 * True when `matrix` is one this connection is configured to control.
	 */
	private isConfiguredMatrix(matrix: number): boolean {
		return this.matrices.some((m) => m.id === matrix)
	}

	/**
	 * Coerce an action/feedback `matrix` option to a usable matrix number,
	 * falling back to the primary matrix when it is missing or unparseable
	 * (e.g. an action saved before multi-matrix support).
	 */
	public resolveMatrixOption(value: unknown): number {
		const n = Math.round(Number(value))
		return Number.isFinite(n) && n >= 1 ? n : this.primaryMatrix
	}

	/**
	 * Rebuild {@link matrices} / {@link matrixChoices} from config and clamp
	 * {@link selected_matrix} into the configured set.
	 */
	private setupMatrices(): void {
		this.matrices = parseMatrices(this.config.matrices ?? '', this.effectiveMatrix, this.matrixMax)
		this.matrixChoices = this.matrices.map((m) => ({ id: m.id, label: m.label }))
		if (!this.isConfiguredMatrix(this.selected_matrix)) {
			this.selected_matrix = this.primaryMatrix
		}
	}

	/** Per-matrix routemap (dest -> level -> source), created on demand. */
	private routeMapFor(matrix: number): Map<number, Map<number, number>> {
		let m = this.routeMap.get(matrix)
		if (!m) {
			m = new Map()
			this.routeMap.set(matrix, m)
		}
		return m
	}

	/** Per-matrix name map for the given kind, created on demand. */
	private namesFor(kind: 'source' | 'dest', matrix: number): Map<number, DropdownChoice> {
		const outer = this.namesByMatrix[kind]
		let m = outer.get(matrix)
		if (!m) {
			m = new Map()
			outer.set(matrix, m)
		}
		return m
	}

	/** Point the primary-matrix name fields at the current primary matrix maps. */
	private syncPrimaryNames(): void {
		this.source_names = this.namesFor('source', this.primaryMatrix)
		this.dest_names = this.namesFor('dest', this.primaryMatrix)
	}

	/** Names for one matrix (primary by default) - for matrix-aware callers. */
	public sourceNamesForMatrix(matrix: number = this.primaryMatrix): Map<number, DropdownChoice> {
		return this.namesFor('source', matrix)
	}
	public destNamesForMatrix(matrix: number = this.primaryMatrix): Map<number, DropdownChoice> {
		return this.namesFor('dest', matrix)
	}

	/**
	 * Union of a name kind across every configured matrix, keyed by number.
	 * The primary matrix's label wins for shared numbers; other matrices fill
	 * in numbers the primary does not have. Used for the by-name dropdowns,
	 * which cannot depend on the sibling "matrix" option.
	 */
	public mergedNames(kind: 'source' | 'dest'): Map<number, DropdownChoice> {
		const merged = new Map<number, DropdownChoice>(this.namesFor(kind, this.primaryMatrix))
		for (const m of this.matrices) {
			if (m.id === this.primaryMatrix) continue
			for (const [id, choice] of this.namesFor(kind, m.id)) {
				if (!merged.has(id)) merged.set(id, choice)
			}
		}
		return merged
	}

	/**
	 * Start the initial-load gate (startup / config change only — not reconnects).
	 * Companion pushes are deferred until flushAfterLoad().
	 */
	private startLoadingGate(): void {
		this.loadingGate.start({
			namesRequired: !!this.config.read_names_on_connect,
			tallyRequired: !!this.config.tally_dump_and_update,
			onFlush: (reason) => this.flushAfterLoad(reason),
		})
	}

	/**
	 * Push deferred definitions/values/actions once, then lift the gate.
	 */
	private flushAfterLoad(reason: string): void {
		this.log('info', `Initial load finished (${reason}), pushing data`)

		// Drop any trailing debounced work scheduled during the gate so we do one clean push
		this.debouncedUpdate.cancel()
		this.debouncedCrosspointUpdate.cancel()
		this.throttledFeedbackCheck.cancel()

		// Force a full resync — Companion resets values when definitions change, and the
		// value cache may be stale relative to everything accumulated while gated
		this.lastVariables.clear()
		this.lastVariableDefinitions.clear()

		this.updateVariableDefinitions()
		this.updateAllNames()
		this.updateAllCrosspoints()
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.setVariableValuesCached({
			is_loading_ports: 'false',
			Source: this.selected_source,
			Destination: this.selected_dest,
		})
		this.checkAllFeedbacks()
	}

	private get isConnectionUnhealthy(): boolean {
		const now = Date.now()

		// queue.pending = actively running tasks (0 or 1 with concurrency:1)
		// queue.size = waiting to run
		const waitingForAck = this.queue.pending > 0

		const stalledWhileBusy = waitingForAck && now - this.lastAckAt > 3000

		const tooManyFailures = this.consecutiveAckFailures >= 3
		if (tooManyFailures) {
			this.log('warn', `${this.consecutiveAckFailures} consecutive ACK failures`)
		}

		return stalledWhileBusy || tooManyFailures
	}

	// tcp.js functions

	private async sendNak(): Promise<void> {
		this.log('debug', 'Sending NAK')
		await this.sendRaw(Buffer.from([DLE, NAK]))
	}

	private async sendAck(): Promise<void> {
		//this.log('debug', 'Sending ACK')
		await this.sendRaw(Buffer.from([DLE, ACK]))
	}

	/**
	 * Stuff DLE bytes in the data
	 * @param {Array<number>} data
	 * @returns {Array<number>}
	 */
	private stuffDLE(data: number[]): number[] {
		const output = new Array<number>()
		// replace byte value 10 (DLE) in data with 1010
		for (let j = 0; j < data.length; ++j) {
			output.push(data[j])
			if (data[j] === DLE) {
				output.push(DLE)
			}
		}
		return output
	}

	private async waitForAck(): Promise<void> {
		return new Promise((resolve, reject) => {
			// eslint-disable-next-line prefer-const
			let entry: AckCallback

			const timeout = setTimeout(() => {
				const index = this.ackCallbacks.indexOf(entry)
				if (index !== -1) this.ackCallbacks.splice(index, 1)
				reject(new Error('ACK timeout'))
			}, this.ackTimeoutMs)

			entry = {
				resolve: () => {
					clearTimeout(timeout)
					resolve()
				},
				reject: () => {
					clearTimeout(timeout)
					reject(new Error('NAK received'))
				},
			}

			this.ackCallbacks.push(entry)
		})
	}

	private async readTally(): Promise<void> {
		if (this.config.extended_support || this.hasCommandSafe(cmds.extendedCrosspointTallyDump)) {
			this.loadingGate.setTallyLevelsExpected(this.effectiveLevels * this.matrices.length)
			for (const m of this.matrices) {
				for (let i = 0; i < this.effectiveLevels; i++) {
					await this.sendMessage([cmds.extendedCrosspointTallyDump, m.id - 1, i])
				}
			}
		} else {
			this.loadingGate.setTallyLevelsExpected(this.protocolLevels * this.matrices.length)
			for (const m of this.matrices) {
				for (let i = 0; i < this.protocolLevels; i++) {
					await this.sendMessage([cmds.crosspointTallyDump, ((m.id - 1) << 4) | (i & 0x0f)])
				}
			}
		}
	}

	/**
	 * True if the cmdCode is reported as supported. Fallsback to true when the supported commands array is empty or not using supported command on connect
	 * @param {number } cmdCode
	 * @returns { boolean }
	 */

	private hasCommand(cmdCode: number): boolean {
		if (!this.config.supported_commands_on_connect || this.commands.length === 0) {
			return true
		}

		return this.commands.includes(cmdCode)
	}

	/**
	 * True if the cmdCode is reported as supported. Fallsback to false
	 * @param {number } cmdCode
	 * @returns { boolean }
	 */

	private hasCommandSafe(cmdCode: number): boolean {
		return this.commands.includes(cmdCode)
	}

	/**
	 * Encapsulate a message and send it to the router bypassing the message queue (for ACK / NAK)
	 * @param {Buffer} message
	 * @returns { Promise<boolean> }
	 */

	private async sendRaw(message: Buffer): Promise<void> {
		if (this.socket?.isConnected) {
			await this.socket.sendAsync(message)
		}
	}

	/**
	 * Encapsulate a message and send it to the router
	 * @param {Buffer|Array} message
	 * @returns { Promise<boolean> }
	 */
	public async sendMessage(message: Buffer | Array<number>): Promise<void> {
		const msg = message instanceof Buffer ? message : Buffer.from(message)

		if (msg.length > 0) {
			// check that the command is implemented in the router
			const cmdCode = msg[0]

			if (
				cmdCode !== cmds.protocolImplementation &&
				cmdCode !== cmds.commandEnable &&
				this.config.supported_commands_on_connect === true &&
				this.commands.length > 0
			) {
				if (!this.hasCommand(cmdCode)) {
					this.log('warn', `Command code ${cmdCode} is not implemented by this hardware`)
					return
				}
			}
		}

		const packet = Array.from(msg)
		const length = msg.length

		// calculate checksum of DATA and BTC
		let crc = 0

		// replace byte value 10 (DLE) in data with 1010
		for (let j = 0; j < packet.length; ++j) {
			crc += packet[j]
			if (packet[j] === DLE) {
				packet.splice(j, 0, DLE)
				j++
			}
		}
		crc += length

		// Message structure:
		// +-----+---~~---+-----+-----+-----+
		// | SOM |  DATA  | BTC | CHK | EOM |
		// +-----+---~~---+-----+-----+-----+
		// SOM = DLE + STX (Start of Message)
		// EOM = DLE + ETX (End of Message)
		// BTC = length of data

		// Add SOM at the beginning
		packet.unshift(DLE, STX)

		// Add BTC, CHK, EOM at the end
		packet.push(...this.stuffDLE([length, (~crc + 1) & 0xff]), DLE, ETX)

		const packetBuffer = Buffer.from(packet)

		this.log('debug', `Sending >> ${packetBuffer.toString('hex')}`)

		await this.queue.add(async () => {
			if (!this.socket?.isConnected) {
				this.log('warn', 'Socket not connected')
				return
			}

			const maxAttempts = ackMaxAttempts
			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
				const ack = this.waitForAck()
				try {
					await this.socket.sendAsync(packetBuffer)
					await ack
					this.lastAckAt = Date.now()
					this.consecutiveAckFailures = 0
					return
				} catch (_e) {
					this.consecutiveAckFailures++
					if (attempt < maxAttempts && this.socket?.isConnected) {
						this.log('warn', `Attempt ${attempt} failed, retrying: ${packetBuffer.toString('hex')}`)
					} else {
						this.log('warn', `All attempts failed: ${packetBuffer.toString('hex')}`)
					}
				}
			}
		})
	}

	private init_tcp(): void {
		let receivebuffer = Buffer.alloc(0)

		if (this.socket !== null) {
			this.socket.destroy()
			this.socket.removeAllListeners()
			// biome-ignore lint/performance/noDelete: not really a performance issue
			this.socket = null
		}

		this.stopKeepAliveTimer()

		if (this.config.host) {
			this.socket = new TCPHelper(this.config.host, Number.parseInt(this.config.port))

			this.socket.on('status_change', (status, message) => {
				this.updateStatus(status, message)
			})

			this.socket.on('error', (err) => {
				this.log('error', `Network error: ${err.message}`)
				this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
				this.stopKeepAliveTimer()
				this.clearSupportedCommandsTimer()
			})

			this.socket.on('end', () => {
				this.stopKeepAliveTimer()
				this.clearSupportedCommandsTimer()
				this.log('warn', `Connection to ${this.config.host} ended`)
				this.ackCallbacks = []
			})

			this.socket.on('connect', () => {
				this.log('info', `Connected to ${this.config.host}:${this.config.port}`)
				this.lastAckAt = Date.now() // ← prevents false unhealthy on first message
				this.ackCallbacks = []
				this.commands = []
				this.routeMap = new Map()
				this.interrogatedDests.clear()
				this.lastVariables = new Map()
				this.lastVariableDefinitions = new Map()
				receivebuffer = Buffer.alloc(0)
				this.updateStatus(InstanceStatus.Ok, 'Connected')

				if (this.loadingGate.isActive) {
					// Startup / config-change gate: track completion, suppress Companion pushes until flush
					this.loadingGate.prepareForConnect()
					this.setVariableValuesCached({ is_loading_ports: 'true' })
					this.loadingGate.completeIfNothingRequired()
				}
				// Reconnects: gate stays inactive — keep pushing updates as data arrives

				if (this.config.supported_commands_on_connect === true) {
					this.requestSupportedCommands()
				} else {
					this.readInitialData()
				}
				this.subscribeActions()
				if (!this.loadingGate.isActive) {
					this.checkAllFeedbacks()
				}
				this.startKeepAliveTimer()
			})

			this.socket.on('data', (chunk) => {
				receivebuffer = Buffer.concat([receivebuffer, chunk])
				while (receivebuffer.length > 0) {
					// parseData will return the number of bytes consumed, and will retry until no more data is present

					try {
						const bytesConsumed = this.decode(receivebuffer)
						if (bytesConsumed === 0) break
						receivebuffer = receivebuffer.subarray(bytesConsumed)
					} catch (e) {
						this.log('error', `Failed to decode packet: ${e instanceof Error ? e.message : String(e)}`)
						receivebuffer = receivebuffer.subarray(1) // skip bad byte and keep trying
					}
				}
			})
		}
	}

	/** Request names and tally, as enabled in the config. */
	private readInitialData(): void {
		if (this.config.read_names_on_connect) {
			this.readNames().catch(() => {})
		}
		if (this.config.tally_dump_and_update) {
			this.readTally().catch(() => {})
		}
	}

	/**
	 * Ask the router which commands it implements, then read names and tally.
	 * Routers such as Lawo VSM never answer, so after
	 * {@link supportedCommandsTimeout} the initial read goes ahead without the
	 * list (every command is then assumed supported).
	 */
	private requestSupportedCommands(): void {
		this.clearSupportedCommandsTimer()
		this.supportedCommandsTimer = setTimeout(() => {
			delete this.supportedCommandsTimer
			this.log(
				'warn',
				'Router did not report its supported commands, continuing without them. Consider disabling "Request supported commands".',
			)
			this.readInitialData()
		}, supportedCommandsTimeout)
		this.sendMessage([cmds.protocolImplementation]).catch(() => {})
	}

	private clearSupportedCommandsTimer(): void {
		if (this.supportedCommandsTimer) {
			clearTimeout(this.supportedCommandsTimer)
			delete this.supportedCommandsTimer
		}
	}

	// keepalive.js functions

	private startKeepAliveTimer(): void {
		if (this.keepAliveTimer) {
			clearInterval(this.keepAliveTimer)
		}
		this.keepAliveTimer = setInterval(() => {
			void this.keepAlive()
		}, keepAliveTime)
	}

	private stopKeepAliveTimer(): void {
		if (this.keepAliveTimer) {
			clearInterval(this.keepAliveTimer)
			// biome-ignore lint/performance/noDelete: not really a performance issue
			delete this.keepAliveTimer
		}
	}

	private async keepAlive(): Promise<void> {
		if (this.socket?.isConnected) {
			if (this.isConnectionUnhealthy) {
				this.log('warn', 'Connection looks unhealthy, sending probe')
				await this.getCrosspoints(1, 1, this.primaryMatrix)
				return
			}
			// Query crosspoint as proxy for proper keep alive message if the queue is empty
			if (this.queue.size === 0 && this.queue.pending === 0) {
				await this.getCrosspoints(1, 1, this.primaryMatrix) // Query a crosspoint since there isnt a specificed keep alive message
			}
		}
	}

	// crosspoints.js functions

	private crosspointConnected(data: number[] | Buffer): void {
		const matrix = ((data[1] & 0xf0) >> 4) + 1
		const level = (data[1] & 0x0f) + 1
		const dest = ((data[2] & 0x70) << 3) + data[3] + 1
		const source = ((data[2] & 0x07) << 7) + data[4] + 1

		if (!this.isConfiguredMatrix(matrix)) {
			this.log('debug', `Ignoring crosspoint tally for unconfigured matrix ${matrix}`)
			return
		}

		this.log('debug', `Source ${source} routed to destination ${dest} on matrix ${matrix} level ${level}`)

		this.update_crosspoints(matrix, source, dest, level)
	}

	private ext_crosspointConnected(data: number[] | Buffer): void {
		const matrix = data[1] + 1
		const level = data[2] + 1
		const dest = ((data[3] << 8) | data[4]) + 1
		const source = ((data[5] << 8) | data[6]) + 1

		if (!this.isConfiguredMatrix(matrix)) {
			this.log('debug', `Ignoring crosspoint tally for unconfigured matrix ${matrix}`)
			return
		}

		this.log('debug', `Source ${source} routed to destination ${dest} on matrix ${matrix} level ${level}`)

		this.update_crosspoints(matrix, source, dest, level)
	}

	private setRoutemap(matrix: number, source: number, dest: number, level: number): boolean {
		const byDest = this.routeMapFor(matrix)
		let map = byDest.get(dest)
		if (!map) {
			map = new Map()
			byDest.set(dest, map)
		}

		if (map.get(level) === source) return false
		map.set(level, source)
		return true
	}

	public getRoutemapEntries(
		matrix: number,
		dest: number,
	): {
		[k: string]: number
	} {
		const map = this.routeMap.get(matrix)?.get(dest)
		if (map) {
			const sources = Object.fromEntries(map.entries())
			return sources
		}
		return {}
	}

	public hasSourceInAnyLevelRoutemap(matrix: number, dest: number, source: number): boolean {
		const map = this.routeMap.get(matrix)?.get(dest)
		if (!map) return false
		for (const entry of map.values()) {
			if (entry === source) return true
		}
		return false
	}

	public hasSourceInRoutemap(matrix: number, level: number, dest: number, source: number): boolean {
		return this.routeMap.get(matrix)?.get(dest)?.get(level) === source
	}

	public getSourceInRoutemap(matrix: number, level: number, dest: number): number | undefined {
		return this.routeMap.get(matrix)?.get(dest)?.get(level)
	}

	/** `matrix:dest` pairs already interrogated on this connection, see {@link ensureCrosspointsKnown}. */
	private interrogatedDests = new Set<string>()

	/**
	 * Interrogate every level of a destination once per connection, so
	 * crosspoint feedbacks get state even when the router does not answer the
	 * tally dump (e.g. Lawo VSM). Later changes arrive as crosspoint tallies.
	 */
	public ensureCrosspointsKnown(matrix: number, dest: number): void {
		if (!Number.isInteger(dest) || dest < 1 || !this.isConfiguredMatrix(matrix)) return
		const key = `${matrix}:${dest}`
		if (this.interrogatedDests.has(key)) return
		this.interrogatedDests.add(key)
		this.getCrosspoints(dest, undefined, matrix).catch(() => {})
	}

	// Utility function ie lieu of Feedback subscribe
	public hasDestInRoutemap(matrix: number, dest: number): boolean {
		return (this.routeMap.get(matrix)?.get(dest)?.size ?? 0) > 0
	}

	/**
	 * Process crosspoint tally dump
	 * @param {Buffer} data
	 */
	private processCrosspointTallyDump(data: Buffer): void {
		const type = data[0] === cmds.crosspointTallyDumpByteResponse ? 'byte' : 'word'
		const matrix = ((data[1] & 0xf0) >> 4) + 1
		const level = (data[1] & 0x0f) + 1

		this.processCrosspointTallyDumpData(data, matrix, level, type, 2)
		this.loadingGate.markTallyLevelReceived(matrix, level)
	}

	/**
	 * General function for processing crosspoint tally dumps
	 * @param {Buffer} data
	 * @param {number} matrix Matrix number
	 * @param {number} level Level number
	 * @param {'byte'|'word'} type Type of data (byte or word)
	 * @param {number} offset Offset in the buffer where the data starts
	 */
	private processCrosspointTallyDumpData(
		data: Buffer,
		matrix: number,
		level: number,
		type: 'byte' | 'word',
		offset: number,
	): void {
		const tallies = data[offset]

		if (!this.isConfiguredMatrix(matrix)) {
			this.log('debug', `Ignoring tally dump for unconfigured matrix ${matrix}`)
			return
		}

		this.log('debug', `Crosspoint tally dump for matrix ${matrix} level ${level} are going to read ${tallies} tallies`)

		const psize = (type === 'byte' ? 1 : 2) * tallies
		if (psize > 133 - 3) {
			this.log(
				'warn',
				`Tally dump for matrix ${matrix} level ${level} has ${tallies} tallies (${psize + 3} exceeds the maximum size of 133 bytes per packet)`,
			)
		}

		if (tallies > 64) {
			this.log(
				'warn',
				`Tally dump for matrix ${matrix} level ${level} has ${tallies} tallies (more than 64 specified as limit by protocol)`,
			)
		}

		const variables: Record<string, string | number> = {}
		let changed = false
		let currentOffset = offset + 1
		if (type === 'byte') {
			let dest = data.readUInt8(currentOffset) + 1
			currentOffset += 1
			for (let i = 0; i < tallies; i++) {
				if (currentOffset + 1 > data.length) {
					this.log(
						'warn',
						`Tally dump for matrix ${matrix} level ${level} has ${tallies} tallies but only ${data.length} bytes available`,
					)
					break
				}
				const source = data.readUInt8(currentOffset) + 1
				if (this.setRoutemap(matrix, source, dest, level)) {
					Object.assign(variables, this.getCrosspointVariableValues(matrix, source, dest, level))
					changed = true
				}
				dest++
				currentOffset++
			}
		} else {
			let dest = data.readUInt16BE(currentOffset) + 1
			currentOffset += 2
			for (let i = 0; i < tallies; i++) {
				const source = data.readUInt16BE(currentOffset) + 1
				if (this.setRoutemap(matrix, source, dest, level)) {
					Object.assign(variables, this.getCrosspointVariableValues(matrix, source, dest, level))
					changed = true
				}
				currentOffset += 2
				dest++
			}
		}

		if (changed) {
			this.setVariableValuesCached(variables)
			this.addCrosspointFeedbacksToCheck()
		}
	}

	/**
	 * Process extended crosspoint tally dump (word)
	 * @param {Buffer} data
	 */
	private processExtCrosspointTallyDump(data: Buffer): void {
		const matrix = data[1] + 1
		const level = data[2] + 1

		// we only know about word-style extended tally dumps
		this.processCrosspointTallyDumpData(data, matrix, level, 'word', 3)
		this.loadingGate.markTallyLevelReceived(matrix, level)
	}

	/**
	 * Source label for a source number on a given matrix, '' when unknown.
	 */
	private sourceNameLabel(matrix: number, source: number): string {
		try {
			return stripNumber(this.namesFor('source', matrix).get(source - 1)?.label || 'N/A')
		} catch (e: any) {
			this.log('debug', `Unable to read source name: ${e instanceof Error ? e.message : e.toString()}`)
			return 'N/A'
		}
	}

	/**
	 * Names for the "selected destination source" variables for one matrix.
	 * The primary matrix (or, when it is the selected one, the selected matrix)
	 * also fills the historic un-namespaced `Sel_Dest_Source_*` names.
	 */
	private selDestSourceVarNames(matrix: number, level: number): string[] {
		const scoped = [
			`Sel_Dest_Source_Matrix_${matrix}_Level_${level}`,
			`Sel_Dest_Source_Name_Matrix_${matrix}_Level_${level}`,
		]
		if (matrix === this.selected_matrix) {
			return [...scoped, `Sel_Dest_Source_Level_${level}`, `Sel_Dest_Source_Name_Level_${level}`]
		}
		return scoped
	}

	private updateAllCrosspoints(): void {
		const variables = new Map<string, string | number>()

		if (this.selected_dest) {
			for (const m of this.matrices) {
				const map = this.routeMap.get(m.id)?.get(this.selected_dest) ?? new Map<number, number>()
				const hasSourceNames = this.namesFor('source', m.id).size > 0
				const isSel = m.id === this.selected_matrix

				for (let level = 1; level <= this.effectiveLevels; level++) {
					const routed = map.has(level)
					const source = routed ? (map.get(level) ?? 0) : -1
					const name = routed ? (hasSourceNames ? this.sourceNameLabel(m.id, source) : undefined) : 'N/A'

					variables.set(`Sel_Dest_Source_Matrix_${m.id}_Level_${level}`, source)
					if (name !== undefined) variables.set(`Sel_Dest_Source_Name_Matrix_${m.id}_Level_${level}`, name)
					if (isSel) {
						variables.set(`Sel_Dest_Source_Level_${level}`, source)
						if (name !== undefined) variables.set(`Sel_Dest_Source_Name_Level_${level}`, name)
					}
				}
			}
		}

		if (this.config.tally_dump_variables) {
			for (const [matrix, byDest] of this.routeMap) {
				for (const [dest, levels] of byDest) {
					for (const [level, source] of levels) {
						variables.set(getRouteVariableName(level, dest, matrix, this.primaryMatrix), source)
					}
				}
			}
		}

		this.setVariableValuesCached(Object.fromEntries(variables))

		this.addFeedbacksToCheck(
			FeedbackIds.SourceDestRoute,
			FeedbackIds.CrosspointConnected,
			FeedbackIds.CrosspointConnectedByName,
			FeedbackIds.CrosspointConnectedByLevel,
			FeedbackIds.DestinationSourceName,
		)
	}

	private record_crosspoint(matrix: number, source: number, dest: number, level: number): void {
		if (this.isRecordingActions) {
			this.recordAction(
				{
					actionId: 'set_crosspoint',
					options: { matrix: matrix, level: [level], source: source, dest: dest },
				},
				`connect matrix ${matrix} dest ${dest} level ${level}`,
			)
		}
	}

	private getCrosspointVariableValues(
		matrix: number,
		source: number,
		dest: number,
		level: number,
	): Record<string, string | number> {
		const variables: Record<string, string | number> = {}

		if (dest === this.selected_dest) {
			const hasNames = this.namesFor('source', matrix).size > 0
			const name = hasNames ? this.sourceNameLabel(matrix, source) : undefined
			for (const key of this.selDestSourceVarNames(matrix, level)) {
				if (key.includes('_Name_')) {
					if (name !== undefined) variables[key] = name
				} else {
					variables[key] = source
				}
			}
		}

		if (this.config.tally_dump_variables) {
			variables[getRouteVariableName(level, dest, matrix, this.primaryMatrix)] = source
		}

		return variables
	}

	private addCrosspointFeedbacksToCheck(): void {
		this.addFeedbacksToCheck(
			FeedbackIds.SourceDestRoute,
			FeedbackIds.CrosspointConnected,
			FeedbackIds.CrosspointConnectedByName,
			FeedbackIds.CrosspointConnectedByLevel,
			FeedbackIds.DestinationSourceName,
		)
	}

	private update_crosspoints(matrix: number, source: number, dest: number, level: number): void {
		this.setVariableValuesCached(this.getCrosspointVariableValues(matrix, source, dest, level))
		this.setRoutemap(matrix, source, dest, level)
		this.addCrosspointFeedbacksToCheck()
		this.record_crosspoint(matrix, source, dest, level)
	}

	public async SetCrosspoint(
		sourceN: number,
		destN: number,
		levelN: number,
		matrixN: number = this.primaryMatrix,
	): Promise<void> {
		const cmd = []
		this.log('debug', `Crosspoint ${sourceN}>${destN} matrix ${matrixN} level ${levelN}`)

		if (Number.isNaN(sourceN) || sourceN <= 0 || sourceN > 65536) {
			this.log('warn', `Unable to route source ${sourceN}`)
			return
		}

		if (Number.isNaN(destN) || destN <= 0 || destN > 65536) {
			this.log('warn', `Unable to route destination ${destN}`)
			return
		}

		if (Number.isNaN(levelN) || levelN < 1 || levelN > 256) {
			this.log('warn', `Unable to route level ${levelN}`)
			return
		}

		if (!Number.isInteger(matrixN) || matrixN < 1 || matrixN > this.matrixMax) {
			this.log('warn', `Unable to route matrix ${matrixN}`)
			return
		}

		const source = sourceN - 1
		const dest = destN - 1
		const level = levelN - 1
		const matrix = matrixN - 1

		if (
			((source > 1023 || dest > 1023 || level > 15) && this.hasCommand(cmds.extendedCrosspointConnect)) ||
			this.hasCommandSafe(cmds.extendedCrosspointConnect)
		) {
			if (this.config.extended_support === false) {
				this.log(
					'warn',
					'Doing a crosspoint connect with a value outside of the normal command range, but extended support is not enabled, using extended command anyway',
				)
			}
			// Extended command required
			cmd.push(cmds.extendedCrosspointConnect)
			// Matrix
			cmd.push(matrix)
			// Level
			cmd.push(level)
			// Dest DIV 256
			cmd.push(dest >> 8)
			// Destination MOD 256
			cmd.push(dest & 0xff)
			// Source DIV 256
			cmd.push(source >> 8)
			// Source MOD 256
			cmd.push(source & 0xff)
		} else {
			if (source > 1023 || dest > 1023 || level > 15) {
				this.log(
					'error',
					'Doing a crosspoint connect with a source, destination or level value outside of the normal command range, but extended support is not supported by the device, cannot do crosspoint.',
				)
				return
			}

			if (matrixN > 16) {
				this.log(
					'error',
					`Doing a crosspoint connect on matrix ${matrixN}, but that exceeds the standard command range and extended support is not available.`,
				)
				return
			}

			// Standard Command
			cmd.push(cmds.crosspointConnect)
			// Matrix and Level
			cmd.push((matrix << 4) | (level & 0x0f))
			// Multiplier if source or dest > 128
			cmd.push(
				((source >> 7) & 0x07) | // source DIV 128 Bits 0-2
					(((dest >> 7) & 0x07) << 4), // dest DIV 128 Bits 4-6
			)
			// Destination MOD 128
			cmd.push(dest & 0x7f)
			// Source MOD 128
			cmd.push(source & 0x7f)
		}

		await this.sendMessage(cmd)
		this.scheduleCrosspointConfirm(matrixN, destN, levelN)
	}

	/** Pending confirm interrogations, keyed `matrix:dest:level`. */
	private crosspointConfirmTimers = new Map<string, NodeJS.Timeout>()

	/**
	 * Interrogate a crosspoint shortly after connecting it. Some routers (e.g.
	 * Lawo VSM) do not send a Crosspoint Connected tally for routes made by this
	 * controller, so without this the feedback only updates on the next
	 * keep-alive. Repeated connects to the same crosspoint share one query.
	 */
	private scheduleCrosspointConfirm(matrix: number, dest: number, level: number): void {
		const key = `${matrix}:${dest}:${level}`
		const pending = this.crosspointConfirmTimers.get(key)
		if (pending) clearTimeout(pending)
		this.crosspointConfirmTimers.set(
			key,
			setTimeout(() => {
				this.crosspointConfirmTimers.delete(key)
				this.getCrosspoints(dest, level, matrix).catch(() => {})
			}, crosspointConfirmDelay),
		)
	}

	private clearCrosspointConfirmTimers(): void {
		for (const timer of this.crosspointConfirmTimers.values()) clearTimeout(timer)
		this.crosspointConfirmTimers.clear()
	}

	/**
	 * Interrogate the router for the sources feeding a destination.
	 *
	 * @param destN Destination (1-based). 0 means "nothing selected" and is a no-op.
	 * @param level Optional single level (1-based); omitted = every level.
	 * @param matrixN Optional matrix (1-based); omitted = every configured matrix.
	 */
	public async getCrosspoints(destN: number, level?: number, matrixN?: number): Promise<void> {
		if (destN === 0) {
			// 0 means no destination is currently selected, nothing to query
			return
		}

		this.log('debug', `GetCrosspoint ${destN}`)

		if (destN < 0 || destN > 65536 || !Number.isInteger(destN)) {
			this.log('warn', `Unable to get crosspoint destination ${destN}`)
			return
		}

		const targets = matrixN === undefined ? this.matrices.map((m) => m.id) : [matrixN]
		for (const m of targets) {
			await this.interrogateMatrix(m, destN, level)
		}
	}

	/**
	 * Interrogate one matrix. See {@link getCrosspoints}.
	 */
	private async interrogateMatrix(matrixN: number, destN: number, level?: number): Promise<void> {
		const dest = destN - 1
		const matrix = matrixN - 1

		if (
			((this.effectiveLevels > 16 || dest > 1023) && this.hasCommand(cmds.extendedInterrogate)) ||
			this.hasCommandSafe(cmds.extendedInterrogate)
		) {
			// check requested levels, or all levels if none specified
			const levels = level === undefined ? Array.from({ length: this.effectiveLevels }, (_, i) => i) : [level - 1]
			for (const i of levels) {
				await this.sendMessage([
					// Extended commands
					cmds.extendedInterrogate,
					// Matrix
					matrix,
					// Level
					i,
					// Dest DIV 256
					dest >> 8,
					// Dest Mod 256
					dest & 0xff,
				])
			}
		} else {
			if (this.effectiveLevels > 16 || dest > 1023) {
				this.log(
					'error',
					'Doing a crosspoint interrogate with a source, destination or level value outside of the normal command range, but extended support is not supported by the device, cannot do crosspoint interrogate.',
				)
				return
			}

			if (matrixN > 16) {
				this.log(
					'error',
					`Cannot interrogate matrix ${matrixN}: exceeds standard command range without extended support.`,
				)
				return
			}

			// check requested levels, or all levels if none specified
			const levels = level === undefined ? Array.from({ length: this.protocolLevels }, (_, i) => i) : [level - 1]
			for (const i of levels) {
				await this.sendMessage([
					// Standard commands
					cmds.crosspointInterrogate,
					// Matrix and Level
					(matrix << 4) | (i & 0x0f),
					// Multiplier dest > 128
					((dest >> 7) & 0x07) << 4, // dest DIV 128 Bits 4-6
					dest & 0x7f, // Destination MOD 128
				])
			}
		}
	}

	// decode.js functions
	/**
	 * Decode one message, handling DLE escaping, packet length and checksum
	 * @param {Buffer} data
	 */
	private decode(data: Buffer): number {
		if (data.length < 2) {
			return 0
		}
		if (data[0] !== DLE) {
			this.log('warn', 'Invalid message start')
			// protocol error, consume the byte, until we find a proper DLE, by returning 1
			return 1
		}

		if (data[1] === ACK || data[1] === NAK) {
			// ACK or NAK
			if (this.ackCallbacks.length === 0) {
				this.log('warn', 'Got unexpected ACK/NAK')
			} else {
				if (data[1] === ACK) {
					this.lastAckAt = Date.now()
					this.consecutiveAckFailures = 0
					this.ackCallbacks.shift()?.resolve()
				} else {
					this.ackCallbacks.shift()?.reject()
				}
			}
			return 2
		}

		if (data[1] !== STX) {
			this.log('warn', 'Invalid message start')
			// protocol error, consume the byte, until we find a proper DLE, by returning 1
			return 1
		}

		for (let j = 0; j < data.length - 1; j++) {
			if (data[j] === DLE && data[j + 1] === ETX) {
				// We found ETX, now check the checksum, length, remove DLE escaping, and process message
				let packet = Buffer.alloc(j)
				let packetIndex = 0
				let crc = 0

				// Remove DLE escaping
				for (let k = 2; k < j; k++) {
					if (data[k] === DLE && data[k + 1] === DLE) {
						k++
						packet[packetIndex++] = DLE
						continue
					}
					packet[packetIndex++] = data[k]
				}

				// Trim the packet to the correct size
				packet = packet.subarray(0, packetIndex)

				// Calculate CRC on the unescaped data: all bytes except CHK (last byte)
				for (let k = 0; k < packet.length - 1; k++) {
					crc += packet[k]
				}

				// Check packet size
				if (packet[packet.length - 2] !== packet.length - 2) {
					// length - 2 = length of packet - BTC - CHK
					this.log('warn', `Invalid packet length ${packet[packet.length - 2]} != ${packet.length - 2}`)
					this.log(
						'debug',
						`Invalid packet length ${packet[packet.length - 2]} != ${packet.length - 2} in ${getCommandName(packet[0])} packet: ${data.toString('hex')}`,
					)
					void this.sendNak()
					return j + 2
				}

				// Two's complement checksum
				crc = (~(crc & 0xff) + 1) & 0xff
				if (crc !== packet[packet.length - 1]) {
					this.log('warn', `Invalid checksum ${crc} != ${packet[packet.length - 1]}`)
					this.log(
						'debug',
						`Invalid checksum ${crc} != ${packet[packet.length - 1]} in ${getCommandName(packet[0])} packet: ${data.toString('hex')}`,
					)
					void this.sendNak()
					return j + 2
				}

				// Always acknowledge the packet if it is valid on a packet level
				void this.sendAck()

				// Process the message
				this.processMessage(packet.subarray(0, packet.length - 2))

				return j + 2
			}
		}

		// No ETX found, return 0
		this.log('debug', `No ETX found, waiting for more data (has ${data.length} bytes): ${data.toString('hex')}`)

		return 0
	}

	/**
	 * Process one message, handling the response
	 * @param {Buffer} message
	 */
	private processMessage(message: Buffer): void {
		switch (message[0]) {
			// Command
			case cmds.crosspointTally:
			case cmds.crosspointConnected:
				// Crosspoint Tally, Crosspoint Connected
				this.crosspointConnected(message)
				break

			case cmds.extendedCrosspointTally:
			case cmds.extendedCrosspointConnected:
				// Extended Crosspoint Connected
				this.ext_crosspointConnected(message)
				break

			case cmds.protocolImplementationResponse:
				// Protocol Implementation Response
				this.commands = []

				for (let j = 3; j < message.length; j++) {
					this.commands.push(message[j])
				}

				this.log(
					'debug',
					`This router implements: ${this.commands.map((c) => `0x${c.toString(16).padStart(2, '0')}: ${getCommandName(c)}`).join(', ')}`,
				)

				if (this.supportedCommandsTimer) {
					this.clearSupportedCommandsTimer()
					this.readInitialData()
				}
				break

			case cmds.sourceNamesResponse:
				this.processLabels(message, { hasMatrix: true, hasLevels: true, extended: false })
				break

			case cmds.destNamesResponse:
				this.processLabels(message, { hasMatrix: true, hasLevels: false, extended: false })
				break

			case cmds.extendedSourceNamesResponse:
				// Extended Source Names Reply
				this.processLabels(message, { hasMatrix: true, hasLevels: true, extended: true })
				break

			case cmds.extendedDestNamesResponse:
				// Extended Destination Names Reply
				this.processLabels(message, { hasMatrix: true, hasLevels: false, extended: true })
				break

			case cmds.crosspointTallyDumpByteResponse:
			case cmds.crosspointTallyDumpWordResponse:
				// Crosspoint Tally Dump
				this.processCrosspointTallyDump(message)
				break
			case cmds.extendedCrosspointTallyDumpWordResponse:
				// Extended Crosspoint Tally Dump
				this.processExtCrosspointTallyDump(message)
				break

			default:
				this.log(
					'warn',
					`Unsupported response code 0x${message[0].toString(16).padStart(2, '0')}: ${getCommandName(message[0])}`,
				)
				this.log(
					'debug',
					`Unsupported response code 0x${message[0].toString(16).padStart(2, '0')} in response: ${message.toString('hex')}`,
				)
				break
		}
	}

	// labels.js functions

	/**
	 * Process labels defined by the options
	 * @param {Buffer} data - Data section of packet
	 * @param {ProcessLabelsOptions} options - Options for label parser
	 */
	private processLabels(data: Buffer, options: ProcessLabelsOptions): void {
		const char_length_table = [4, 8, 12]
		//let level = 0
		let matrixWire = this.primaryMatrix - 1
		let start: number
		let char_length: number
		let label_number: number
		let labels_in_part: number

		if (!options.extended) {
			let idx = 1
			// byte1 = matrix (in bits 4-7), level (in bits 3-0) per SW-P-08 spec
			if (options.hasMatrix) {
				matrixWire = (data[idx] & 0xf0) >> 4
			}
			// matrix and level share one byte
			idx++
			char_length = char_length_table[data[idx++]]
			label_number = (data[idx++] << 8) | data[idx++]
			labels_in_part = data[idx++]
			start = idx
		} else {
			let idx = 1
			if (options.hasMatrix) {
				matrixWire = data[idx++]
			}
			if (options.hasLevels) {
				idx++ //level = data[idx++] - advance past unused level byte
			}
			char_length = char_length_table[data[idx++]]
			label_number = (data[idx++] << 8) | data[idx++]
			labels_in_part = data[idx++]
			start = idx
		}

		const matrixId = matrixWire + 1
		if (!this.isConfiguredMatrix(matrixId)) {
			this.log('debug', `Ignoring labels for unconfigured matrix ${matrixId}`)
			return
		}

		this.extractLabels(data, matrixId, char_length, label_number, labels_in_part, start)
	}

	private extractLabels(
		data: Buffer,
		matrix: number,
		char_length: number,
		label_number: number,
		labels_in_part: number,
		start: number,
	): void {
		/*
	this.log('debug', `label chars: ${char_length}`)
	this.log('debug', `label number: ${label_number}`)
	this.log('debug', `labels in part: ${labels_in_part}`)
	*/

		const isDest = data[0] === cmds.destNamesResponse || data[0] === cmds.extendedDestNamesResponse
		const isSource = data[0] === cmds.sourceNamesResponse || data[0] === cmds.extendedSourceNamesResponse
		if (!isDest && !isSource) {
			this.log('debug', `Unknown label type ${data[0]}`)
			return
		}
		const target = this.namesFor(isDest ? 'dest' : 'source', matrix)

		for (let l = 0; l < labels_in_part; l++) {
			const pos = l * char_length
			const labelId = label_number + l + 1

			target.set(labelId, {
				id: labelId,
				label: data
					.subarray(start + pos, start + pos + char_length)
					.toString('utf8')
					.replace(/\0/g, '')
					.trim(),
			})
		}

		// keep the primary-matrix mirror pointed at the right map
		this.syncPrimaryNames()

		// update dropdown lists
		void this.debouncedUpdate()
		this.loadingGate.markNamesPacketReceived()
	}

	private updateAllNames(): void {
		const variables = new Map<string, string | number>()

		for (const m of this.matrices) {
			const isPrimary = m.id === this.primaryMatrix
			const sourcePrefix = isPrimary ? 'Source_' : `Source_Matrix_${m.id}_`
			const destPrefix = isPrimary ? 'Destination_' : `Destination_Matrix_${m.id}_`

			// biome-ignore lint/complexity/noForEach: better for maps
			this.namesFor('source', m.id).forEach((sourceValue) => {
				variables.set(`${sourcePrefix}${sourceValue.id}`, stripNumber(sourceValue.label))
			})
			// biome-ignore lint/complexity/noForEach: better for maps
			this.namesFor('dest', m.id).forEach((destValue) => {
				variables.set(`${destPrefix}${destValue.id}`, stripNumber(destValue.label))
			})

			variables.set(isPrimary ? 'Sources' : `Sources_Matrix_${m.id}`, this.namesFor('source', m.id).size)
			variables.set(isPrimary ? 'Destinations' : `Destinations_Matrix_${m.id}`, this.namesFor('dest', m.id).size)
		}

		this.setVariableValuesCached(Object.fromEntries(variables))
		this.feedbacksToCheck.add(FeedbackIds.DestinationSourceName)
		this.throttledFeedbackCheck()
	}

	// levels.js functions

	processLevelsSelection(selection: number[], state: boolean | 'toggle'): void {
		this.log('debug', `Processing Levels Selection: ${selection}`)

		for (const level of selection) {
			if (level < 1 || level > this.selected_level.length) continue
			if (state === 'toggle') {
				this.selected_level[level - 1].enabled = !this.selected_level[level - 1].enabled
			} else {
				this.selected_level[level - 1].enabled = state
			}
		}
		this.log('debug', `Selected levels: ${JSON.stringify(this.selected_level)}`)
		this.addFeedbacksToCheck(FeedbackIds.SelectedLevel, FeedbackIds.SelectedLevelDest, FeedbackIds.CanTake)
	}

	// names.js functions

	public async readNames(): Promise<void> {
		this.log('info', 'Reading names...')
		// reset every matrix's maps
		this.namesByMatrix = { source: new Map(), dest: new Map() }
		for (const m of this.matrices) {
			this.namesFor('source', m.id)
			this.namesFor('dest', m.id)
		}
		this.syncPrimaryNames()
		this.setVariableValuesCached({ Sources: 0, Destinations: 0 })

		const useExtended =
			(this.config.extended_support === true &&
				(this.hasCommand(cmds.extendedGetSourceNames) || this.hasCommand(cmds.extendedGetDestNames))) ||
			(this.hasCommandSafe(cmds.extendedGetSourceNames) && this.hasCommandSafe(cmds.extendedGetDestNames))

		const nameChars = Number.parseInt(this.config.name_chars)

		for (const m of this.matrices) {
			const cmdGetSources: number[] = []
			const cmdGetDestinations: number[] = []

			if (useExtended) {
				// extended commands (only gets source names for level 0)
				cmdGetSources.push(cmds.extendedGetSourceNames, m.id - 1, 0, nameChars)
				cmdGetDestinations.push(cmds.extendedGetDestNames, m.id - 1, nameChars)
			} else {
				// standard commands
				cmdGetSources.push(cmds.getSourceNames, (m.id - 1) << 4, nameChars)
				cmdGetDestinations.push(cmds.getDestNames, (m.id - 1) << 4, nameChars)
			}

			// get source names
			await this.sendMessage(cmdGetSources)
			// get dest names
			await this.sendMessage(cmdGetDestinations)
		}
	}

	// variables.js functions

	private setupVariables(): void {
		// Implemented Commands
		const varList: Partial<VarList> = {}
		this.commands = []

		// Hold values
		this.selected_dest = 0
		this.selected_source = 0

		if (!this.effectiveLevels || this.effectiveLevels < 1) {
			this.log('error', `Invalid levels configuration: ${this.effectiveLevels} aborting setupVariables`)
			return
		}

		// Matrices (needs config; primaryMatrix depends on this.matrices)
		this.setupMatrices()
		this.selected_matrix = this.primaryMatrix

		const currentLevels = this.effectiveLevels

		this.levels = []
		this.selected_level = []
		for (let i = 1; i <= currentLevels; i++) {
			this.levels.push({ id: i, label: `Level: ${i}` })
			this.selected_level.push({ id: i, enabled: true })
		}

		// Labels - one map per configured matrix
		this.namesByMatrix = { source: new Map(), dest: new Map() }
		for (const m of this.matrices) {
			this.namesFor('source', m.id)
			this.namesFor('dest', m.id)
		}
		this.syncPrimaryNames()

		this.updateVariableDefinitions()

		varList.is_loading_ports = 'true'
		varList.Sources = 0
		varList.Destinations = 0

		varList.Source = this.selected_source
		varList.Destination = this.selected_dest
		varList.Selected_Matrix = this.selected_matrix
		varList.Selected_Matrix_Label = this.matrices.find((m) => m.id === this.selected_matrix)?.label ?? ''

		this.setVariableValuesCached(varList as VarList)
	}

	/**
	 * Only set variable values if they have changed, easing the load on companion
	 * @param {VarList} object - Object with variable values to set
	 */
	public setVariableValuesCached(object: VarList): void {
		// During the initial-load gate, only allow is_loading_ports through
		if (this.loadingGate.isActive) {
			if (!('is_loading_ports' in object)) return
			object = { is_loading_ports: object.is_loading_ports }
		}

		const variablesToUpdate: Record<string, string | number> = {}
		for (const [key, value] of Object.entries(object)) {
			if (this.lastVariables.get(key) !== value) {
				this.lastVariables.set(key, value)
				variablesToUpdate[key] = value
			}
		}
		if (Object.keys(variablesToUpdate).length === 0) {
			return
		}
		this.setVariableValues(variablesToUpdate)
	}

	private updateVariableDefinitions(): void {
		const coreVariables: CompanionVariableDefinitions<Record<string, string | number>> = {}
		const multi = this.matrices.length > 1

		coreVariables['is_loading_ports'] = {
			name: 'True while initial port data is being loaded from the router',
		}
		coreVariables['Sources'] = {
			name: 'Number of source names returned by router',
		}
		coreVariables['Destinations'] = {
			name: 'Number of destination names returned by router',
		}
		coreVariables['Source'] = {
			name: 'Selected source',
		}
		coreVariables['Destination'] = {
			name: 'Selected destination',
		}
		if (multi) {
			coreVariables['Selected_Matrix'] = { name: 'Selected matrix number' }
			coreVariables['Selected_Matrix_Label'] = { name: 'Selected matrix label' }
		}

		for (let i = 1; i <= this.effectiveLevels; i++) {
			coreVariables[`Sel_Dest_Source_Level_${i}`] = {
				name: `Selected destination source for level ${i}`,
			}
			coreVariables[`Sel_Dest_Source_Name_Level_${i}`] = {
				name: `Selected destination source name for level ${i}`,
			}
		}

		for (const m of this.matrices) {
			const isPrimary = m.id === this.primaryMatrix
			const sourceCount = this.namesFor('source', m.id).size
			const destCount = this.namesFor('dest', m.id).size

			if (multi) {
				coreVariables[`Sources_Matrix_${m.id}`] = { name: `Source name count for matrix ${m.id} (${m.label})` }
				coreVariables[`Destinations_Matrix_${m.id}`] = {
					name: `Destination name count for matrix ${m.id} (${m.label})`,
				}
				for (let i = 1; i <= this.effectiveLevels; i++) {
					coreVariables[`Sel_Dest_Source_Matrix_${m.id}_Level_${i}`] = {
						name: `Selected destination source for matrix ${m.id} level ${i}`,
					}
					coreVariables[`Sel_Dest_Source_Name_Matrix_${m.id}_Level_${i}`] = {
						name: `Selected destination source name for matrix ${m.id} level ${i}`,
					}
				}
			}

			const sourcePrefix = isPrimary ? 'Source_' : `Source_Matrix_${m.id}_`
			const destPrefix = isPrimary ? 'Destination_' : `Destination_Matrix_${m.id}_`
			for (let i = 1; i <= sourceCount; i++) {
				coreVariables[`${sourcePrefix}${i}`] = { name: multi ? `Source ${i} (matrix ${m.id})` : `Source ${i}` }
			}
			for (let i = 1; i <= destCount; i++) {
				coreVariables[`${destPrefix}${i}`] = { name: multi ? `Destination ${i} (matrix ${m.id})` : `Destination ${i}` }
			}
		}

		if (this.config.tally_dump_variables) {
			this.routeMap.forEach((byDest, matrix) => {
				byDest.forEach((levels, dest) => {
					for (const level of levels?.keys() ?? []) {
						coreVariables[getRouteVariableName(level, dest, matrix, this.primaryMatrix)] = {
							name: `Source for matrix ${matrix} destination ${dest} at level ${level}`,
						}
					}
				})
			})
		}

		// Only update if there are changes to the variable definitions
		let changes = this.lastVariableDefinitions.size !== Object.keys(coreVariables).length
		if (!changes) {
			for (const [key, value] of Object.entries(coreVariables)) {
				if (!_.isEqual(this.lastVariableDefinitions.get(key), value)) {
					changes = true
					break
				}
			}
		}

		// No changes, no need to update
		if (!changes) {
			return
		}

		this.setVariableDefinitions(coreVariables)

		// Clear the value cache so all values are re-sent after definitions change,
		// since Companion core resets variable values when receiving new definitions
		this.lastVariables.clear()

		// Rebuild definition cache to remove stale entries
		this.lastVariableDefinitions.clear()
		for (const [key, value] of Object.entries(coreVariables)) {
			this.lastVariableDefinitions.set(key, value)
		}
	}
}
