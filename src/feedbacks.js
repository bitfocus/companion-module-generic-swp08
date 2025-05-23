import { colours, feedbackOptions } from './consts.js'

export async function updateFeedbacks() {
	const feedbackDefinitions = []

	feedbackDefinitions.selected_level = {
		name: 'Selected Levels',
		type: 'boolean',
		description: 'Active on selected levels',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.purple,
		},
		options: [{ ...feedbackOptions.levels, choices: this.levels }],
		callback: (feedback) => {
			const l = feedback.options.level.length
			const k = this.selected_level.length

			for (let i = 0; i < l; i++) {
				const feedback_test = feedback.options.level[i]
				for (let j = 0; j < k; j++) {
					if (this.selected_level[j].id === feedback_test) {
						if (this.selected_level[j].enabled === true) {
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
		description: 'Active on selected levels and destination',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.purple,
		},
		options: [{ ...feedbackOptions.levels, choices: this.levels }, feedbackOptions.destination],
		callback: (feedback) => {
			if (this.selected_dest === feedback.options.dest) {
				const l = feedback.options.level.length
				const k = this.selected_level.length

				for (let i = 0; i < l; i++) {
					const feedback_test = feedback.options.level[i]
					for (let j = 0; j < k; j++) {
						if (this.selected_level[j].id === feedback_test) {
							if (this.selected_level[j].enabled === true) {
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
		description: 'Active on selected destination',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.green,
		},
		options: [feedbackOptions.destination],
		callback: (feedback) => {
			if (this.selected_dest === feedback.options.dest) {
				return true
			}
			return false
		},
	}

	feedbackDefinitions.selected_source = {
		type: 'boolean',
		name: 'Selected Source',
		description: 'Active on selected source',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.cyan,
		},
		options: [feedbackOptions.source],
		callback: (feedback) => {
			if (this.selected_source === feedback.options.source) {
				return true
			}
			return false
		},
	}

	feedbackDefinitions.source_dest_route = {
		type: 'boolean',
		name: 'Source Routed to Destination',
		description: 'Active when this source is routed to selected destination on any level',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [feedbackOptions.source],
		callback: (feedback) => {
			// look for this dest in route table
			console.log(`dest:source feedback ${this.selected_dest}:${feedback.options.source}`)
			return this.hasSourceInAnyLevelRoutemap(this.selected_dest, feedback.options.source)
		},
		subscribe: () => {
			if (!this.config.tally_dump_and_update) {
				this.getCrosspoints(this.selected_dest)
			}
		},
	}

	feedbackDefinitions.crosspoint_connected = {
		type: 'boolean',
		name: 'Crosspoint Connected',
		description: 'Active when this crosspoint is connected on any level',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [feedbackOptions.destination, feedbackOptions.source],
		callback: (feedback) => {
			// look for this dest in route table
			console.log(`dest:source feedback ${feedback.options.dest}:${feedback.options.source}`)
			return this.hasSourceInAnyLevelRoutemap(feedback.options.dest, feedback.options.source)
		},
		subscribe: (feedback) => {
			if (!this.config.tally_dump_and_update) {
				this.getCrosspoints(feedback.options.dest)
			}
		},
	}

	feedbackDefinitions.crosspoint_connected_by_level = {
		type: 'boolean',
		name: 'Crosspoint Connected on specific level',
		description: 'Active when this crosspoint is connected on any level',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [{ ...feedbackOptions.levels, choices: this.levels }, feedbackOptions.destination, feedbackOptions.source],
		callback: (feedback) => {
			// look for this dest in route table
			console.log(
				`dest:source feedback ${JSON.stringify(feedback.options.level)}:${feedback.options.dest}:${feedback.options.source}`,
			)
			if (feedback.options.level?.length !== 0) {
				let count = 0
				for (const level of feedback.options.level) {
					if (this.hasSourceInRoutemap(level, feedback.options.dest, feedback.options.source)) {
						count++
					}
				}
				if (count === feedback.options.level.length) {
					return true
				}
			}
			return false
		},
		subscribe: (feedback) => {
			if (!this.config.tally_dump_and_update) {
				this.getCrosspoints(feedback.options.dest)
			}
		},
	}

	feedbackDefinitions.crosspoint_connected_by_name = {
		type: 'boolean',
		name: 'Crosspoint Connected By Name',
		description: 'Active when this crosspoint is connected on any level',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [
			{
				...feedbackOptions.sourceName,
				choices: Array.from(this.source_names.values()),
			},
			{
				...feedbackOptions.destinationName,
				choices: Array.from(this.dest_names.values()),
			},
		],
		callback: async (feedback, context) => {
			const source = Number.parseInt(await context.parseVariablesInString(feedback.options.source))
			const dest = Number.parseInt(await context.parseVariablesInString(feedback.options.dest))
			// look for this dest in route table
			if (Number.isNaN(source) || source < 1 || source > 65536 || Number.isNaN(dest) || dest < 1 || dest > 65536) {
				this.log(
					'warn',
					`crosspoint_connected_by_name has been passed an out of range variable - src ${source} : dst ${dest}`,
				)
				return undefined
			}
			console.log(`dest:source feedback ${feedback.options.dest}:${feedback.options.source} (${dest}:${source})`)
			return this.hasSourceInAnyLevelRoutemap(dest, source)
		},
		subscribe: async (feedback, context) => {
			if (this.config.tally_dump_and_update) {
				return
			}
			const dest = Number.parseInt(await context.parseVariablesInString(feedback.options.dest))
			if (Number.isNaN(dest) || dest < 1 || dest > 65536) {
				this.log(
					'warn',
					`crosspoint_connected_by_name:Subscribe has been passed an out of range variable - dst ${dest}`,
				)
				return undefined
			}
			this.getCrosspoints(dest)
		},
	}

	this.setFeedbackDefinitions(feedbackDefinitions)
}
