import { InstanceStatus, TCPHelper } from '@companion-module/base'
import { Buffer } from 'node:buffer'
import { ACK, DLE, STX, ETX, cmds } from './consts.js'

export function sendNak() {
	//this.log('debug', 'Sending NAK')
	if (this.socket?.isConnected) {
		this.socket.send(Buffer.from([DLE, NAK]))
		this.startKeepAliveTimer()
	}
}

export function sendAck() {
	//this.log('debug', 'Sending ACK')
	if (this.socket?.isConnected) {
		this.socket.send(Buffer.from([DLE, ACK]))
		this.startKeepAliveTimer()
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

export function addAckCallback(sendCb) {
	this.ackCallbacks.push({
		resolve: () => {
			//this.log('debug', 'ACK received')
		},
		reject: () => {
			this.log('warn', 'ACK not received, resending')
			// Retry once
			if (this.socket?.isConnected) {
				// Retry sending the command
				sendCb()
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

/**
 * Encapsulate a message and send it to the router
 * @param {Buffer|Array} message
 * @returns {void}
 */
export function sendMessage(message) {
	const msg = message instanceof Buffer ? message : Buffer.from(message)
	if (msg.length < 1) {
		this.log('warn', 'Empty or invalid message!')
		return
	}

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

	this.log('debug', `Sending >> ${packetBuffer.toString('hex')}`)

	this.queue.add(async () => {
		if (this.socket?.isConnected) {
			this.socket.send(packetBuffer)
			this.startKeepAliveTimer()

			this.addAckCallback(() => {
				this.socket.send(packetBuffer)
			})
		} else {
			this.log('warn', 'Socket not connected')
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

		this.socket.on('connect', () => {
			console.log(`Connected to ${this.config.host}:${this.config.port}`)
			this.ackCallbacks = []
			this.commands = []
			receivebuffer = Buffer.alloc(0)
			this.updateStatus(InstanceStatus.Ok, 'Connected')
			if (this.config.supported_commands_on_connect === true) {
				// request protocol implementation
				this.sendMessage([cmds.protocolImplementation])
			} else {
				if (this.config.read_names_on_connect) {
					this.readNames()
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
				if (receivebuffer.length > 0) {
					this.log('debug', `More data available, ${receivebuffer.length} bytes remaining`)
				}
			}
		})
	}
}
