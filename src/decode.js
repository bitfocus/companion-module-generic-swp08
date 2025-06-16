import { STX, DLE, ETX, ACK, NAK, cmds, getCommandName } from './consts.js'

/**
 * Decode one message, handling DLE escaping, packet length and checksum
 * @param {Buffer} data
 */
export function decode(data) {
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
				this.ackCallbacks.shift().resolve()
			} else {
				this.ackCallbacks.shift().reject()
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
				this.sendNak()
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
				this.sendNak()
				return j + 2
			}

			// Always acknowledge the packet if it is valid on a packet level
			this.sendAck()

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
export function processMessage(message) {
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

			console.log(`This router implements: ${this.commands}`)

			// request names
			if (this.config.read_names_on_connect) {
				this.readNames()
			}

			// request tally
			if (this.config.tally_dump_and_update) {
				this.readTally()
			}
			break

		case cmds.sourceNamesResponse:
			this.processLabels(message, { hasMatrix: true, hasLevels: true })
			break

		case cmds.destNamesResponse:
			this.processLabels(message, { hasMatrix: true, hasLevels: false })
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
			this.log('warn', `Unknown response code ${message[0]}`)
			this.log('debug', `Unknown response code ${message[0]} in response: ${message.toString('hex')}`)
			break
	}
}
