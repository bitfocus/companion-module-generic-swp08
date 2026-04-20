import { CompanionFeedbackDefinition } from '@companion-module/base'
import { colours, feedbackOptions } from './consts.js'
import { SW_P_08 } from './index.js'

export enum FeedbackIds {
	SelectedLevel = 'selected_level',
	SelectedLevelDest = 'selected_level_dest',
	SelectedDest = 'selected_dest',
	SelectedSource = 'selected_source',
	SourceDestRoute = 'source_dest_route',
	CrosspointConnected = 'crosspoint_connected',
	CrosspointConnectedByLevel = 'crosspoint_connected_by_level',
	CrosspointConnectedByName = 'crosspoint_connected_by_name',
}

export async function UpdateFeedbacks(self: SW_P_08): Promise<void> {
	const feedbackDefinitions: Partial<Record<FeedbackIds, CompanionFeedbackDefinition>> = {}

	feedbackDefinitions[FeedbackIds.SelectedLevel] = {
		name: 'Selected Levels',
		type: 'boolean',
		description: 'Active on selected levels',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.purple,
		},
		options: [{ ...feedbackOptions.levels, choices: self.levels }],
		callback: (feedback) => {
			const l = (feedback.options.level as number[]).length
			const k = self.selected_level.length

			for (let i = 0; i < l; i++) {
				const feedback_test = (feedback.options.level as number[])[i]
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

	feedbackDefinitions[FeedbackIds.SelectedLevelDest] = {
		name: 'Selected Levels and Destination',
		type: 'boolean',
		description: 'Active on selected levels and destination',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.purple,
		},
		options: [{ ...feedbackOptions.levels, choices: self.levels }, feedbackOptions.destination],
		callback: (feedback) => {
			if (self.selected_dest === feedback.options.dest) {
				const l = (feedback.options.level as number[]).length
				const k = self.selected_level.length

				for (let i = 0; i < l; i++) {
					const feedback_test = (feedback.options.level as number[])[i]
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

	feedbackDefinitions[FeedbackIds.SelectedDest] = {
		type: 'boolean',
		name: 'Selected Destination',
		description: 'Active on selected destination',
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

	feedbackDefinitions[FeedbackIds.SelectedSource] = {
		type: 'boolean',
		name: 'Selected Source',
		description: 'Active on selected source',
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

	feedbackDefinitions[FeedbackIds.SourceDestRoute] = {
		type: 'boolean',
		name: 'Source Routed to Destination',
		description: 'Active when self source is routed to selected destination on any level',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [feedbackOptions.source],
		callback: (feedback) => {
			// look for self dest in route table
			console.log(`dest:source feedback ${self.selected_dest}:${feedback.options.source}`)
			return self.hasSourceInAnyLevelRoutemap(self.selected_dest, feedback.options.source as number)
		},
		subscribe: async () => {
			if (!self.config.tally_dump_and_update) {
				await self.getCrosspoints(self.selected_dest)
			}
		},
	}

	feedbackDefinitions[FeedbackIds.CrosspointConnected] = {
		type: 'boolean',
		name: 'Crosspoint Connected',
		description: 'Active when self crosspoint is connected on any level',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [feedbackOptions.destination, feedbackOptions.source],
		callback: (feedback) => {
			// look for self dest in route table
			console.log(`dest:source feedback ${feedback.options.dest}:${feedback.options.source}`)
			return self.hasSourceInAnyLevelRoutemap(feedback.options.dest as number, feedback.options.source as number)
		},
		subscribe: async (feedback) => {
			if (!self.config.tally_dump_and_update) {
				await self.getCrosspoints(feedback.options.dest as number)
			}
		},
	}

	feedbackDefinitions[FeedbackIds.CrosspointConnectedByLevel] = {
		type: 'boolean',
		name: 'Crosspoint Connected on specific level',
		description: 'Active when self crosspoint is connected on any level',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [{ ...feedbackOptions.levels, choices: self.levels }, feedbackOptions.destination, feedbackOptions.source],
		callback: (feedback) => {
			// look for self dest in route table
			console.log(
				`dest:source feedback ${JSON.stringify(feedback.options.level)}:${feedback.options.dest}:${feedback.options.source}`,
			)
			if ((feedback.options.level as number[])?.length !== 0) {
				let count = 0
				for (const level of feedback.options.level as number[]) {
					if (self.hasSourceInRoutemap(level, feedback.options.dest as number, feedback.options.source as number)) {
						count++
					}
				}
				if (count === (feedback.options.level as number[]).length) {
					return true
				}
			}
			return false
		},
		subscribe: async (feedback) => {
			if (!self.config.tally_dump_and_update) {
				await self.getCrosspoints(feedback.options.dest as number)
			}
		},
	}

	feedbackDefinitions[FeedbackIds.CrosspointConnectedByName] = {
		type: 'boolean',
		name: 'Crosspoint Connected By Name',
		description: 'Active when self crosspoint is connected on any level',
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
			const source = Number.parseInt(await context.parseVariablesInString(feedback.options.source?.toString() ?? ''))
			const dest = Number.parseInt(await context.parseVariablesInString(feedback.options.dest?.toString() ?? ''))
			// look for self dest in route table
			if (Number.isNaN(source) || source < 1 || source > 65536 || Number.isNaN(dest) || dest < 1 || dest > 65536) {
				self.log(
					'warn',
					`crosspoint_connected_by_name has been passed an out of range variable - src ${source} : dst ${dest}`,
				)
				return false
			}
			console.log(`dest:source feedback ${feedback.options.dest}:${feedback.options.source} (${dest}:${source})`)
			return self.hasSourceInAnyLevelRoutemap(dest, source)
		},
		subscribe: async (feedback, context) => {
			if (self.config.tally_dump_and_update) {
				return
			}
			const dest = Number.parseInt(await context.parseVariablesInString(feedback.options.dest?.toString() ?? ''))
			if (Number.isNaN(dest) || dest < 1 || dest > 65536) {
				self.log(
					'warn',
					`crosspoint_connected_by_name:Subscribe has been passed an out of range variable - dst ${dest}`,
				)
				return undefined
			}
			await self.getCrosspoints(dest)
		},
	}

	self.setFeedbackDefinitions(feedbackDefinitions)
}
