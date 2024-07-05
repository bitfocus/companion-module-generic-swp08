import { InstanceStatus, TCPHelper } from '@companion-module/base'
import { Buffer } from 'node:buffer'
import { DLE, STX, ETX } from './consts.js'
//import { msgDelay } from './consts.js'

export function sendAck() {
	this.log('debug','Sending ACK')
	if (this.socket !== undefined && this.socket.connected) {
		this.socket.send(this.hexStringToBuffer('1006'))
	} else {
		this.log('warn','Socket not connected :(')
	}
}

export function sendMessage(message) {
	// minimum length is 1 byte
	if (message.length < 2) {
		this.log('warn', 'Empty or invalid message!')
		return
	}

	// check that the command is implemented in the router
	let cmdCode = parseInt(message.substring(0, 2), 16)

	if (this.config.supported_commands_on_connect === true) {
		if (cmdCode !== 97) {
			if (this.commands.length > 0) {
				if (this.commands.indexOf(cmdCode) !== -1) {
					// all good
				} else {
					this.log('warn', `Command code ${cmdCode} is not implemented by this hardware`)
					return
				}
			} else {
				this.log('warn', 'Unable to verify list of implemented commands')
				return
			}
		}
	}

	// replace byte value 10 (DLE) in data with 1010
	let packed = ''
	for (let j = 0; j < message.length; j = j + 2) {
		let b = message.substr(j, 2)
		if (b === '10') {
			packed = packed + '1010'
		} else {
			packed = packed + b
		}
	}

	const cmd = DLE + STX + packed + DLE + ETX

	console.log('Sending >> ' + cmd)

	if (cmd !== undefined) {
		if (this.socket !== undefined && this.socket.connected) {
			this.socket.send(this.hexStringToBuffer(cmd))
			this.startKeepAliveTimer()
		} else {
			this.log('warn', 'Socket not connected')
		}
	}
}

export async function init_tcp () {
	let receivebuffer = Buffer.from('')

	if (this.socket !== undefined) {
		this.socket.destroy()
		delete this.socket
	}

	if (this.config.host) {
		this.socket = new TCPHelper(this.config.host, this.config.port)

		this.socket.on('status_change', function (status, message) {
			this.updateStatus(status, message)
		})

		this.socket.on('error', function (err) {
			this.log('error', 'Network error: ' + err.message)
            this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			this.stopKeepAliveTimer()
		})

		this.socket.on('connect', function () {
            this.updateStatus(InstanceStatus.Ok, 'Connected')
			this.startKeepAliveTimer()
			if (this.config.supported_commands_on_connect === true) {
				// request protocol implementation
				this.sendMessage('61019E')
			}
		})

		this.socket.on('data', function (chunk) {
			if (Buffer.compare(chunk, receivebuffer) != 0) {
				// console.log('Received: ' + chunk.length + ' bytes ', chunk.toString('hex').match(/../g).join(' '))
				// send ACK
				this.sendAck()
				// Decode
				this.decode(chunk)
				receivebuffer = chunk
			} else {
				// duplicate
				console.log(`Repeated: ${chunk.length} bytes`)
			}
		})
	}
}