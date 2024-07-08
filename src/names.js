import { cmd } from './consts.js'

export function readNames() {
	// reset
	this.source_names = []
	this.dest_names = []
	this.setVariableValues({ Sources: 0, Destinations: 0 })
	let get_source
	let get_dest
	if (this.config.extended_support === true) {
		// extended commands (only gets source names for level 1)
		var matrix = this.padLeft((this.config.matrix - 1).toString(16), 2)
		get_source = cmd.extendedGetSourceName + matrix + '00' + this.config.name_chars + '04'
		get_dest = cmd.extendedGetDestName + matrix + this.config.name_chars + '03'
	} else {
		// standard commands
		get_source = cmd.getSourceName + this.config.name_chars + '02'
		get_dest = cmd.getDestName + this.config.name_chars + '02'
	}

	// get source names
	this.sendMessage(get_source + this.checksum8(get_source))

	// get dest names
	this.sendMessage(get_dest + this.checksum8(get_dest))
}
