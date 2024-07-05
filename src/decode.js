
export function decode (data) {
	let message = []

	if (data.length > 0) {
		for (let j = 0; j < data.length; j++) {
			if (data[j] == 0x10) {
				switch (data[j + 1]) {
					case 0x02:
						console.log('Received SOM')
						j++
						continue
					//break

					case 0x03:
						console.log('Received EOM')
						j++
						continue
					//break

					case 0x06:
						console.log('Received ACK')
						j++
						continue
					//break

					case 0x10:
						// remove repeated byte 0x10
						message.push(data[j])
						j++
						continue
					//break

					case 0x15:
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
			case 0x03:
			case 0x04:
				// Crosspoint Tally, Crosspoint Connected
				this.crosspointConnected(message)
				break

			case 0x83:
			case 0x84:
				// Extended Crosspoint Connected
				this.ext_crosspointConnected(message)
				break

			case 0x62:
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

			case 0x6a:
			case 0x6b:
				// Standard Names Request Reply
				this.processLabels(message)
				break

			case 0xea:
				// Extended Source Names Reply
				// Allows for extra Level field in response
				this.ext_processSourceLabels(message)
				break

			case 0xeb:
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