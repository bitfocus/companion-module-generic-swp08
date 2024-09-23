import { cmd } from './consts.js'

export function crosspointConnected(data) {
	//const matrix = ((data[1] & 0xf0) >> 4) + 1 unused
	const level = (data[1] & 0x0f) + 1
	const destDiv = (data[2] & 0x70) >> 4
	let sourceDiv = data[2] & 0x7
	const dest = 128 * destDiv + data[3] + 1
	const source = 128 * sourceDiv + data[4] + 1

	console.log('Source ' + source + ' routed to ' + dest + ' on level ' + level)
	this.log('debug', 'Source ' + source + ' routed to destination ' + dest + ' on level ' + level)

	this.update_crosspoints(source, dest, level)
}

export function ext_crosspointConnected(data) {
	//const matrix = data[1] + 1
	const level = data[2] + 1
	const destDiv = data[3] * 256
	const destMod = data[4]
	const sourceDiv = data[5] * 256
	const sourceMod = data[6]
	const dest = destDiv + destMod + 1
	const source = sourceDiv + sourceMod + 1

	console.log('Source ' + source + ' routed to ' + dest + ' on level ' + level)
	this.log('debug', 'Source ' + source + ' routed to destination ' + dest + ' on level ' + level)

	this.update_crosspoints(source, dest, level)
}

export function record_crosspoint(source, dest, level) {
	if (this.isRecordingActions) {
		this.recordAction(
			{
				actionId: 'set_crosspoint',
				options: { level: [level], source: source, dest: dest },
			},
			`connect dest ${dest} level ${level}`,
		)
	}
}

export function update_crosspoints(source, dest, level) {
	if (dest == this.selected_dest) {
		// update variables for selected dest source
		this.setVariableValues({ [`Sel_Dest_Source_Level_${level.toString()}`]: source })
		if (this.source_names.length > 0) {
			// only if names have been retrieved
			try {
				this.setVariableValues({
					[`Sel_Dest_Source_Name_Level_${level.toString()}`]: this.stripNumber(this.source_names[source - 1].label),
				})
			} catch (e) {
				this.log('debug', `Unable to set Sel_Dest_Source_Name_Level ${e.toString()}`)
			}
		}
	}

	// store route data
	for (let i = 0; i < this.routeTable.length; i++) {
		if (this.routeTable[i].level === level && this.routeTable[i].dest === dest) {
			// update existing
			this.routeTable[i].source = source
			console.log(this.routeTable)
			this.checkFeedbacks('source_dest_route', 'crosspoint_connected', 'crosspoint_connected_by_name')
			this.record_crosspoint(source, dest, level)
			return
		}
	}

	// add new
	const new_route = { level: level, dest: dest, source: source }
	this.routeTable.push(new_route)
	console.log(this.routeTable)
	this.checkFeedbacks('source_dest_route', 'crosspoint_connected', 'crosspoint_connected_by_name')
	this.record_crosspoint(source, dest, level)
}

export function SetCrosspoint(sourceN, destN, levelN) {
	let action
	this.log('debug', 'Crosspoint ' + sourceN + '>' + destN + ' level ' + levelN)
	console.log('SetCrosspoint ' + sourceN + '>' + destN + ' level ' + levelN)

	if (isNaN(sourceN) || sourceN <= 0 || sourceN > 65536) {
		this.log('warn', 'Unable to route source ' + sourceN)
		return
	}

	if (isNaN(destN) || destN <= 0 || destN > 65536) {
		this.log('warn', 'Unable to route destination ' + destN)
		return
	}

	if (isNaN(levelN) || levelN <= 0 || levelN > 256) {
		this.log('warn', 'Unable to route level ' + levelN)
		return
	}
	if (sourceN > 1024 || destN > 1024 || levelN > 16) {
		// Extended command required
		const COM = cmd.extendedConnect
		// Matrix
		const matrix = this.padLeft((this.config.matrix - 1).toString(16), 2)
		// Level
		const level = this.padLeft((levelN - 1).toString(16), 2)
		// Dest DIV 256
		const destDIV = this.padLeft(Math.floor((destN - 1) / 256).toString(16), 2)
		// Destination MOD 256
		const destMOD = this.padLeft(((destN - 1) % 256).toString(16), 2)
		// Source DIV 256
		const sourceDIV = this.padLeft(Math.floor((sourceN - 1) / 256).toString(16), 2)
		// Source MOD 128
		const sourceMOD = this.padLeft(((sourceN - 1) % 256).toString(16), 2)
		// Byte count
		const count = '07'
		// checksum
		const checksum = this.checksum8(COM + matrix + level + destDIV + destMOD + sourceDIV + sourceMOD + count)
		// message
		action = COM + matrix + level + destDIV + destMOD + sourceDIV + sourceMOD + count + checksum
	} else {
		// Standard Command
		const COM = cmd.connect
		// Matrix and Level
		const matrix = (this.config.matrix - 1) << 4
		const level = levelN - 1
		const matrix_level = this.padLeft((matrix | level).toString(16), 2)
		// Multiplier if source or dest > 128
		const destDIV = Math.floor((destN - 1) / 128)
		const sourceDIV = Math.floor((sourceN - 1) / 128)
		const multiplier = this.padLeft(((destDIV << 4) | sourceDIV).toString(16), 2)
		// Destination MOD 128
		const dest = this.padLeft(((destN - 1) % 128).toString(16), 2)
		// Source MOD 128
		const source = this.padLeft(((sourceN - 1) % 128).toString(16), 2)
		// Byte count
		const count = '05'
		// checksum
		const checksum = this.checksum8(COM + matrix_level + multiplier + dest + source + count)
		// message
		action = COM + matrix_level + multiplier + dest + source + count + checksum
	}

	this.sendMessage(action)
}

export function getCrosspoints(destN) {
	console.log('GetCrosspoint ' + destN)

	if (destN <= 0 || destN > 65536) {
		this.log('warn', 'Unable to get crosspoint destination ' + destN)
		return
	}

	if (this.config.max_levels > 16 || destN > 1024) {
		// Extended commands
		const COM = cmd.extendedinterrogate
		// Byte count
		const count = '05'
		// Matrix
		const matrix = this.padLeft((this.config.matrix - 1).toString(16), 2)
		// Dest DIV 256
		const destDIV = this.padLeft(Math.floor((destN - 1) / 256).toString(16), 2)
		// Dest Mod 256
		const destMOD = this.padLeft(((destN - 1) % 256).toString(16), 2)

		// check all levels
		for (let i = 0; i <= this.config.max_levels - 1; i++) {
			const level = this.padLeft(i.toString(16), 2)
			// checksum
			const checksum = this.checksum8(COM + matrix + level + destDIV + destMOD + count)
			// message
			const action = COM + matrix + level + destDIV + destMOD + count + checksum
			this.sendMessage(action)
		}
	} else {
		// Standard commands
		const COM = cmd.interrogate
		// Byte count
		const count = '04'
		// Matrix and Level
		const matrix = (this.config.matrix - 1) << 4
		// Multiplier if dest > 128
		const destDIV = Math.floor((destN - 1) / 128)
		const multiplier = this.padLeft((destDIV << 4).toString(16), 2)
		// Destination MOD 128
		const dest = this.padLeft(((destN - 1) % 128).toString(16), 2)

		// check all levels
		for (let i = 0; i <= this.config.max_levels - 1; i++) {
			const matrix_level = this.padLeft((matrix | i).toString(16), 2)
			// checksum
			const checksum = this.checksum8(COM + matrix_level + multiplier + dest + count)
			// message
			const action = COM + matrix_level + multiplier + dest + count + checksum
			this.sendMessage(action)
		}
	}
}
