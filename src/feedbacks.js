import { colours, feedbackOptions } from './consts.js'

export async function UpdateFeedbacks(self) {
	let feedbacks = {}

	feedbacks['selected_level'] = {
		type: 'boolean',
		label: 'Selected Levels',
		description: 'Change colour of button on selected levels',
		style: {
			color: colours.black,
			bgcolor: colours.purple,
		},
		options: [{ ...feedbackOptions.levels, choices: self.levels }],
		callback: async (feedback) => {
			let l = feedback.options.level.length
			let k = self.selected_level.length

			for (let i = 0; i < l; i++) {
				let feedback_test = feedback.options.level[i]
				for (let j = 0; j < k; j++) {
					if (self.selected_level[j].id == feedback_test) {
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

	feedbacks['selected_level_dest'] = {
		type: 'boolean',
		label: 'Selected Levels and Destination',
		description: 'Change colour of button on selected levels and destination',
		style: {
			color: colours.black,
			bgcolor: colours.purple,
		},
		options: [
			{ ...feedbackOptions.levels, choices: self.levels },
			feedbackOptions.destination,
		],
		callback: async (feedback) => {
			if (self.selected_dest === feedback.options.dest) {
				let l = feedback.options.level.length
				let k = self.selected_level.length

				for (let i = 0; i < l; i++) {
					let feedback_test = feedback.options.level[i]
					for (let j = 0; j < k; j++) {
						if (self.selected_level[j].id == feedback_test) {
							if (self.selected_level[j].enabled === true) {
								// matched
							} else {
								return false
							}
						}
					}
				}
				return true
			} else {
				return false
			}
		},
	}

	feedbacks['selected_dest'] = {
		type: 'boolean',
		label: 'Selected Destination',
		description: 'Change colour of button on selected destination',
		style: {
			color: colours.black,
			bgcolor: colours.green,
		},
		options: [ feedbackOptions.destination ],
		callback: async (feedback) => {
			if (self.selected_dest === feedback.options.dest) {
				return true
			} else {
				return false
			}
		},
	}

	feedbacks['selected_source'] = {
		type: 'boolean',
		label: 'Selected Source',
		description: 'Change colour of button on selected source',
		style: {
			color: colours.black,
			bgcolor: colours.cyan,
		},
		options: [ feedbackOptions.source ],
		callback: async (feedback) => {
			if (self.selected_source === feedback.options.source) {
				return true
			} else {
				return false
			}
		},
	}

	feedbacks['source_dest_route'] = {
		type: 'boolean',
		label: 'Source Routed to Destination',
		description: 'Change button colour when this source is routed to selected destination on any level',
		style: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [ feedbackOptions.source ],
		callback: async (feedback) => {
			// look for this dest in route table
			console.log('dest:source feedback ' + self.selected_dest + ':' + feedback.options.source)
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

	feedbacks['crosspoint_connected'] = {
		type: 'boolean',
		label: 'Crosspoint Connected',
		description: 'Change button colour when this crosspoint is connected on any level',
		style: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [feedbackOptions.source, feedbackOptions.destination],
		callback: async (feedback) => {
			// look for this dest in route table
			console.log('dest:source feedback ' + feedback.options.dest + ':' + feedback.options.source)
			for (let i = 0; i < self.routeTable.length; i++) {
				if (self.routeTable[i].dest === feedback.options.dest) {
					if (self.routeTable[i].source === feedback.options.source) {
						return true
					}
				}
			}
			return false
		},
	}
	feedbacks['crosspoint_connected_by_name'] = {
		type: 'boolean',
		label: 'Crosspoint Connected By Name',
		description: 'Change button colour when this crosspoint is connected on any level',
		style: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [feedbackOptions.sourceName, feedbackOptions.destinationName],
		callback: async (feedback, context) => {
			const source = parseInt(await context.parseVariablesInString(feedback.options.source))
			const dest = parseInt(await context.parseVariablesInString(feedback.options.dest))
			// look for this dest in route table
			if (isNaN(source) || source < 1 || source > 65536 || isNaN(dest) || dest < 1 || dest > 65536) {
				self.log(
					'warn',
					`crosspoint_connected_by_name has been passed an out of range variable - src ${source} : dst ${dest}`
				)
				return undefined
			}
			console.log('dest:source feedback ' + feedback.options.dest + ':' + feedback.options.source)
			for (let i = 0; i < self.routeTable.length; i++) {
				if (self.routeTable[i].dest === dest) {
					if (self.routeTable[i].source === source) {
						return true
					}
				}
			}
			return false
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
