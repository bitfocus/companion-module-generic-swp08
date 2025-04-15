import { cmds } from './consts.js'

export function processLabels(data) {
	const char_length_table = [4, 8, 12]

	// byte1 = matrix (in bits 4-7)
	const matrix = (data[1] & 0xf0) >> 4
	if (matrix !== this.config.matrix-1) {
		this.log('debug', `Matrix number ${matrix} does not match ${this.config.matrix-1}`)
		// wrong matrix number
		return
	}
	const level = (data[1] & 0x0f)
	if (level !== 0) {
		this.log('debug', `Level ${level} does not match 0`)
		// ignore level > 0 ?
		return
	}
	const char_length = char_length_table[data[2]]
	const label_number = (data[3] << 8) | data[4]
	const labels_in_part = data[5]
	const start = 6

	this.extractLabels(data, char_length, label_number, labels_in_part, start)
}

export function ext_processSourceLabels(data) {
	const char_length_table = [4, 8, 12]

	if (data[1] !== this.config.matrix-1) {
		this.log('debug', `Matrix number ${data[1]} does not match ${this.config.matrix-1}`)
		// wrong matrix number
		return
	}
	if (data[2] !== 0) {
		this.log('debug', `Level ${data[2]} does not match 0`)
		// ignore level > 0 ?
		return
	}
	const char_length = char_length_table[data[3]]
	const label_number = (data[4] << 8) | data[5]
	const labels_in_part = data[6]
	const start = 7

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

		if (data[0] === cmds.destNames || data[0] === cmds.extendedDestNames) {
			this.dest_names.set(labelId, {
				id: labelId,
				label: data.slice(start + pos, start + pos + char_length).toString('utf8').replace(/\0/g, '').trim(),
			})
		} else if (data[0] === cmds.sourceNames || data[0] === cmds.extendedSourceNames) {
			this.source_names.set(labelId, {
				id: labelId,
				label: data.slice(start + pos, start + pos + char_length).toString('utf8').replace(/\0/g, '').trim(),
			})
		} else {
			this.log('debug', `Unknown label type ${data[0]}`)
			return
		}
	}

	this.setVariableValues({
		Sources: this.source_names.size,
		Destinations: this.dest_names.size,
	})

	// update dropdown lists
	this.throttledUpdate()
}
