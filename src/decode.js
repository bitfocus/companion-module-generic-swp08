import { hexBytes } from './consts.js'

export function decode(data) {
	let message = []

	if (data.length > 0) {
		for (let j = 0; j < data.length; j++) {
			if (data[j] == hexBytes.DLE) {
				switch (data[j + 1]) {
					case hexBytes.STX:
						console.log('Received SOM')
						j++
						continue
					//break

					case hexBytes.ETX:
						console.log('Received EOM')
						j++
						continue
					//break

					case hexBytes.ACK:
						console.log('Received ACK')
						j++
						continue
					//break

					case hexBytes.DLE:
						// remove repeated byte 0x10
						message.push(data[j])
						j++
						continue
					//break

					case hexBytes.NAK:
						console.log('Received NAK')
						j++
						continue
					//break

					default:
						message.push(data[j])
						continue
				}
			}
			message.push(data[j])
		}
	}

	if (message.length > 2) {
		console.log('message extracted: ' + message)
		console.log('Command id: ' + message[0])
		//let requests
		//let responses
		switch (message[0]) {
			// Command
			case hexBytes.cmd.tally:
			case hexBytes.cmd.connected:
				// Crosspoint Tally, Crosspoint Connected
				this.crosspointConnected(message)
				break

			case hexBytes.cmd.extendedTally:
			case hexBytes.cmd.extendedConnected:
				// Extended Crosspoint Connected
				this.ext_crosspointConnected(message)
				break

			case hexBytes.cmd.protocolImplementation:
				// Protocol Implementation Response
				//requests = message[1]
				//responses = message[2]

				this.commands = []

				for (let j = 3; j < message.length - 2; j++) {
					this.commands.push(message[j])
				}

				console.log('This router implements: ' + this.commands)

				// request names
				if (this.config.read_names_on_connect) {
					this.readNames()
				}
				break

			case hexBytes.cmd.sourceNames:
			case hexBytes.cmd.destNames:
				// Standard Names Request Reply
				this.processLabels(message)
				break

			case hexBytes.cmd.extendedSourceNames:
				// Extended Source Names Reply
				// Allows for extra Level field in response
				this.ext_processSourceLabels(message)
				break

			case hexBytes.cmd.extendedDestNames:
				// Extended Destination Names Reply
				// There is no difference in structure to the standard response
				this.processLabels(message)
				break

			default:
				this.log('warn', 'Unknown response code ' + message[0])
				this.log('debug', message.toString())
				console.log('Unknown response code ' + message[0])
				break
		}
	}
}
