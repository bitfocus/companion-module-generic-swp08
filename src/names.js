import { cmds } from './consts.js'

export function readNames() {
	console.log('Reading names')
	// reset
	const cmdGetSources = []
	const cmdGetDestinations = []
	this.source_names = new Map()
	this.dest_names = new Map()
	this.setVariableValues({ Sources: 0, Destinations: 0 })
	if (this.config.extended_support === true) {
		// extended commands (only gets source names for level 1)
		cmdGetSources.push(
			cmds.extendedGetSourceNames,
			this.config.matrix - 1, // matrix
			0, // level
			Number.parseInt(this.config.name_chars), // name characters
		)
		cmdGetDestinations.push(
			cmds.extendedGetDestNames,
			this.config.matrix - 1, // matrix
			Number.parseInt(this.config.name_chars), // name characters
		)
	} else {
		// standard commands
		cmdGetSources.push(cmds.getSourceNames, (this.config.matrix - 1) << 4, this.config.name_chars)
		cmdGetDestinations.push(cmds.getDestNames, (this.config.matrix - 1) << 4, this.config.name_chars)
	}

	// get source names
	this.sendMessage(cmdGetSources)

	// get dest names
	this.sendMessage(cmdGetDestinations)
}
