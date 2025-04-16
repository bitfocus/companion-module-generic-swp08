import { colours, feedbackOptions } from './consts.js'

export async function UpdateFeedbacks(self) {
	const feedbackDefinitions = []

	feedbackDefinitions.selected_level = {
		name: 'Selected Levels',
		type: 'boolean',
		description: 'Change colour of button on selected levels',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.purple,
		},
		options: [{ ...feedbackOptions.levels, choices: self.levels }],
		callback: (feedback) => {
			const l = feedback.options.level.length
			const k = self.selected_level.length

			for (let i = 0; i < l; i++) {
				const feedback_test = feedback.options.level[i]
				for (let j = 0; j < k; j++) {
					if (self.selected_level[j].id === feedback_test) {
						if (self.selected_level[j].enabled === true) {
							// matched
						} else {
							return false
						}
					}
				}
			}
			return true
		},
	}

	feedbackDefinitions.selected_level_dest = {
		name: 'Selected Levels and Destination',
		type: 'boolean',
		description: 'Change colour of button on selected levels and destination',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.purple,
		},
		options: [{ ...feedbackOptions.levels, choices: self.levels }, feedbackOptions.destination],
		callback: (feedback) => {
			if (self.selected_dest === feedback.options.dest) {
				const l = feedback.options.level.length
				const k = self.selected_level.length

				for (let i = 0; i < l; i++) {
					const feedback_test = feedback.options.level[i]
					for (let j = 0; j < k; j++) {
						if (self.selected_level[j].id === feedback_test) {
							if (self.selected_level[j].enabled === true) {
								// matched
							} else {
								return false
							}
						}
					}
				}
				return true
			}

			return false
		},
	}

	feedbackDefinitions.selected_dest = {
		type: 'boolean',
		name: 'Selected Destination',
		description: 'Change colour of button on selected destination',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.green,
		},
		options: [feedbackOptions.destination],
		callback: (feedback) => {
			if (self.selected_dest === feedback.options.dest) {
				return true
			}
			return false
		},
	}

	feedbackDefinitions.selected_source = {
		type: 'boolean',
		name: 'Selected Source',
		description: 'Change colour of button on selected source',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.cyan,
		},
		options: [feedbackOptions.source],
		callback: (feedback) => {
			if (self.selected_source === feedback.options.source) {
				return true
			}
			return false
		},
	}

	feedbackDefinitions.source_dest_route = {
		type: 'boolean',
		name: 'Source Routed to Destination',
		description: 'Change button colour when this source is routed to selected destination on any level',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [feedbackOptions.source],
		callback: (feedback) => {
			// look for this dest in route table
			console.log(`dest:source feedback ${self.selected_dest}:${feedback.options.source}`)
			for (let i = 0; i < self.routeTable.length; i++) {
				if (self.routeTable[i].dest === self.selected_dest) {
					if (self.routeTable[i].source === feedback.options.source) {
						return true
					}
				}
			}
			return false
		},
	}

	feedbackDefinitions.crosspoint_connected = {
		type: 'boolean',
		name: 'Crosspoint Connected',
		description: 'Change button colour when this crosspoint is connected on any level',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [feedbackOptions.source, feedbackOptions.destination],
		callback: (feedback) => {
			// look for this dest in route table
			console.log(`dest:source feedback ${feedback.options.dest}:${feedback.options.source}`)
			for (let i = 0; i < self.routeTable.length; i++) {
				if (self.routeTable[i].dest === feedback.options.dest) {
					if (self.routeTable[i].source === feedback.options.source) {
						return true
					}
				}
			}
			return false
		},
		subscribe: (feedback) => {
			self.getCrosspoints(feedback.options.dest)
		},
	}
	feedbackDefinitions.crosspoint_connected_by_name = {
		type: 'boolean',
		name: 'Crosspoint Connected By Name',
		description: 'Change button colour when this crosspoint is connected on any level',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [
			{
				...feedbackOptions.sourceName,
				choices: Array.from(self.source_names.values()),
			},
			{
				...feedbackOptions.destinationName,
				choices: Array.from(self.dest_names.values()),
			},
		],
		callback: async (feedback, context) => {
			const source = Number.parseInt(await context.parseVariablesInString(feedback.options.source))
			const dest = Number.parseInt(await context.parseVariablesInString(feedback.options.dest))
			// look for this dest in route table
			if (Number.isNaN(source) || source < 1 || source > 65536 || Number.isNaN(dest) || dest < 1 || dest > 65536) {
				self.log(
					'warn',
					`crosspoint_connected_by_name has been passed an out of range variable - src ${source} : dst ${dest}`,
				)
				return undefined
			}
			console.log(`dest:source feedback ${feedback.options.dest}:${feedback.options.source}`)
			for (let i = 0; i < self.routeTable.length; i++) {
				if (self.routeTable[i].dest === dest) {
					if (self.routeTable[i].source === source) {
						return true
					}
				}
			}
			return false
		},
		subscribe: async (feedback, context) => {
			const dest = Number.parseInt(await context.parseVariablesInString(feedback.options.dest))
			if (Number.isNaN(dest) || dest < 1 || dest > 65536) {
				self.log(
					'warn',
					`crosspoint_connected_by_name:Subscribe has been passed an out of range variable - dst ${dest}`,
				)
				return undefined
			}
			self.getCrosspoints(dest)
		},
	}

	self.setFeedbackDefinitions(feedbackDefinitions)
}
