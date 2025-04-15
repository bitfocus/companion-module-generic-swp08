import { actionOptions } from './consts.js'

export async function UpdateActions(self) {
	let actionDefinitions = []

	actionDefinitions['select_level'] = {
		name: 'Select Levels',
		options: [{ ...actionOptions.levels, choices: self.levels }],
		callback: ({ options }) => {
			self.processLevelsSelection(options.level, true)
		},
	}
	actionDefinitions['deselect_level'] = {
		name: 'De-Select Levels',
		options: [{ ...actionOptions.levels, choices: self.levels }],
		callback: ({ options }) => {
			self.processLevelsSelection(options.level, false)
		},
	}
	actionDefinitions['toggle_level'] = {
		name: 'Toggle Levels',
		options: [{ ...actionOptions.levels, choices: self.levels }],
		callback: ({ options }) => {
			self.processLevelsSelection(options.level, 'toggle')
		},
	}
	actionDefinitions['select_dest'] = {
		name: 'Select Destination',
		options: [actionOptions.destination],
		callback: ({ options }) => {
			self.selected_dest = parseInt(options.dest)
			self.getCrosspoints(options.dest)
			console.log('set destination ' + self.selected_dest)
			self.setVariableValues({ Destination: self.selected_dest })
			self.checkFeedbacks('selected_dest', 'selected_level_dest', 'source_dest_route')
		},
		subscribe: (action) => {
			self.getCrosspoints(action.options.dest)
		},
	}
	actionDefinitions['select_dest_name'] = {
		name: 'Select Destination name',
		options: [{ ...actionOptions.destinationName, choices: self.dest_names }],
		callback: async ({ options }) => {
			const dest = parseInt(await self.parseVariablesInString(options.dest))
			if (isNaN(dest) || dest < 1 || dest > 65536) {
				self.log('warn', `select_dest_name has been passed an out of range variable ${dest}`)
				return undefined
			}
			self.selected_dest = dest
			self.getCrosspoints(dest)
			console.log('set destination ' + self.selected_dest)
			self.setVariableValues({ Destination: self.selected_dest })
			self.checkFeedbacks('selected_dest', 'selected_level_dest', 'source_dest_route')
		},
		subscribe: async (action) => {
			const dest = parseInt(await self.parseVariablesInString(action.options.dest))
			if (isNaN(dest) || dest < 1 || dest > 65536) {
				self.log('warn', `select_dest_name:Subscribe has been passed an out of range variable - dst ${dest}`)
				return undefined
			}
			self.getCrosspoints(dest)
		},
	}
	actionDefinitions['select_source'] = {
		name: 'Select Source',
		options: [actionOptions.source],
		callback: ({ options }) => {
			self.selected_source = parseInt(options.source)
			console.log('set source ' + self.selected_source)
			self.setVariableValues({ Source: self.selected_source })
			self.checkFeedbacks('selected_source')
		},
	}
	actionDefinitions['select_source_name'] = {
		name: 'Select Source name',
		options: [{ ...actionOptions.sourceName, choices: Array.from(self.source_names.values()) }],
		callback: async ({ options }) => {
			const source = parseInt(await self.parseVariablesInString(options.source))
			if (isNaN(source) || source < 1 || source > 65536) {
				self.log('warn', `select_source_name has been passed an out of range variable ${source}`)
				return undefined
			}
			self.selected_source = source
			console.log('set source ' + self.selected_source)
			self.setVariableValues({ Source: self.selected_source })
			self.checkFeedbacks('selected_source')
		},
	}
	actionDefinitions['route_source'] = {
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
	actionDefinitions['route_source_name'] = {
		name: 'Route Source name to selected Levels and Destination',
		options: [{ ...actionOptions.sourceName, choices: Array.from(self.source_names.values()) }],
		callback: async ({ options }) => {
			const source = parseInt(await self.parseVariablesInString(options.source))
			if (isNaN(source) || source < 1 || source > 65536) {
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
	actionDefinitions['take'] = {
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
	actionDefinitions['clear'] = {
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
	actionDefinitions['set_crosspoint'] = {
		name: 'Set crosspoint',
		options: [{ ...actionOptions.levels, choices: self.levels }, actionOptions.source, actionOptions.destination],
		callback: ({ options }) => {
			for (let level_val of options.level) {
				self.SetCrosspoint(options.source, options.dest, level_val)
			}
		},
	}
	actionDefinitions['set_crosspoint_name'] = {
		name: 'Set crosspoint by name',
		options: [
			{ ...actionOptions.levels, choices: self.levels },
			{ ...actionOptions.sourceName, choices: Array.from(self.source_names.values()) },
			{ ...actionOptions.destinationName, choices: Array.from(self.dest_names.values()) },
		],
		callback: async ({ options }) => {
			const source = parseInt(await self.parseVariablesInString(options.source))
			const dest = parseInt(await self.parseVariablesInString(options.dest))
			if (isNaN(source) || source < 1 || source > 65536 || isNaN(dest) || dest < 1 || dest > 65536) {
				self.log('warn', `set_crosspoint_name has been passed an out of range variable - src ${source} : dst ${dest}`)
				return undefined
			}
			for (let level_val of options.level) {
				self.SetCrosspoint(source, dest, level_val)
			}
		},
	}
	actionDefinitions['get_names'] = {
		name: 'Refresh Source and Destination names',
		options: [],
		callback: () => {
			self.readNames()
		},
	}
	self.setActionDefinitions(actionDefinitions)
}
