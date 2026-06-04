import { InstanceStatus, TCPHelper } from '@companion-module/base'
import { Buffer } from 'node:buffer'
import { ACK, NAK, DLE, STX, ETX, cmds, ackTimeout } from './consts.js'

export function sendNak() {
	this.log('debug', 'Sending NAK')
	// Send our link-level ACK/NAK directly, not via the command queue, so they
	// are never delayed behind a command that is waiting for its ACK.
	if (this.socket?.isConnected) {
		this.socket.send(Buffer.from([DLE, NAK]))
	}
}

export function sendAck() {
	//this.log('debug', 'Sending ACK')
	if (this.socket?.isConnected) {
		this.socket.send(Buffer.from([DLE, ACK]))
	}
}

/**
 * Stuff DLE bytes in the data
 * @param {Array} data
 * @returns {Array}
 */
function stuffDLE(data) {
	const output = new Array()
	// replace byte value 10 (DLE) in data with 1010
	for (let j = 0; j < data.length; ++j) {
		output.push(data[j])
		if (data[j] === DLE) {
			output.push(DLE)
		}
	}
	return output
}

/**
 * Wait for the router to ACK or NAK the last command, or time out.
 * Only one command is ever outstanding, so the reply can only belong to it.
 * @param {string} messageHex hex of the message we are awaiting a reply for (for logging)
 * @returns {Promise<'ack'|'nak'|'timeout'>}
 */
export function waitForAck(messageHex) {
	return new Promise((resolve) => {
		let settled = false
		const timer = setTimeout(() => {
			if (settled) return
			settled = true
			this.pendingAck = null
			resolve('timeout')
		}, ackTimeout)
		this.pendingAck = (result) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			this.pendingAck = null
			if (result === 'nak') {
				this.log('debug', `NAK received for message: ${messageHex}`)
			}
			resolve(result)
		}
	})
}

export function readTally() {
	if (this.config.extended_support) {
		for (let i = 0; i < this.config.max_levels_ext; i++) {
			this.sendMessage([cmds.extendedCrosspointTallyDump, this.config.matrix - 1, i])
		}
	} else {
		for (let i = 0; i < this.config.max_levels; i++) {
			this.sendMessage([cmds.crosspointTallyDump, ((this.config.matrix - 1) << 4) | (i & 0x0f)])
		}
	}
}

export function hasCommand(cmdCode) {
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
 * @returns {void}
 */
export function sendMessage(message) {
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
	packet.push(...stuffDLE([length, (~crc + 1) & 0xff]), DLE, ETX)

	const packetBuffer = Buffer.from(packet)

	this.queue.add(async () => {
		if (!this.socket?.isConnected) {
			this.log('warn', 'Socket not connected')
			return
		}

		const messageHex = packetBuffer.toString('hex')
		this.log('debug', `Sending >> ${messageHex}`)
		this.socket.send(packetBuffer)

		// Strict request/response: wait for the router's ACK/NAK before sending
		// the next message, so a reply can never be attributed to the wrong
		// command. The wait times out (see ackTimeout) so the queue can never
		// block forever on a non-responding device.
		let result = await this.waitForAck(messageHex)

		if (result === 'nak') {
			// Single retry on NAK, then move on regardless of outcome.
			this.log('warn', `NAK received, retrying once: ${messageHex}`)
			this.socket.send(packetBuffer)
			result = await this.waitForAck(messageHex)
		}

		if (result !== 'ack') {
			this.log('warn', `Message not acknowledged (${result}), moving on: ${packetBuffer.toString('hex')}`)
		}
	})
}

export function init_tcp() {
	let receivebuffer = Buffer.alloc(0)

	if (this.socket !== undefined) {
		this.socket.destroy()
		// biome-ignore lint/performance/noDelete: not really a performance issue
		delete this.socket
	}

	this.stopKeepAliveTimer()

	if (this.config.host) {
		this.socket = new TCPHelper(this.config.host, this.config.port)

		this.socket.on('status_change', (status, message) => {
			this.updateStatus(status, message)
		})

		this.socket.on('error', (err) => {
			this.log('error', `Network error: ${err.message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			this.stopKeepAliveTimer()
		})

		this.socket.on('close', () => {
			this.stopKeepAliveTimer()
		})

		this.socket.on('connect', () => {
			console.log(`Connected to ${this.config.host}:${this.config.port}`)
			// Clean slate so a reconnect can't inherit a stale waiter or queued commands
			this.queue.clear()
			if (this.pendingAck) this.pendingAck('timeout')
			this.pendingAck = null
			this.commands = []
			this.routeMap = new Map()
			this.lastVariables = new Map()
			this.lastVariableDefinitions = new Map()
			receivebuffer = Buffer.alloc(0)
			this.updateStatus(InstanceStatus.Ok, 'Connected')
			if (this.config.supported_commands_on_connect === true) {
				// request protocol implementation
				this.sendMessage([cmds.protocolImplementation])
			} else {
				if (this.config.read_names_on_connect) {
					this.readNames()
				}
				if (this.config.tally_dump_and_update) {
					this.readTally()
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
