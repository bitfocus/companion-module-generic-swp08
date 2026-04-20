// Generic SWP08 Routing
// Grass Valley - Snell - Probel - Ross
// https://wwwapps.grassvalley.com/docs/Manuals/sam/Protocols%20and%20MIBs/Router%20Control%20Protocols%20SW-P-88%20Issue%204b.pdf
//
// @author Peter Daniel
//
// Updated for Companion v3 July 2024, Phillip Ivan Pietruschka
// Converted to Typescript April 2026, Phillip Ivan Pietruschka

import {
	InstanceBase,
	runEntrypoint,
	InstanceStatus,
	TCPHelper,
	type SomeCompanionConfigField,
	DropdownChoice,
	CompanionVariableValues,
	CompanionVariableDefinition,
} from '@companion-module/base'
import { Buffer } from 'node:buffer'
import { UpgradeScripts } from './upgrades.js'
import { GetConfigFields, type SwP08Config } from './config.js'
import { ACK, NAK, DLE, STX, ETX, cmds, getCommandName, keepAliveTime } from './consts.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks, FeedbackIds } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import type { AckCallback, Level, ProcessLabelsOptions, VarList } from './types.js'
import { stripNumber, getRouteVariableName } from './util.js'
import _ from 'lodash'
import PQueue from 'p-queue'

export class SW_P_08 extends InstanceBase<SwP08Config> {
	config!: SwP08Config
	queue = new PQueue({ concurrency: 1, interval: 10, intervalCap: 1 })
	ackCallbacks: AckCallback[] = []
	commands: number[] = []
	routeMap: Map<number, Map<number, number>> = new Map()
	lastVariables: Map<string, number | string> = new Map()
	lastVariableDefinitions: Map<string, CompanionVariableDefinition> = new Map()
	isRecordingActions = false
	socket: TCPHelper | null = null
	keepAliveTimer: NodeJS.Timeout | undefined

	dest_names: Map<number, DropdownChoice> = new Map()
	source_names: Map<number, DropdownChoice> = new Map()
	levels: DropdownChoice[] = []

	selected_source: number = 0
	selected_dest: number = 0
	selected_level: Level[] = []

	debouncedUpdate = _.debounce(
		async () => {
			this.updateVariableDefinitions()
			this.updateAllNames()
			await this.updateActions()
			await this.updateFeedbacks()
			await this.updatePresets()
		},
		200,
		{
			maxWait: 2000,
		},
	)

	debouncedCrosspointUpdate = _.debounce(
		() => {
			this.updateVariableDefinitions()
			this.updateAllNames()
			this.updateAllCrosspoints()
		},
		200,
		{
			maxWait: 2000,
		},
	)

	// Override base types to make types stricter
	public checkFeedbacks(...feedbackTypes: FeedbackIds[]): void {
		super.checkFeedbacks(...feedbackTypes)
	}

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: SwP08Config): Promise<void> {
		this.queue = new PQueue({ concurrency: 1, interval: 10, intervalCap: 1 })
		void this.configUpdated(config)
	}

	async configUpdated(config: SwP08Config): Promise<void> {
		this.queue.clear()
		this.updateStatus(InstanceStatus.Connecting)

		if (config.max_levels === undefined) {
			config.max_levels = 3
		}
		if (config.max_levels_ext === undefined) {
			config.max_levels_ext = config.max_levels || 3
		}
		if (config.extended_support) {
			const newMatrix = Math.min(config.matrix_ext, 16)
			const newLevels = Math.min(config.max_levels_ext, 16)

			// Save the clamped values to the normal config too, in case the user
			// switches between extended and normal mode
			if (newMatrix !== config.matrix || newLevels !== config.max_levels) {
				config.matrix = newMatrix
				config.max_levels = newLevels
				// This will not trigger a new configUpdated, so continue processing
				// the rest of the config
				this.saveConfig(config)
			}
		} else {
			// Keep the extended values updated, in case the user switches
			// between extended and normal mode
			if (config.matrix_ext !== config.matrix || config.max_levels_ext !== config.max_levels) {
				config.matrix_ext = config.matrix
				config.max_levels_ext = config.max_levels
				// This will not trigger a new configUpdated, so continue processing
				// the rest of the config
				this.saveConfig(config)
			}
		}

		this.config = config
		this.setupVariables()
		await this.updateFeedbacks()
		await this.updateActions()
		await this.updatePresets()
		this.init_tcp()
		this.checkFeedbacks(
			FeedbackIds.SelectedLevel,
			FeedbackIds.SelectedLevelDest,
			FeedbackIds.SelectedDest,
			FeedbackIds.SelectedSource,
			FeedbackIds.CrosspointConnected,
			FeedbackIds.CrosspointConnectedByLevel,
			FeedbackIds.CrosspointConnectedByName,
		)
	}

	async destroy(): Promise<void> {
		this.log('debug', `destroy. ID: ${this.id}`)
		this.queue.clear()
		this.stopKeepAliveTimer()
		if (this.socket) {
			this.socket.destroy()
		}
		this.updateStatus(InstanceStatus.Disconnected)
	}

	handleStartStopRecordActions(isRecording: boolean): void {
		this.isRecordingActions = isRecording
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	async updateActions(): Promise<void> {
		await UpdateActions(this)
	}

	async updateFeedbacks(): Promise<void> {
		await UpdateFeedbacks(this)
	}

	async updatePresets(): Promise<void> {
		await UpdatePresets(this)
	}

	// tcp.js functions

	async sendNak(): Promise<void> {
		this.log('debug', 'Sending NAK')
		await this.queue.add(async () => {
			if (this.socket?.isConnected) await this.socket.send(Buffer.from([DLE, NAK]))
		})
	}

	async sendAck(): Promise<void> {
		//this.log('debug', 'Sending ACK')
		await this.queue.add(async () => {
			if (this.socket?.isConnected) await this.socket.send(Buffer.from([DLE, ACK]))
		})
	}

	/**
	 * Stuff DLE bytes in the data
	 * @param {Array<number>} data
	 * @returns {Array<number>}
	 */
	stuffDLE(data: number[]): number[] {
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

	addAckCallback(retryCb: () => void): void {
		this.ackCallbacks.push({
			resolve: () => {
				//this.log('debug', 'ACK received')
			},
			reject: () => {
				this.log('warn', 'ACK not received, resending')
				// Retry once
				if (this.socket?.isConnected) {
					// Retry sending the command
					retryCb()
					this.ackCallbacks.push({
						resolve: () => {
							this.log('debug', 'ACK received on second try')
						},
						reject: () => {
							this.log('warn', 'ACK not received on second try')
						},
					})
				}
			},
		})
	}

	async readTally(): Promise<void> {
		if (this.config.extended_support) {
			for (let i = 0; i < this.config.max_levels_ext; i++) {
				await this.sendMessage([cmds.extendedCrosspointTallyDump, this.config.matrix - 1, i])
			}
		} else {
			for (let i = 0; i < this.config.max_levels; i++) {
				await this.sendMessage([cmds.crosspointTallyDump, ((this.config.matrix - 1) << 4) | (i & 0x0f)])
			}
		}
	}

	hasCommand(cmdCode: number): boolean {
		if (!this.config.supported_commands_on_connect || this.commands.length === 0) {
			return true
		}

		if (this.commands.indexOf(cmdCode) !== -1) {
			return true
		}
		return false
	}

	/**
	 * Encapsulate a message and send it to the router
	 * @param {Buffer|Array} message
	 * @returns { Promise<boolean> }
	 */
	async sendMessage(message: Buffer | Array<number>): Promise<void> {
		const msg = message instanceof Buffer ? message : Buffer.from(message)

		if (msg.length > 0) {
			// check that the command is implemented in the router
			const cmdCode = msg[0]

			if (
				cmdCode !== 97 &&
				cmdCode !== 0 &&
				this.config.supported_commands_on_connect === true &&
				this.commands.length > 0
			) {
				if (this.commands.indexOf(cmdCode) === -1) {
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
			if (this.socket?.isConnected) {
				await this.socket.send(packetBuffer)

				this.addAckCallback(() => {
					// Retry sending the command if it fails
					this.log('warn', `Retrying to send message: ${packetBuffer.toString('hex')}`)
					this.socket?.send(packetBuffer).catch(() => {})
				})
			} else {
				this.log('warn', 'Socket not connected')
			}
		})
	}

	init_tcp(): void {
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
			})

			this.socket.on('end', () => {
				this.stopKeepAliveTimer()
			})

			this.socket.on('connect', () => {
				this.log('info', `Connected to ${this.config.host}:${this.config.port}`)
				this.ackCallbacks = []
				this.commands = []
				this.routeMap = new Map()
				this.lastVariables = new Map()
				this.lastVariableDefinitions = new Map()
				receivebuffer = Buffer.alloc(0)
				this.updateStatus(InstanceStatus.Ok, 'Connected')
				if (this.config.supported_commands_on_connect === true) {
					// request protocol implementation
					this.sendMessage([cmds.protocolImplementation]).catch(() => {})
				} else {
					if (this.config.read_names_on_connect) {
						this.readNames().catch(() => {})
					}
					if (this.config.tally_dump_and_update) {
						this.readTally().catch(() => {})
					}
				}
				this.subscribeActions()
				this.subscribeFeedbacks()
				this.startKeepAliveTimer()
				this.checkFeedbacks()
			})

			this.socket.on('data', (chunk) => {
				receivebuffer = Buffer.concat([receivebuffer, chunk])
				while (receivebuffer.length > 0) {
					// parseData will return the number of bytes consumed, and will retry until no more data is present

					const bytesConsumed = this.decode(receivebuffer)
					if (bytesConsumed === 0) {
						break
					}
					receivebuffer = receivebuffer.slice(bytesConsumed)
				}
			})
		}
	}

	// keepalive.js functions

	startKeepAliveTimer(): void {
		if (this.keepAliveTimer) {
			clearInterval(this.keepAliveTimer)
		}
		this.keepAliveTimer = setInterval(() => {
			void this.keepAlive()
		}, keepAliveTime)
	}

	stopKeepAliveTimer(): void {
		if (this.keepAliveTimer) {
			clearInterval(this.keepAliveTimer)
			// biome-ignore lint/performance/noDelete: not really a performance issue
			delete this.keepAliveTimer
		}
	}

	async keepAlive(): Promise<void> {
		if (this.socket?.isConnected) {
			// Send dummy message if the queue is empty
			if (this.queue.size === 0) {
				await this.getCrosspoints(1) // Query a crosspoint since there isnt a specificed keep alive message
			}
		}
	}

	// crosspoints.js functions

	crosspointConnected(data: number[] | Buffer): void {
		const matrix = ((data[1] & 0xf0) >> 4) + 1
		const level = (data[1] & 0x0f) + 1
		const dest = ((data[2] & 0x70) << 3) + data[3] + 1
		const source = ((data[2] & 0x07) << 7) + data[4] + 1

		if (matrix !== this.config.matrix) {
			return
		}

		this.log('debug', `Source ${source} routed to destination ${dest} on level ${level}`)

		this.update_crosspoints(source, dest, level)
	}

	ext_crosspointConnected(data: number[] | Buffer): void {
		const matrix = data[1] + 1
		const level = data[2] + 1
		const dest = ((data[3] << 8) | data[4]) + 1
		const source = ((data[5] << 8) | data[6]) + 1

		if (matrix !== this.config.matrix) {
			return
		}

		this.log('debug', `Source ${source} routed to destination ${dest} on level ${level}`)

		this.update_crosspoints(source, dest, level)
	}

	setRoutemap(source: number, dest: number, level: number): void {
		let map = this.routeMap.get(dest)
		if (!map) {
			map = new Map()
			this.routeMap.set(dest, map)
		}

		map.set(level, source)
	}

	getRoutemapEntries(dest: number): {
		[k: string]: number
	} {
		const map = this.routeMap.get(dest)
		if (map) {
			const sources = Object.fromEntries(map.entries())
			return sources
		}
		return {}
	}

	hasSourceInAnyLevelRoutemap(dest: number, source: number): boolean {
		return Object.values(this.getRoutemapEntries(dest)).some((entry) => entry === source)
	}

	hasSourceInRoutemap(level: number, dest: number, source: number): boolean {
		return this.getRoutemapEntries(dest)[level] === source
	}

	/**
	 * Process crosspoint tally dump
	 * @param {Buffer} data
	 */
	processCrosspointTallyDump(data: Buffer): void {
		const type = data[0] === cmds.crosspointTallyDumpByteResponse ? 'byte' : 'word'
		const matrix = ((data[1] & 0xf0) >> 4) + 1
		const level = (data[1] & 0x0f) + 1

		this.processCrosspointTallyDumpData(data, matrix, level, type, 2)
	}

	/**
	 * General function for processing crosspoint tally dumps
	 * @param {Buffer} data
	 * @param {number} matrix Matrix number
	 * @param {number} level Level number
	 * @param {'byte'|'word'} type Type of data (byte or word)
	 * @param {number} offset Offset in the buffer where the data starts
	 */
	processCrosspointTallyDumpData(
		data: Buffer,
		matrix: number,
		level: number,
		type: 'byte' | 'word',
		offset: number,
	): void {
		const tallies = data[offset]

		if (matrix !== this.config.matrix) {
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
				this.setRoutemap(source, dest, level)
				dest++
				currentOffset++
			}
		} else {
			let dest = data.readUInt16BE(currentOffset) + 1
			currentOffset += 2
			for (let i = 0; i < tallies; i++) {
				const source = data.readUInt16BE(currentOffset) + 1
				this.setRoutemap(source, dest, level)
				currentOffset += 2
				dest++
			}
		}

		this.debouncedCrosspointUpdate()
	}

	/**
	 * Process extended crosspoint tally dump (word)
	 * @param {Buffer} data
	 */
	processExtCrosspointTallyDump(data: Buffer): void {
		const matrix = data[1] + 1
		const level = data[2] + 1

		// we only know about word-style extended tally dumps
		this.processCrosspointTallyDumpData(data, matrix, level, 'word', 3)
	}

	updateAllCrosspoints(): void {
		const variables = new Map()
		const numDests = this.dest_names.size > 0 ? this.dest_names.size : 256
		for (let dest = 1; dest <= numDests; dest++) {
			if (dest === this.selected_dest) {
				const map = this.routeMap.get(dest) ?? new Map()
				for (let level = 1; level <= this.config.max_levels; level++) {
					if (map.has(level)) {
						const source = map.get(level)
						variables.set(`Sel_Dest_Source_Level_${level}`, source)
						if (this.source_names.size > 0) {
							// only if names have been retrieved
							try {
								variables.set(
									`Sel_Dest_Source_Name_Level_${level}`,
									stripNumber(this.source_names.get(source - 1)?.label || 'N/A'),
								)
							} catch (e: any) {
								this.log(
									'debug',
									`Unable to set Sel_Dest_Source_Name_Level ${e instanceof Error ? e.message : e.toString()}`,
								)
							}
						}
					} else {
						variables.set(`Sel_Dest_Source_Level_${level}`, -1)
						variables.set(`Sel_Dest_Source_Name_Level_${level}`, 'N/A')
					}
				}
			}
		}

		if (this.config.tally_dump_variables) {
			for (const index of this.routeMap.keys()) {
				const levels = this.routeMap.get(index) ?? new Map()
				for (const level of levels.keys()) {
					variables.set(getRouteVariableName(level, index), levels.get(level))
				}
			}
		}

		this.setVariableValuesCached(Object.fromEntries(variables))

		// TODO: separate id for each destination, and only send source_dest_route if any of them have changed
		this.checkFeedbacks(
			FeedbackIds.SourceDestRoute,
			FeedbackIds.CrosspointConnected,
			FeedbackIds.CrosspointConnectedByName,
			FeedbackIds.CrosspointConnectedByLevel,
		)
	}

	record_crosspoint(source: number, dest: number, level: number): void {
		if (this.isRecordingActions) {
			this.recordAction(
				{
					actionId: 'set_crosspoint',
					options: { level: [level], source: source, dest: dest },
				},
				`connect dest ${dest} level ${level}`,
			)
		}
	}

	update_crosspoints(source: number, dest: number, level: number): void {
		if (dest === this.selected_dest) {
			// update variables for selected dest source
			this.setVariableValuesCached({ [`Sel_Dest_Source_Level_${level}`]: source })
			if (this.source_names.size > 0) {
				// only if names have been retrieved
				try {
					this.setVariableValuesCached({
						[`Sel_Dest_Source_Name_Level_${level}`]: stripNumber(this.source_names.get(source - 1)?.label || 'N/A'),
					})
				} catch (e: any) {
					this.log('debug', `Unable to set Sel_Dest_Source_Name_Level ${e instanceof Error ? e.message : e.toString()}`)
				}
			}
		}

		this.setVariableValuesCached({ [getRouteVariableName(level, dest)]: source })
		this.setRoutemap(source, dest, level)
		this.checkFeedbacks(
			FeedbackIds.SourceDestRoute,
			FeedbackIds.CrosspointConnected,
			FeedbackIds.CrosspointConnectedByName,
			FeedbackIds.CrosspointConnectedByLevel,
		)
		this.record_crosspoint(source, dest, level)
	}

	async SetCrosspoint(sourceN: number, destN: number, levelN: number): Promise<void> {
		const cmd = []
		this.log('debug', `Crosspoint ${sourceN}>${destN} level ${levelN}`)

		if (Number.isNaN(sourceN) || sourceN <= 0 || sourceN > 65536) {
			this.log('warn', `Unable to route source ${sourceN}`)
			return
		}

		if (Number.isNaN(destN) || destN <= 0 || destN > 65536) {
			this.log('warn', `Unable to route destination ${destN}`)
			return
		}

		if (Number.isNaN(levelN) || levelN < 0 || levelN > 255) {
			this.log('warn', `Unable to route level ${levelN}`)
			return
		}

		const source = sourceN - 1
		const dest = destN - 1
		const level = levelN - 1

		if ((source > 1023 || dest > 1023 || levelN > 15) && this.hasCommand(cmds.extendedCrosspointConnect)) {
			if (this.config.extended_support === false) {
				this.log(
					'warn',
					'Doing a crosspoint connect with a value outside of the normal command range, but extended support is not enabled, using extended command anyway',
				)
				return
			}
			// Extended command required
			cmd.push(cmds.extendedCrosspointConnect)
			// Matrix
			cmd.push(this.config.matrix - 1)
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
			if (source > 1023 || dest > 1023 || levelN > 15) {
				this.log(
					'error',
					'Doing a crosspoint connect with a source, destination or level value outside of the normal command range, but extended support is not supported by the device, cannot do crosspoint.',
				)
				return
			}

			// Standard Command
			cmd.push(cmds.crosspointConnect)
			// Matrix and Level
			cmd.push(((this.config.matrix - 1) << 4) | (level & 0x0f))
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
	}

	async getCrosspoints(destN: number): Promise<void> {
		this.log('debug', `GetCrosspoint ${destN}`)

		if (destN <= 0 || destN > 65536) {
			this.log('warn', `Unable to get crosspoint destination ${destN}`)
			return
		}
		const dest = destN - 1

		if ((this.config.max_levels > 16 || dest > 1023) && this.hasCommand(cmds.extendedInterrogate)) {
			// check all levels
			for (let i = 0; i < this.config.max_levels; i++) {
				await this.sendMessage([
					// Extended commands
					cmds.extendedInterrogate,
					// Matrix
					this.config.matrix - 1,
					// Level
					i,
					// Dest DIV 256
					dest >> 8,
					// Dest Mod 256
					dest & 0xff,
				])
			}
		} else {
			if (this.config.max_levels > 16 || dest > 1023) {
				this.log(
					'error',
					'Doing a crosspoint interrogate with a source, destination or level value outside of the normal command range, but extended support is not supported by the device, cannot do crosspoint interrogate.',
				)
				return
			}

			// check all levels
			for (let i = 0; i <= this.config.max_levels - 1; i++) {
				await this.sendMessage([
					// Standard commands
					cmds.crosspointInterrogate,
					// Matrix and Level
					((this.config.matrix - 1) << 4) | (i & 0x0f),
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
	decode(data: Buffer): number {
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

				// Remove DLE escaping and calculate checksum
				// Start at 2 to skip SOM
				for (let k = 2; k < j; k++) {
					if (data[k] === DLE && data[k + 1] === DLE) {
						// We found a double DLE, replace it with a single DLE
						k++
						packet[packetIndex++] = DLE
						if (k < j - 1) {
							crc += data[k]
						}
						continue
					}
					packet[packetIndex++] = data[k]

					// add only DATA + BTC to CRC
					if (k < j - 1) {
						crc += data[k]
					}
				}

				// Trim the packet to the correct size
				packet = packet.slice(0, packetIndex)

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
				this.processMessage(packet.slice(0, packet.length - 2))

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
	processMessage(message: Buffer): void {
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

				// request names
				if (this.config.read_names_on_connect) {
					this.readNames().catch(() => {})
				}

				// request tally
				if (this.config.tally_dump_and_update) {
					this.readTally().catch(() => {})
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
				this.log('warn', `Unsupported response code ${message[0]}: ${getCommandName(message[0])}`)
				this.log('debug', `Unsupported response code ${message[0]} in response: ${message.toString('hex')}`)
				break
		}
	}

	// labels.js functions

	/**
	 * Process labels defined by the options
	 * @param {Buffer} data - Data section of packet
	 * @param {ProcessLabelsOptions} options - Options for label parser
	 */
	processLabels(data: Buffer, options: ProcessLabelsOptions): void {
		const char_length_table = [4, 8, 12]
		//let level = 0
		let matrix = 0
		let start = 0
		let char_length = 0
		let label_number = 0
		let labels_in_part = 0

		if (!options.extended) {
			let idx = 1
			// byte1 = matrix (in bits 4-7), level (in bits 3-0) per SW-P-08 spec
			if (options.hasMatrix) {
				matrix = (data[idx] & 0xf0) >> 4
				if (matrix !== this.config.matrix - 1) {
					this.log('debug', `Matrix number ${matrix} does not match ${this.config.matrix - 1}`)
					return
				}
			}
			if (options.hasLevels) {
				//level = data[idx] & 0x0f
			}
			idx++
			char_length = char_length_table[data[idx++]]
			label_number = (data[idx++] << 8) | data[idx++]
			labels_in_part = data[idx++]
			start = idx
		} else {
			let idx = 1
			if (options.hasMatrix) {
				matrix = data[idx++]
				if (matrix !== this.config.matrix_ext - 1) {
					this.log('debug', `Matrix number ${matrix} does not match ${this.config.matrix_ext - 1}`)
					return
				}
			}
			if (options.hasLevels) {
				//level = data[idx++]
			}
			char_length = char_length_table[data[idx++]]
			label_number = (data[idx++] << 8) | data[idx++]
			labels_in_part = data[idx++]
			start = idx
		}

		this.extractLabels(data, char_length, label_number, labels_in_part, start)
	}

	extractLabels(data: Buffer, char_length: number, label_number: number, labels_in_part: number, start: number): void {
		/*
	this.log('debug', `label chars: ${char_length}`)
	this.log('debug', `label number: ${label_number}`)
	this.log('debug', `labels in part: ${labels_in_part}`)
	*/

		for (let l = 0; l < labels_in_part; l++) {
			const pos = l * char_length
			const labelId = label_number + l

			if (data[0] === cmds.destNamesResponse || data[0] === cmds.extendedDestNamesResponse) {
				this.dest_names.set(labelId, {
					id: labelId + 1,
					label: data
						.slice(start + pos, start + pos + char_length)
						.toString('utf8')
						.replace(/\0/g, '')
						.trim(),
				})
			} else if (data[0] === cmds.sourceNamesResponse || data[0] === cmds.extendedSourceNamesResponse) {
				this.source_names.set(labelId, {
					id: labelId + 1,
					label: data
						.slice(start + pos, start + pos + char_length)
						.toString('utf8')
						.replace(/\0/g, '')
						.trim(),
				})
			} else {
				this.log('debug', `Unknown label type ${data[0]}`)
				return
			}
		}

		// update dropdown lists
		void this.debouncedUpdate()
	}

	updateAllNames(): void {
		const variables = new Map()

		// biome-ignore lint/complexity/noForEach: better for maps
		this.source_names.forEach((sourceValue) => {
			variables.set(`Source_${sourceValue.id}`, stripNumber(sourceValue.label))
		})

		// biome-ignore lint/complexity/noForEach: better for maps
		this.dest_names.forEach((destValue) => {
			variables.set(`Destination_${destValue.id}`, stripNumber(destValue.label))
		})

		variables.set('Sources', this.source_names.size)
		variables.set('Destinations', this.dest_names.size)

		this.setVariableValuesCached(Object.fromEntries(variables))
	}

	// levels.js functions

	processLevelsSelection(selection: number[], state: boolean | 'toggle'): void {
		this.log('debug', `Processing Levels Selection: ${selection}`)

		for (const level of selection) {
			if (state === 'toggle') {
				this.selected_level[level - 1].enabled = !this.selected_level[level - 1].enabled
			} else {
				this.selected_level[level - 1].enabled = state
			}
		}
		this.log('debug', `Selected levels: ${JSON.stringify(this.selected_level)}`)
		this.checkFeedbacks(FeedbackIds.SelectedLevel, FeedbackIds.SelectedLevelDest)
	}

	// names.js functions

	async readNames(): Promise<void> {
		this.log('info', 'Reading names...')
		// reset
		const cmdGetSources = []
		const cmdGetDestinations = []
		this.source_names = new Map()
		this.dest_names = new Map()
		this.setVariableValuesCached({ Sources: 0, Destinations: 0 })

		if (
			this.config.extended_support === true &&
			(this.hasCommand(cmds.extendedGetSourceNames) || this.hasCommand(cmds.extendedGetDestNames))
		) {
			// extended commands (only gets source names for level 0)
			cmdGetSources.push(
				cmds.extendedGetSourceNames,
				this.config.matrix_ext - 1, // matrix
				0, // level
				Number.parseInt(this.config.name_chars), // name characters
			)
			cmdGetDestinations.push(
				cmds.extendedGetDestNames,
				this.config.matrix_ext - 1, // matrix
				Number.parseInt(this.config.name_chars), // name characters
			)
		} else {
			// standard commands
			cmdGetSources.push(cmds.getSourceNames, (this.config.matrix - 1) << 4, Number.parseInt(this.config.name_chars))
			cmdGetDestinations.push(cmds.getDestNames, (this.config.matrix - 1) << 4, Number.parseInt(this.config.name_chars))
		}

		// get source names
		await this.sendMessage(cmdGetSources)

		// get dest names
		await this.sendMessage(cmdGetDestinations)
	}

	// variables.js functions

	setupVariables(): void {
		// Implemented Commands
		const varList: Partial<VarList> = {}
		this.commands = []

		// Hold values
		this.selected_dest = 0
		this.selected_source = 0

		const currentLevels = (this.config.extended_support ? this.config.max_levels_ext : this.config.max_levels) || 3

		this.levels = []
		this.selected_level = []
		for (let i = 1; i <= currentLevels; i++) {
			this.levels.push({ id: i, label: `Level: ${i}` })
			this.selected_level.push({ id: i, enabled: true })
		}

		// Labels
		this.source_names = new Map()
		this.dest_names = new Map()

		this.updateVariableDefinitions()

		varList.Sources = 0
		varList.Destinations = 0

		varList.Source = this.selected_source
		varList.Destination = this.selected_dest

		this.setVariableValuesCached(varList as VarList)
	}

	/**
	 * Only set variable values if they have changed, easing the load on companion
	 * @param {VarList} object - Object with variable values to set
	 */
	setVariableValuesCached(object: VarList): void {
		const variablesToUpdate: CompanionVariableValues = {}
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

	updateVariableDefinitions(): void {
		const coreVariables = []
		const sourceValues = Array.from(this.source_names.values())
		const destValues = Array.from(this.dest_names.values())

		coreVariables.push(
			{
				name: 'Number of source names returned by router',
				variableId: 'Sources',
			},
			{
				name: 'Number of destination names returned by router',
				variableId: 'Destinations',
			},
			{
				name: 'Selected destination',
				variableId: 'Destination',
			},
			{
				name: 'Selected source',
				variableId: 'Source',
			},
		)

		for (let i = 1; i <= this.config.max_levels; i++) {
			coreVariables.push({
				name: `Selected destination source for level ${i}`,
				variableId: `Sel_Dest_Source_Level_${i}`,
			})
			coreVariables.push({
				name: `Selected destination source name for level ${i}`,
				variableId: `Sel_Dest_Source_Name_Level_${i}`,
			})
		}

		for (let i = 1; i <= sourceValues.length; i++) {
			coreVariables.push({
				name: `Source ${i}`,
				variableId: `Source_${i}`,
			})
		}

		for (let i = 1; i <= destValues.length; i++) {
			coreVariables.push({
				name: `Destination ${i}`,
				variableId: `Destination_${i}`,
			})
		}

		if (this.config.tally_dump_variables) {
			this.routeMap.forEach((levels, index) => {
				for (const level of levels?.keys() ?? []) {
					coreVariables.push({
						name: `Source for destination ${index} at level ${level}`,
						variableId: getRouteVariableName(level, index),
					})
				}
			})
		}

		// Only update if there are changes to the variable definitions
		let changes = false
		for (const variable of coreVariables) {
			if (!_.isEqual(this.lastVariableDefinitions.get(variable.variableId), variable)) {
				this.lastVariableDefinitions.set(variable.variableId, variable)
				changes = true
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
		for (const variable of coreVariables) {
			this.lastVariableDefinitions.set(variable.variableId, variable)
		}
	}
}
runEntrypoint(SW_P_08, UpgradeScripts)
