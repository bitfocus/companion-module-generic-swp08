import { colours } from './consts.js'


export async function UpdateFeedbacks(self) {
	// feedback
	let feedbacks = {}

	feedbacks['selected_level'] = {
		type: 'boolean',
		label: 'Selected Levels',
		description: 'Change colour of button on selected levels',
		style: {
			color: colours.black,
			bgcolor: colours.purple,
		},
		options: [
			{
				type: 'multiselect',
				label: 'Levels',
				id: 'level',
				default: [1],
				choices: self.levels,
				minSelection: 1,
			},
		],
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
			bgcolor:colours.purple,
		},
		options: [
			{
				type: 'multiselect',
				label: 'Levels',
				id: 'level',
				default: [1],
				choices: self.levels,
				minSelection: 1,
			},
			{
				type: 'number',
				label: 'Destination',
				id: 'dest',
				default: 1,
				min: 1,
			},
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
		options: [
			{
				type: 'number',
				label: 'Destination',
				id: 'dest',
				default: 1,
				min: 1,
			},
		],
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
		options: [
			{
				type: 'number',
				label: 'Source',
				id: 'source',
				default: 1,
				min: 1,
			},
		],
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
		options: [
			{
				type: 'number',
				label: 'Source',
				id: 'source',
				default: 1,
				min: 1,
			},
		],
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

	self.setFeedbackDefinitions(feedbacks)
}
