export async function UpdateActions(self) {
    let actionDefinitions = []

	actionDefinitions['select_level'] = {
		name: 'Select Levels',
		options: [
			{
				type: 'multidropdown',
				label: 'Levels',
				id: 'level',
				default: [1],
				choices: this.levels,
				minSelection: 1,
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
					type: 'multidropdown',
					label: 'Levels',
					id: 'level',
					default: [1],
					choices: this.levels,
					minSelection: 1,
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
					type: 'multidropdown',
					label: 'Levels',
					id: 'level',
					default: [1],
					choices: this.levels,
					minSelection: 1,
				},
			],
			callback: async ({ options }) => {
                self.processLevelsSelection(options.level, 'toggle')
            },
		}
    actionDefinitions['select_dest'] = {
			name: 'Select Destination',
			options: [
				{
					type: 'number',
					label: 'Destination',
					id: 'dest',
					default: 1,
					min: 1,
					max: 65536,
				},
			],
			callback: async ({ options }) => {
                self.selected_dest = parseInt(options.dest)
				self.getCrosspoints(options.dest)
				console.log('set destination ' + self.selected_dest)
				self.setVariableValues({ Destination : self.selected_dest})
				self.checkFeedbacks('selected_dest', 'selected_level_dest')
            },
		}
    actionDefinitions['select_dest_name'] = {
			name: 'Select Destination name',
			options: [
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'dest',
					default: 1,
					choices: this.dest_names,
				},
			],
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
			options: [
				{
					type: 'number',
					label: 'Source',
					id: 'source',
					default: 1,
					min: 1,
					max: 65536,
				},
			],
			callback: async ({ options }) => {
                self.selected_source = parseInt(options.source)
				console.log('set source ' + self.selected_source)
				self.setVariableValues({ Source : self.selected_source })
				self.checkFeedbacks('selected_source')
            },
		}
    actionDefinitions['select_source_name'] = {
			name: 'Select Source name',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: 1,
					choices: this.source_names,
				},
			],
			callback: async ({ options }) => {
                self.selected_source = parseInt(options.source)
				console.log('set source ' + self.selected_source)
				self.setVariableValues({ Source: self.selected_source })
				self.checkFeedbacks('selected_source')
            },
		}
    actionDefinitions['route_source'] = {
			name: 'Route Source to selected Levels and Destination',
			options: [
				{
					type: 'number',
					label: 'Source',
					id: 'source',
					default: 1,
					min: 1,
					max: 65536,
				},
			],
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
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: 1,
					choices: this.source_names,
				},
			],
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
			options: [
				{
					type: 'dropdown',
					label: 'Clear',
					id: 'clear',
					default: 'all',
					choices: [
						{ id: 'all', label: 'All' },
						{ id: 'level', label: 'Levels' },
						{ id: 'dest', label: 'Destination' },
						{ id: 'source', label: 'Source' },
					],
				},
				{
					type: 'checkbox',
					label: "Enable all levels on 'Clear All' or 'Clear Levels'",
					id: 'clear_enable_levels',
					default: true,
				},
			],
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
                    self.setVariableValues({ Destination : self.selected_dest })
                    self.checkFeedbacks('selected_dest', 'selected_level_dest')
                    console.log('clear dest')
                }

                if (options.clear === 'all' || options.clear === 'source') {
                    self.selected_source = 0
                    self.setVariableValues({ Source : self.selected_source })
                    self.checkFeedbacks('selected_source', 'clear source')
                }
            },
		}
    actionDefinitions['set_crosspoint'] = {
			name: 'Set crosspoint',
			options: [
				{
					type: 'multidropdown',
					label: 'Levels',
					id: 'level',
					default: [1],
					choices: this.levels,
					minSelection: 1,
				},
				{
					type: 'number',
					label: 'Source',
					id: 'source',
					default: 1,
					min: 1,
					max: 65536,
				},
				{
					type: 'number',
					label: 'Destination',
					id: 'dest',
					default: 1,
					min: 1,
					max: 65536,
				},
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
					type: 'multidropdown',
					label: 'Levels',
					id: 'level',
					default: [1],
					choices: this.levels,
					minSelection: 1,
				},
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: 1,
					choices: this.source_names,
				},
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'dest',
					default: 1,
					choices: this.dest_names,
				},
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
