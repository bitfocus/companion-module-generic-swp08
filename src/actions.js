import { actionOptions } from './consts.js'

export async function updateActions() {
	const actionDefinitions = []

	actionDefinitions.select_level = {
		name: 'Select Levels',
		options: [{ ...actionOptions.levels, choices: this.levels }],
		callback: ({ options }) => {
			this.processLevelsSelection(options.level, true)
		},
	}

	actionDefinitions.deselect_level = {
		name: 'De-Select Levels',
		options: [{ ...actionOptions.levels, choices: this.levels }],
		callback: ({ options }) => {
			this.processLevelsSelection(options.level, false)
		},
	}

	actionDefinitions.toggle_level = {
		name: 'Toggle Levels',
		options: [{ ...actionOptions.levels, choices: this.levels }],
		callback: ({ options }) => {
			this.processLevelsSelection(options.level, 'toggle')
		},
	}

	actionDefinitions.select_dest = {
		name: 'Select Destination',
		options: [actionOptions.destination],
		callback: ({ options }) => {
			this.selected_dest = Number.parseInt(options.dest)
			console.log(`set destination ${this.selected_dest}`)
			this.setVariableValuesCached({ Destination: this.selected_dest })
			this.checkFeedbacks('selected_dest', 'selected_level_dest', 'source_dest_route')
			if (!this.config.tally_dump_and_update) {
				this.getCrosspoints(options.dest)
			}
		},
		subscribe: ({ options }) => {
			if (!this.config.tally_dump_and_update) {
				this.getCrosspoints(options.dest)
			}
		},
	}

	actionDefinitions.select_dest_name = {
		name: 'Select Destination name',
		options: [{ ...actionOptions.destinationName, choices: this.dest_names }],
		callback: async ({ options }, context) => {
			const dest = Number.parseInt(await context.parseVariablesInString(options.dest))
			if (Number.isNaN(dest) || dest < 1 || dest > 65536) {
				this.log('warn', `select_dest_name has been passed an out of range variable ${dest}`)
				return undefined
			}
			this.selected_dest = dest
			console.log(`set destination ${this.selected_dest}`)
			this.setVariableValuesCached({ Destination: this.selected_dest })
			this.checkFeedbacks('selected_dest', 'selected_level_dest', 'source_dest_route')
			if (!this.config.tally_dump_and_update) {
				this.getCrosspoints(dest)
			}
		},
		subscribe: async (action, context) => {
			if (!this.config.tally_dump_and_update) {
				const dest = Number.parseInt(await context.parseVariablesInString(action.options.dest))
				if (Number.isNaN(dest) || dest < 1 || dest > 65536) {
					this.log('warn', `select_dest_name:Subscribe has been passed an out of range variable - dst ${dest}`)
					return undefined
				}
				this.getCrosspoints(dest)
			}
		},
	}

	actionDefinitions.select_source = {
		name: 'Select Source',
		options: [actionOptions.source],
		callback: ({ options }) => {
			this.selected_source = Number.parseInt(options.source)
			console.log(`set source ${this.selected_source}`)
			this.setVariableValuesCached({ Source: this.selected_source })
			this.checkFeedbacks('selected_source')
		},
	}

	actionDefinitions.select_source_name = {
		name: 'Select Source name',
		options: [{ ...actionOptions.sourceName, choices: Array.from(this.source_names.values()) }],
		callback: async ({ options }, context) => {
			const source = Number.parseInt(await context.parseVariablesInString(options.source))
			if (Number.isNaN(source) || source < 1 || source > 65536) {
				this.log('warn', `select_source_name has been passed an out of range variable ${source}`)
				return undefined
			}
			this.selected_source = source
			console.log(`set source ${this.selected_source}`)
			this.setVariableValuesCached({ Source: this.selected_source })
			this.checkFeedbacks('selected_source')
		},
	}

	actionDefinitions.route_source = {
		name: 'Route Source to selected Levels and Destination',
		options: [actionOptions.source],
		callback: ({ options }) => {
			console.log(this.selected_level)
			const l = this.selected_level.length
			for (let i = 0; i < l; i++) {
				if (this.selected_level[i].enabled === true) {
					this.SetCrosspoint(options.source, this.selected_dest, this.selected_level[i].id)
				}
			}
		},
	}

	actionDefinitions.route_source_name = {
		name: 'Route Source name to selected Levels and Destination',
		options: [{ ...actionOptions.sourceName, choices: Array.from(this.source_names.values()) }],
		callback: async ({ options }, context) => {
			const source = Number.parseInt(await context.parseVariablesInString(options.source))
			if (Number.isNaN(source) || source < 1 || source > 65536) {
				this.log('warn', `route_source_name has been passed an out of range variable ${source}`)
				return undefined
			}
			console.log(this.selected_level)
			const l = this.selected_level.length
			for (let i = 0; i < l; i++) {
				if (this.selected_level[i].enabled === true) {
					this.SetCrosspoint(source, this.selected_dest, this.selected_level[i].id)
				}
			}
		},
	}

	actionDefinitions.take = {
		name: 'Take',
		options: [],
		callback: () => {
			console.log(this.selected_level)
			const l = this.selected_level.length
			for (let i = 0; i < l; i++) {
				if (this.selected_level[i].enabled === true) {
					this.SetCrosspoint(this.selected_source, this.selected_dest, this.selected_level[i].id)
				}
			}
		},
	}

	actionDefinitions.clear = {
		name: 'Clear',
		options: [actionOptions.clear, actionOptions.clearEnableLevels],
		callback: ({ options }) => {
			if (options.clear === 'all' || options.clear === 'level') {
				this.selected_level = []
				for (let i = 1; i <= this.config.max_levels; i++) {
					this.selected_level.push({ id: i, enabled: options.clear_enable_levels })
				}
				this.checkFeedbacks('selected_level', 'selected_level_dest', 'source_dest_route')
				console.log('clear levels')
				console.log(this.selected_level)
			}

			if (options.clear === 'all' || options.clear === 'dest') {
				this.selected_dest = 0
				this.setVariableValuesCached({ Destination: this.selected_dest })
				this.checkFeedbacks('selected_dest', 'selected_level_dest', 'source_dest_route')
				console.log('clear dest')
			}

			if (options.clear === 'all' || options.clear === 'source') {
				this.selected_source = 0
				this.setVariableValuesCached({ Source: this.selected_source })
				this.checkFeedbacks('selected_source', 'clear source')
			}
		},
	}

	actionDefinitions.set_crosspoint = {
		name: 'Set crosspoint',
		options: [{ ...actionOptions.levels, choices: this.levels }, actionOptions.source, actionOptions.destination],
		callback: ({ options }) => {
			for (const level_val of options.level) {
				this.SetCrosspoint(options.source, options.dest, level_val)
			}
		},
	}

	actionDefinitions.set_crosspoint_name = {
		name: 'Set crosspoint by name',
		options: [
			{ ...actionOptions.levels, choices: this.levels },
			{ ...actionOptions.sourceName, choices: Array.from(this.source_names.values()) },
			{ ...actionOptions.destinationName, choices: Array.from(this.dest_names.values()) },
		],
		callback: async ({ options }, context) => {
			const source = Number.parseInt(await context.parseVariablesInString(options.source))
			const dest = Number.parseInt(await context.parseVariablesInString(options.dest))
			if (Number.isNaN(source) || source < 1 || source > 65536 || Number.isNaN(dest) || dest < 1 || dest > 65536) {
				this.log('warn', `set_crosspoint_name has been passed an out of range variable - src ${source} : dst ${dest}`)
				return undefined
			}
			for (const level_val of options.level) {
				this.SetCrosspoint(source, dest, level_val)
			}
		},
	}

	actionDefinitions.get_names = {
		name: 'Refresh Source and Destination names',
		options: [],
		callback: () => {
			this.readNames()
		},
	}

	this.setActionDefinitions(actionDefinitions)
}
