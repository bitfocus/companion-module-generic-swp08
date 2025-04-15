import { InstanceStatus, TCPHelper } from '@companion-module/base'
import { Buffer } from 'node:buffer'
import { ACK, DLE, STX, ETX } from './consts.js'

export function sendNak() {
	//this.log('debug', 'Sending NAK')
	if (this.socket?.isConnected) {
		this.socket.send(this.hexStringToBuffer('1005'));//DLE + NAK))
		this.startKeepAliveTimer()
	}
}

export function sendAck() {
	//this.log('debug', 'Sending ACK')
	if (this.socket?.isConnected) {
		this.socket.send(this.hexStringToBuffer('1006'));//DLE + ACK))
		this.startKeepAliveTimer()
	}
}

export function sendMessage(message) {
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

	const cmd = '1002' + packed + '1003' // DLE + STX + data + DLE + ETX

	console.log('Sending >> ' + cmd)
	this.queue.add(async () => {
		if (cmd !== undefined) {
			if (this.socket?.isConnected) {
				this.socket.send(this.hexStringToBuffer(cmd))
				this.startKeepAliveTimer()
				this.ackCallbacks.push({
					resolve: () => {
						this.log('debug', 'ACK received')
					},
					reject: () => {
						this.log('warn', 'ACK not received')
						// Retry once
						if (this.socket?.isConnected) {
							this.socket.send(this.hexStringToBuffer(cmd))
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
			} else {
				this.log('warn', `Socket not connected. Tried to send ${cmd}`)
			}
		}
	})
}

export function init_tcp() {
	let receivebuffer = Buffer.alloc(0)

	if (this.socket !== undefined) {
		this.socket.destroy()
		delete this.socket
	}

	if (this.config.host) {
		this.socket = new TCPHelper(this.config.host, this.config.port)

		this.socket.on('status_change', (status, message) => {
			this.updateStatus(status, message)
		})

		this.socket.on('error', (err) => {
			this.log('error', 'Network error: ' + err.message)
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			this.stopKeepAliveTimer()
		})

		this.socket.on('connect', () => {
			console.log('Connected to ' + this.config.host + ':' + this.config.port)
			this.ackCallbacks = []
			receivebuffer = Buffer.alloc(0)
			this.updateStatus(InstanceStatus.Ok, 'Connected')
			if (this.config.supported_commands_on_connect === true) {
				// request protocol implementation
				this.sendMessage('61019E')
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

				const bytesConsumed = this.decode(receivebuffer);
				if (bytesConsumed === 0) {
					break
				}
				receivebuffer = receivebuffer.slice(bytesConsumed);
				if (receivebuffer.length > 0) {
					this.log('debug', `More data available, ${receivebuffer.length} bytes remaining`)
				}
			}
		})
	}
}
