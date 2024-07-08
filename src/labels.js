import { hexBytes } from './consts.js'

export function processLabels(data) {
	const char_length_table = [4, 8, 12]

	// byte1 = matrix (& level for sources)
	const char_length = char_length_table[data[2]]
	const label_number = 256 * data[3] + data[4]
	const labels_in_part = data[5]
	const start = 6

	this.extractLabels(data, char_length, label_number, labels_in_part, start)
}

export function ext_processSourceLabels(data) {
	const char_length_table = [4, 8, 12]

	// byte1 = matrix number
	// byte2 = level number
	const char_length = char_length_table[data[3]]
	const label_number = 256 * data[4] + data[5]
	const labels_in_part = data[6]
	const start = 7

	this.extractLabels(data, char_length, label_number, labels_in_part, start)
}

export function extractLabels(data, char_length, label_number, labels_in_part, s) {
	let l = 0

	console.log('label chars:' + char_length)
	console.log('label number:' + label_number)
	console.log('labels in part: ' + labels_in_part)

	while (l < labels_in_part) {
		var label = ''
		for (var j = 0; j < char_length; j++) {
			label = label + String.fromCharCode(data[s + j])
		}

		s = s + char_length
		l = l + 1
		label_number = label_number + 1

		if (data[0] == hexBytes.cmd.sourceNames || data[0] == hexBytes.cmd.extendedSourceNames) {
			// sources
			this.source_names.splice(label_number - 1, 0, {
				id: label_number,
				label: label_number.toString() + ': ' + label.trim(),
			})
		} else if (data[0] == hexBytes.cmd.destNames || data[0] == hexBytes.cmd.extendedDestNames) {
			// destinations
			this.dest_names.splice(label_number - 1, 0, {
				id: label_number,
				label: label_number.toString() + ': ' + label.trim(),
			})
		}

		// this.log('debug','label ' + this.padLeft(label_number,2) + ' |' + label + '|')
	}

	this.setVariableValues({
		Sources: Object.keys(this.source_names).length,
		Destinations: Object.keys(this.dest_names).length,
	})

	this.updateVariableDefinitions()

	console.log(this.source_names)
	console.log(this.dest_names)

	// update dropdown lists
	this.updateActions()
}
