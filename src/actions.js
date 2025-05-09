import { actionOptions } from './consts.js'

export async function UpdateActions(self) {
	const actionDefinitions = []

	actionDefinitions.select_level = {
		name: 'Select Levels',
		options: [{ ...actionOptions.levels, choices: self.levels }],
		callback: ({ options }) => {
			self.processLevelsSelection(options.level, true)
		},
	}
	actionDefinitions.deselect_level = {
		name: 'De-Select Levels',
		options: [{ ...actionOptions.levels, choices: self.levels }],
		callback: ({ options }) => {
			self.processLevelsSelection(options.level, false)
		},
	}
	actionDefinitions.toggle_level = {
		name: 'Toggle Levels',
		options: [{ ...actionOptions.levels, choices: self.levels }],
		callback: ({ options }) => {
			self.processLevelsSelection(options.level, 'toggle')
		},
	}
	actionDefinitions.select_dest = {
		name: 'Select Destination',
		options: [actionOptions.destination],
		callback: ({ options }) => {
			self.selected_dest = Number.parseInt(options.dest)
			console.log(`set destination ${self.selected_dest}`)
			self.setVariableValues({ Destination: self.selected_dest })
			self.checkFeedbacks('selected_dest', 'selected_level_dest', 'source_dest_route')
			if (!self.config.tally_dump_and_update) {
				self.getCrosspoints(options.dest)
			}
		},
		subscribe: ({ options }) => {
			if (!self.config.tally_dump_and_update) {
				self.getCrosspoints(options.dest)
			}
		},
	}
	actionDefinitions.select_dest_name = {
		name: 'Select Destination name',
		options: [{ ...actionOptions.destinationName, choices: self.dest_names }],
		callback: async ({ options }, context) => {
			const dest = Number.parseInt(await context.parseVariablesInString(options.dest))
			if (Number.isNaN(dest) || dest < 1 || dest > 65536) {
				self.log('warn', `select_dest_name has been passed an out of range variable ${dest}`)
				return undefined
			}
			self.selected_dest = dest
			console.log(`set destination ${self.selected_dest}`)
			self.setVariableValues({ Destination: self.selected_dest })
			self.checkFeedbacks('selected_dest', 'selected_level_dest', 'source_dest_route')
			if (!self.config.tally_dump_and_update) {
				self.getCrosspoints(dest)
			}
		},
		subscribe: async (action, context) => {
			if (!self.config.tally_dump_and_update) {
				const dest = Number.parseInt(await context.parseVariablesInString(action.options.dest))
				if (Number.isNaN(dest) || dest < 1 || dest > 65536) {
					self.log('warn', `select_dest_name:Subscribe has been passed an out of range variable - dst ${dest}`)
					return undefined
				}
				self.getCrosspoints(dest)
			}
		},
	}
	actionDefinitions.select_source = {
		name: 'Select Source',
		options: [actionOptions.source],
		callback: ({ options }) => {
			self.selected_source = Number.parseInt(options.source)
			console.log(`set source ${self.selected_source}`)
			self.setVariableValues({ Source: self.selected_source })
			self.checkFeedbacks('selected_source')
		},
	}
	actionDefinitions.select_source_name = {
		name: 'Select Source name',
		options: [{ ...actionOptions.sourceName, choices: Array.from(self.source_names.values()) }],
		callback: async ({ options }, context) => {
			const source = Number.parseInt(await context.parseVariablesInString(options.source))
			if (Number.isNaN(source) || source < 1 || source > 65536) {
				self.log('warn', `select_source_name has been passed an out of range variable ${source}`)
				return undefined
			}
			self.selected_source = source
			console.log(`set source ${self.selected_source}`)
			self.setVariableValues({ Source: self.selected_source })
			self.checkFeedbacks('selected_source')
		},
	}
	actionDefinitions.route_source = {
		name: 'Route Source to selected Levels and Destination',
		options: [actionOptions.source],
		callback: ({ options }) => {
			console.log(self.selected_level)
			const l = self.selected_level.length
			for (let i = 0; i < l; i++) {
				if (self.selected_level[i].enabled === true) {
					self.SetCrosspoint(options.source, self.selected_dest, self.selected_level[i].id)
				}
			}
		},
	}
	actionDefinitions.route_source_name = {
		name: 'Route Source name to selected Levels and Destination',
		options: [{ ...actionOptions.sourceName, choices: Array.from(self.source_names.values()) }],
		callback: async ({ options }, context) => {
			const source = Number.parseInt(await context.parseVariablesInString(options.source))
			if (Number.isNaN(source) || source < 1 || source > 65536) {
				self.log('warn', `route_source_name has been passed an out of range variable ${source}`)
				return undefined
			}
			console.log(self.selected_level)
			const l = self.selected_level.length
			for (let i = 0; i < l; i++) {
				if (self.selected_level[i].enabled === true) {
					self.SetCrosspoint(source, self.selected_dest, self.selected_level[i].id)
				}
			}
		},
	}
	actionDefinitions.take = {
		name: 'Take',
		options: [],
		callback: () => {
			console.log(self.selected_level)
			const l = self.selected_level.length
			for (let i = 0; i < l; i++) {
				if (self.selected_level[i].enabled === true) {
					self.SetCrosspoint(self.selected_source, self.selected_dest, self.selected_level[i].id)
				}
			}
		},
	}
	actionDefinitions.clear = {
		name: 'Clear',
		options: [actionOptions.clear, actionOptions.clearEnableLevels],
		callback: ({ options }) => {
			if (options.clear === 'all' || options.clear === 'level') {
				self.selected_level = []
				for (let i = 1; i <= self.config.max_levels; i++) {
					self.selected_level.push({ id: i, enabled: options.clear_enable_levels })
				}
				self.checkFeedbacks('selected_level', 'selected_level_dest', 'source_dest_route')
				console.log('clear levels')
				console.log(self.selected_level)
			}

			if (options.clear === 'all' || options.clear === 'dest') {
				self.selected_dest = 0
				self.setVariableValues({ Destination: self.selected_dest })
				self.checkFeedbacks('selected_dest', 'selected_level_dest', 'source_dest_route')
				console.log('clear dest')
			}

			if (options.clear === 'all' || options.clear === 'source') {
				self.selected_source = 0
				self.setVariableValues({ Source: self.selected_source })
				self.checkFeedbacks('selected_source', 'clear source')
			}
		},
	}
	actionDefinitions.set_crosspoint = {
		name: 'Set crosspoint',
		options: [{ ...actionOptions.levels, choices: self.levels }, actionOptions.source, actionOptions.destination],
		callback: ({ options }) => {
			for (const level_val of options.level) {
				self.SetCrosspoint(options.source, options.dest, level_val)
			}
		},
	}
	actionDefinitions.set_crosspoint_name = {
		name: 'Set crosspoint by name',
		options: [
			{ ...actionOptions.levels, choices: self.levels },
			{ ...actionOptions.sourceName, choices: Array.from(self.source_names.values()) },
			{ ...actionOptions.destinationName, choices: Array.from(self.dest_names.values()) },
		],
		callback: async ({ options }, context) => {
			const source = Number.parseInt(await context.parseVariablesInString(options.source))
			const dest = Number.parseInt(await context.parseVariablesInString(options.dest))
			if (Number.isNaN(source) || source < 1 || source > 65536 || Number.isNaN(dest) || dest < 1 || dest > 65536) {
				self.log('warn', `set_crosspoint_name has been passed an out of range variable - src ${source} : dst ${dest}`)
				return undefined
			}
			for (const level_val of options.level) {
				self.SetCrosspoint(source, dest, level_val)
			}
		},
	}
	actionDefinitions.get_names = {
		name: 'Refresh Source and Destination names',
		options: [],
		callback: () => {
			self.readNames()
		},
	}
	self.setActionDefinitions(actionDefinitions)
}
