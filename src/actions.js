import { actionOptions } from './consts.js'

export async function UpdateActions(self) {
	let actionDefinitions = []

	actionDefinitions['select_level'] = {
		name: 'Select Levels',
		options: [
			{
				...actionOptions.levels,
				choices: self.levels,
			},
		],
		callback: async ({ options }) => {
			self.processLevelsSelection(options.level, true)
		},
	}
	actionDefinitions['deselect_level'] = {
		name: 'De-Select Levels',
		options: [
			{
				...actionOptions.levels,
				choices: self.levels,
			},
		],
		callback: async ({ options }) => {
			self.processLevelsSelection(options.level, false)
		},
	}
	actionDefinitions['toggle_level'] = {
		name: 'Toggle Levels',
		options: [
			{
				...actionOptions.levels,
				choices: self.levels,
			},
		],
		callback: async ({ options }) => {
			self.processLevelsSelection(options.level, 'toggle')
		},
	}
	actionDefinitions['select_dest'] = {
		name: 'Select Destination',
		options: [ actionOptions.destination ],
		callback: async ({ options }) => {
			self.selected_dest = parseInt(options.dest)
			self.getCrosspoints(options.dest)
			console.log('set destination ' + self.selected_dest)
			self.setVariableValues({ Destination: self.selected_dest })
			self.checkFeedbacks('selected_dest', 'selected_level_dest')
		},
	}
	actionDefinitions['select_dest_name'] = {
		name: 'Select Destination name',
		options: [{ ...actionOptions.destinationName, choices: self.dest_names }],
		callback: async ({ options }) => {
			self.selected_dest = parseInt(options.dest)
			self.getCrosspoints(options.dest)
			console.log('set destination ' + self.selected_dest)
			self.setVariableValues({ Destination: self.selected_dest })
			self.checkFeedbacks('selected_dest', 'selected_level_dest')
		},
	}
	actionDefinitions['select_source'] = {
		name: 'Select Source',
		options: [ actionOptions.source ],
		callback: async ({ options }) => {
			self.selected_source = parseInt(options.source)
			console.log('set source ' + self.selected_source)
			self.setVariableValues({ Source: self.selected_source })
			self.checkFeedbacks('selected_source')
		},
	}
	actionDefinitions['select_source_name'] = {
		name: 'Select Source name',
		options: [{ ...actionOptions.sourceName, choices: self.source_names }],
		callback: async ({ options }) => {
			self.selected_source = parseInt(options.source)
			console.log('set source ' + self.selected_source)
			self.setVariableValues({ Source: self.selected_source })
			self.checkFeedbacks('selected_source')
		},
	}
	actionDefinitions['route_source'] = {
		name: 'Route Source to selected Levels and Destination',
		options: [ actionOptions.source ],
		callback: async ({ options }) => {
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
		options: [{ ...actionOptions.sourceName, choices: self.source_names }],
		callback: async ({ options }) => {
			console.log(self.selected_level)
			const l = self.selected_level.length
			for (let i = 0; i < l; i++) {
				if (self.selected_level[i].enabled === true) {
					self.SetCrosspoint(options.source, self.selected_dest, self.selected_level[i].id)
				}
			}
		},
	}
	actionDefinitions['take'] = {
		name: 'Take',
		options: [],
		callback: async () => {
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
		options: [ actionOptions.clear, actionOptions.clearEnableLevels ],
		callback: async ({ options }) => {
			if (options.clear === 'all' || options.clear === 'level') {
				self.selected_level = []
				for (let i = 1; i <= self.config.max_levels; i++) {
					self.selected_level.push({ id: i, enabled: options.clear_enable_levels })
				}
				self.checkFeedbacks('selected_level', 'selected_level_dest')
				console.log('clear levels')
				console.log(self.selected_level)
			}

			if (options.clear === 'all' || options.clear === 'dest') {
				self.selected_dest = 0
				self.setVariableValues({ Destination: self.selected_dest })
				self.checkFeedbacks('selected_dest', 'selected_level_dest')
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
		options: [
			{
				...actionOptions.levels,
				choices: self.levels,
			},
			actionOptions.source,
			actionOptions.destination,
		],
		callback: async ({ options }) => {
			for (let level_val of options.level) {
				self.SetCrosspoint(options.source, options.dest, level_val)
			}
		},
	}
	actionDefinitions['set_crosspoint_name'] = {
		name: 'Set crosspoint by name',
		options: [
			{
				...actionOptions.levels,
				choices: this.levels,
			},
			{ ...actionOptions.sourceName, choices: self.source_names },
			{ ...actionOptions.destinationName, choices: self.dest_names },
		],
		callback: async ({ options }) => {
			for (let level_val of options.level) {
				self.SetCrosspoint(options.source, options.dest, level_val)
			}
		},
	}
	actionDefinitions['get_names'] = {
		name: 'Refresh Source and Destination names',
		options: [],
		callback: async () => {
			self.readNames()
		},
	}
	self.setActionDefinitions(actionDefinitions)
}
