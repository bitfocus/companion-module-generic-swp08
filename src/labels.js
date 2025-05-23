import { cmds } from './consts.js'

/**
 * @typedef ProcessLabelsOptions
 * @property {boolean} hasMatrix - Indicates if the command has matrix information.
 * @property {boolean} hasLevels - Indicates if the command has level information.
 * @property {boolean} extended - Indicates if it is an extended command.
 */

/**
 * Process labels defined by the options
 * @param {Buffer} data - Data section of packet
 * @param {ProcessLabelsOptions} options - Options for label parser
 */
export function processLabels(data, options) {
	const char_length_table = [4, 8, 12]
	let level = 0
	let matrix = 0
	let start = 0
	let char_length = 0
	let label_number = 0
	let labels_in_part = 0

	if (!options.extended) {
		let idx = 1
		// byte1 = matrix (in bits 4-7)
		if (options.hasMatrix && options.hasLevels) {
			matrix = (data[idx] & 0xf0) >> 4
			if (matrix !== this.config.matrix - 1) {
				this.log('debug', `Matrix number ${matrix} does not match ${this.config.matrix - 1}`)
				// wrong matrix number
				return
			}
		}
		if (options.hasMatrix && !options.hasLevels) {
			matrix = data[idx]
			if (matrix !== this.config.matrix - 1) {
				this.log('debug', `Matrix number ${matrix} does not match ${this.config.matrix - 1}`)
				// wrong matrix number
				return
			}
		}
		if (options.hasLevels) {
			level = data[idx] & 0x0f
			if (level !== 0) {
				this.log('debug', `Level ${level} does not match 0`)
				// ignore level > 0 ?
				return
			}
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
		}
		if (options.hasLevels) {
			level = data[idx++]
		}
		char_length = char_length_table[data[idx++]]
		label_number = (data[idx++] << 8) | data[idx++]
		labels_in_part = data[idx++]
		start = idx
	}

	this.extractLabels(data, char_length, label_number, labels_in_part, start)
}

export function extractLabels(data, char_length, label_number, labels_in_part, start) {
	/*
	console.log(`label chars: ${char_length}`)
	console.log(`label number: ${label_number}`)
	console.log(`labels in part: ${labels_in_part}`)
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

	this.setVariableValuesCached({
		Sources: this.source_names.size,
		Destinations: this.dest_names.size,
	})

	// update dropdown lists
	this.throttledUpdate()
}
