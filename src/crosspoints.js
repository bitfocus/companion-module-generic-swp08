import { cmds } from './consts.js'

export function getRouteVariableName(level, dest) {
	return `Route_${level}_${dest}`
}

export function crosspointConnected(data) {
	const matrix = ((data[1] & 0xf0) >> 4) + 1
	const level = (data[1] & 0x0f) + 1
	const dest = ((data[2] & 0x70) << 3) + data[3] + 1
	const source = ((data[2] & 0x07) << 7) + data[4] + 1

	if (matrix !== this.config.matrix) {
		return
	}

	//console.log(`Source ${source} routed to ${dest} on level ${level}`)
	this.log('debug', `Source ${source} routed to destination ${dest} on level ${level}`)

	this.update_crosspoints(source, dest, level)
}

export function ext_crosspointConnected(data) {
	const matrix = data[1] + 1
	const level = data[2] + 1
	const dest = ((data[3] << 8) | data[4]) + 1
	const source = ((data[5] << 8) | data[6]) + 1

	if (matrix !== this.config.matrix) {
		return
	}

	//console.log(`Source ${source} routed to ${dest} on level ${level}`)
	this.log('debug', `Source ${source} routed to destination ${dest} on level ${level}`)

	this.update_crosspoints(source, dest, level)
}

export function setRoutemap(source, dest, level) {
	let map = this.routeMap.get(dest)
	if (!map) {
		map = new Map()
		this.routeMap.set(dest, map)
	}

	map.set(level, source)
}

export function getRoutemapEntries(dest) {
	const map = this.routeMap.get(dest)
	if (map) {
		const sources = Object.fromEntries(map.entries())
		return sources
	}
	return {}
}

export function hasSourceInAnyLevelRoutemap(dest, source) {
	return Object.values(this.getRoutemapEntries(dest)).some((entry) => entry === source)
}

export function hasSourceInRoutemap(level, dest, source) {
	return this.getRoutemapEntries(dest)[level] === source
}

/**
 * Process crosspoint tally dump
 * @param {Buffer} data
 */
export function processCrosspointTallyDump(data) {
	const type = data[0] === cmds.crosspointTallyDumpByteResponse ? 'byte' : 'word'
	const matrix = ((data[1] & 0xf0) >> 4) + 1
	const level = (data[1] & 0x0f) + 1

	this.processCrosspointTallyDumpData(data, matrix, level, type, 2)
}

/**
 * General function for processing crosspoint tally dumps
 * @param {Buffer} data
 * @param {string} matrix Matrix number
 * @param {number} level Level number
 * @param {'byte'|'word'} type Type of data (byte or word)
 * @param {number} offset Offset in the buffer where the data starts
 */
export function processCrosspointTallyDumpData(data, matrix, level, type, offset) {
	const tallies = data[offset]

	if (matrix !== this.config.matrix) {
		return
	}

	this.log('debug', `Crosspoint tally dump for matrix ${matrix} level ${level} are going to read ${tallies} tallies`)

	const psize = (type === 'byte' ? 1 : 2) * tallies
	if (psize > 133 - 3) {
		this.log(
			'warn',
			`Tally dump for matrix ${matrix} level ${level} has ${tallies} tallies (${psize + 3} exceeds the maximum size of 133 bytes per packet)`,
		)
	}

	if (tallies > 64) {
		this.log(
			'warn',
			`Tally dump for matrix ${matrix} level ${level} has ${tallies} tallies (more than 64 specified as limit by protocol)`,
		)
	}

	let currentOffset = offset + 1
	if (type === 'byte') {
		let dest = data.readUInt8(currentOffset) + 1
		currentOffset += 1
		for (let i = 0; i < tallies; i++) {
			if (currentOffset + 1 > data.length) {
				this.log(
					'warn',
					`Tally dump for matrix ${matrix} level ${level} has ${tallies} tallies but only ${data.length} bytes available`,
				)
				break
			}
			const source = data.readUInt8(currentOffset + 1) + 1
			this.setRoutemap(source, dest, level)
			dest++
			currentOffset++
		}
	} else {
		let dest = data.readUInt16BE(currentOffset) + 1
		currentOffset += 2
		for (let i = 0; i < tallies; i++) {
			const source = data.readUInt16BE(currentOffset) + 1
			this.setRoutemap(source, dest, level)
			currentOffset += 2
			dest++
		}
	}

	this.debouncedCrosspointUpdate()
}

/**
 * Process extended crosspoint tally dump (word)
 * @param {Buffer} data
 */
export function processExtCrosspointTallyDump(data) {
	const matrix = data[1] + 1
	const level = data[2] + 1

	// we only know about word-style extended tally dumps
	this.processCrosspointTallyDumpData(data, matrix, level, 'word', 3)
}

export function updateAllCrosspoints() {
	const variables = new Map()
	const numDests = this.dest_names.size > 0 ? this.dest_names.size : 256
	for (let dest = 1; dest <= numDests; dest++) {
		if (dest === this.selected_dest) {
			const map = this.routeMap.get(dest) ?? new Map()
			for (let level = 1; level <= this.config.max_levels; level++) {
				if (map.has(level)) {
					const source = map.get(level)
					variables.set(`Sel_Dest_Source_Level_${level}`, source)
					if (this.source_names.size > 0) {
						// only if names have been retrieved
						try {
							variables.set(
								`Sel_Dest_Source_Name_Level_${level}`,
								this.stripNumber(this.source_names.get(source - 1)?.label || 'N/A'),
							)
						} catch (e) {
							this.log('debug', `Unable to set Sel_Dest_Source_Name_Level ${e?.message || e.toString()}`)
						}
					}
				} else {
					variables.set(`Sel_Dest_Source_Level_${level}`, -1)
					variables.set(`Sel_Dest_Source_Name_Level_${level}`, 'N/A')
				}
			}
		}
	}

	if (this.config.tally_dump_variables) {
		for (const index of this.routeMap.keys()) {
			const levels = this.routeMap.get(index) ?? new Map()
			for (const level of levels.keys()) {
				variables.set(getRouteVariableName(level, index), levels.get(level))
			}
		}
	}

	this.setVariableValuesCached(Object.fromEntries(variables))

	// TODO: separate id for each destination, and only send source_dest_route if any of them have changed
	this.checkFeedbacks(
		'source_dest_route',
		'crosspoint_connected',
		'crosspoint_connected_by_name',
		'crosspoint_connected_by_level',
	)
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
	if (dest === this.selected_dest) {
		// update variables for selected dest source
		this.setVariableValuesCached({ [`Sel_Dest_Source_Level_${level}`]: source })
		if (this.source_names.size > 0) {
			// only if names have been retrieved
			try {
				this.setVariableValuesCached({
					[`Sel_Dest_Source_Name_Level_${level}`]: this.stripNumber(this.source_names.get(source - 1)?.label || 'N/A'),
				})
			} catch (e) {
				this.log('debug', `Unable to set Sel_Dest_Source_Name_Level ${e?.message || e.toString()}`)
			}
		}
	}

	this.setVariableValuesCached({ [getRouteVariableName(level, dest)]: source })
	this.setRoutemap(source, dest, level)
	this.checkFeedbacks(
		'source_dest_route',
		'crosspoint_connected',
		'crosspoint_connected_by_name',
		'crosspoint_connected_by_level',
	)
	this.record_crosspoint(source, dest, level)
}

export function SetCrosspoint(sourceN, destN, levelN) {
	const cmd = []
	this.log('debug', `Crosspoint ${sourceN}>${destN} level ${levelN}`)
	console.log(`SetCrosspoint ${sourceN}>${destN} level ${levelN}`)

	if (Number.isNaN(sourceN) || sourceN <= 0 || sourceN > 65536) {
		this.log('warn', `Unable to route source ${sourceN}`)
		return
	}

	if (Number.isNaN(destN) || destN <= 0 || destN > 65536) {
		this.log('warn', `Unable to route destination ${destN}`)
		return
	}

	if (Number.isNaN(levelN) || levelN < 0 || levelN > 255) {
		this.log('warn', `Unable to route level ${levelN}`)
		return
	}

	const source = sourceN - 1
	const dest = destN - 1
	const level = levelN - 1

	if ((source > 1023 || dest > 1023 || levelN > 15) && this.hasCommand(cmds.extendedCrosspointConnect)) {
		if (this.config.extended_support === false) {
			this.log(
				'warn',
				'Doing a crosspoint connect with a value outside of the normal command range, but extended support is not enabled, using extended command anyway',
			)
			return
		}
		// Extended command required
		cmd.push(cmds.extendedCrosspointConnect)
		// Matrix
		cmd.push(this.config.matrix - 1)
		// Level
		cmd.push(level)
		// Dest DIV 256
		cmd.push(dest >> 8)
		// Destination MOD 256
		cmd.push(dest & 0xff)
		// Source DIV 256
		cmd.push(source >> 8)
		// Source MOD 256
		cmd.push(source & 0xff)
	} else {
		if (source > 1023 || dest > 1023 || levelN > 15) {
			this.log(
				'error',
				'Doing a crosspoint connect with a source, destination or level value outside of the normal command range, but extended support is not supported by the device, cannot do crosspoint.',
			)
			return
		}

		// Standard Command
		cmd.push(cmds.crosspointConnect)
		// Matrix and Level
		cmd.push(((this.config.matrix - 1) << 4) | (level & 0x0f))
		// Multiplier if source or dest > 128
		cmd.push(
			((source >> 7) & 0x07) | // source DIV 128 Bits 0-2
				(((dest >> 7) & 0x07) << 4), // dest DIV 128 Bits 4-6
		)
		// Destination MOD 128
		cmd.push(dest & 0x7f)
		// Source MOD 128
		cmd.push(source & 0x7f)
	}

	this.sendMessage(cmd)
}

export function getCrosspoints(destN) {
	console.log(`GetCrosspoint ${destN}`)

	if (destN <= 0 || destN > 65536) {
		this.log('warn', `Unable to get crosspoint destination ${destN}`)
		return
	}
	const dest = destN - 1

	if ((this.config.max_levels > 16 || dest > 1023) && this.hasCommand(cmds.extendedInterrogate)) {
		// check all levels
		for (let i = 0; i < this.config.max_levels; i++) {
			this.sendMessage([
				// Extended commands
				cmds.extendedInterrogate,
				// Matrix
				this.config.matrix - 1,
				// Level
				i,
				// Dest DIV 256
				dest >> 8,
				// Dest Mod 256
				dest & 0xff,
			])
		}
	} else {
		if (this.config.max_levels > 16 || dest > 1023) {
			this.log(
				'error',
				'Doing a crosspoint interrogate with a source, destination or level value outside of the normal command range, but extended support is not supported by the device, cannot do crosspoint interrogate.',
			)
			return
		}

		// check all levels
		for (let i = 0; i <= this.config.max_levels - 1; i++) {
			this.sendMessage([
				// Standard commands
				cmds.crosspointInterrogate,
				// Matrix and Level
				((this.config.matrix - 1) << 4) | (i & 0x0f),
				// Multiplier dest > 128
				((dest >> 7) & 0x07) << 4, // dest DIV 128 Bits 4-6
				dest & 0x7f, // Destination MOD 128
			])
		}
	}
}
