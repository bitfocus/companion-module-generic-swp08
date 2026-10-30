import { type CompanionFeedbackDefinitions, createModuleLogger } from '@companion-module/base'
import { colours, feedbackOptions } from './consts.js'
import { checkSourceDestRange, getHighestKey } from './util.js'
import SW_P_08 from './index.js'

export enum FeedbackIds {
	SelectedLevel = 'selected_level',
	SelectedLevelDest = 'selected_level_dest',
	SelectedMatrix = 'selected_matrix',
	SelectedDest = 'selected_dest',
	SelectedSource = 'selected_source',
	SourceDestRoute = 'source_dest_route',
	CrosspointConnected = 'crosspoint_connected',
	CrosspointConnectedByLevel = 'crosspoint_connected_by_level',
	CrosspointConnectedByName = 'crosspoint_connected_by_name',
	DestinationSourceName = 'dest_source_name',
	CanTake = 'can_take',
}

export type FeedbackSchema = {
	[FeedbackIds.SelectedLevel]: {
		type: 'boolean'
		options: {
			level: number[]
		}
	}
	[FeedbackIds.SelectedLevelDest]: {
		type: 'boolean'
		options: {
			level: number[]
			dest: number
		}
	}
	[FeedbackIds.SelectedMatrix]: {
		type: 'boolean'
		options: {
			matrix: number
		}
	}
	[FeedbackIds.SelectedDest]: {
		type: 'boolean'
		options: {
			dest: number
		}
	}
	[FeedbackIds.SelectedSource]: {
		type: 'boolean'
		options: {
			source: number
		}
	}
	[FeedbackIds.SourceDestRoute]: {
		type: 'boolean'
		options: {
			/** optional: absent on feedbacks saved before multi-matrix support */
			matrix?: number
			source: number
		}
	}
	[FeedbackIds.CrosspointConnected]: {
		type: 'boolean'
		options: {
			/** optional: absent on feedbacks saved before multi-matrix support */
			matrix?: number
			dest: number
			source: number
		}
	}
	[FeedbackIds.CrosspointConnectedByLevel]: {
		type: 'boolean'
		options: {
			/** optional: absent on feedbacks saved before multi-matrix support */
			matrix?: number
			level: number[]
			dest: number
			source: number
		}
	}
	[FeedbackIds.CrosspointConnectedByName]: {
		type: 'boolean'
		options: {
			/** optional: absent on feedbacks saved before multi-matrix support */
			matrix?: number
			dest: number
			source: number
		}
	}
	[FeedbackIds.DestinationSourceName]: {
		type: 'value'
		options: {
			/** optional: absent on feedbacks saved before multi-matrix support */
			matrix?: number
			level: number
			dest: number
		}
	}
	[FeedbackIds.CanTake]: {
		type: 'boolean'
		options: Record<string, never>
	}
}

export function UpdateFeedbacks(self: SW_P_08): void {
	const feedbackDefinitions: Partial<CompanionFeedbackDefinitions<FeedbackSchema>> = {}
	const logger = createModuleLogger('SWP08_Feedbacks')
	const mergedSourceNames = self.mergedNames('source')
	const mergedDestNames = self.mergedNames('dest')
	const destMax = getHighestKey(mergedDestNames) || 0xffff
	const sourceMax = getHighestKey(mergedSourceNames) || 0xffff
	const matrixOption = { ...feedbackOptions.matrix, choices: self.matrixChoices, default: self.primaryMatrix }

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

	feedbackDefinitions[FeedbackIds.SelectedMatrix] = {
		type: 'boolean',
		name: 'Selected Matrix',
		description: 'Active on the selected matrix',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.purple,
		},
		options: [matrixOption],
		callback: (feedback) => {
			return self.selected_matrix === self.resolveMatrixOption(feedback.options.matrix)
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
		options: [{ ...feedbackOptions.destination, max: destMax }],
		callback: (feedback) => {
			return self.selected_dest === feedback.options.dest
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
		options: [{ ...feedbackOptions.source, max: sourceMax }],
		callback: (feedback) => {
			return self.selected_source === feedback.options.source
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
		options: [matrixOption, { ...feedbackOptions.source, max: sourceMax }],
		callback: (feedback) => {
			const matrix = self.resolveMatrixOption(feedback.options.matrix)
			// look for self dest in route table
			logger.debug(`dest:source feedback ${matrix}/${self.selected_dest}:${feedback.options.source}`)
			if (
				self.selected_dest !== 0 &&
				!self.config.tally_dump_and_update &&
				!self.hasDestInRoutemap(matrix, self.selected_dest)
			) {
				void self.getCrosspoints(self.selected_dest, undefined, matrix)
			}
			return self.hasSourceInAnyLevelRoutemap(matrix, self.selected_dest, feedback.options.source)
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
		options: [
			matrixOption,
			{ ...feedbackOptions.destination, max: destMax },
			{ ...feedbackOptions.source, max: sourceMax },
		],
		callback: (feedback) => {
			const matrix = self.resolveMatrixOption(feedback.options.matrix)
			// look for self dest in route table
			logger.debug(`dest:source feedback ${matrix}/${feedback.options.dest}:${feedback.options.source}`)
			if (!self.config.tally_dump_and_update && !self.hasDestInRoutemap(matrix, feedback.options.dest)) {
				void self.getCrosspoints(feedback.options.dest, undefined, matrix)
			}
			return self.hasSourceInAnyLevelRoutemap(matrix, feedback.options.dest, feedback.options.source)
		},
	}

	feedbackDefinitions[FeedbackIds.CrosspointConnectedByLevel] = {
		type: 'boolean',
		name: 'Crosspoint Connected on specific level',
		description: 'Active when self crosspoint is connected on specific levels',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.orange,
		},
		options: [
			matrixOption,
			{ ...feedbackOptions.levels, choices: self.levels },
			{ ...feedbackOptions.destination, max: destMax },
			{ ...feedbackOptions.source, max: sourceMax },
		],
		callback: (feedback) => {
			const matrix = self.resolveMatrixOption(feedback.options.matrix)
			// look for self dest in route table
			logger.debug(
				`dest:source feedback ${matrix}/${JSON.stringify(feedback.options.level)}:${feedback.options.dest}:${feedback.options.source}`,
			)
			if (!self.config.tally_dump_and_update && !self.hasDestInRoutemap(matrix, feedback.options.dest)) {
				void self.getCrosspoints(feedback.options.dest, undefined, matrix)
			}
			if (feedback.options.level.length !== 0) {
				let count = 0
				for (const level of feedback.options.level) {
					if (self.hasSourceInRoutemap(matrix, level, feedback.options.dest, feedback.options.source)) {
						count++
					}
				}
				return count === feedback.options.level.length
			}
			return false
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
			matrixOption,
			{
				...feedbackOptions.sourceName,
				choices: Array.from(mergedSourceNames.values()),
			},
			{
				...feedbackOptions.destinationName,
				choices: Array.from(mergedDestNames.values()),
			},
		],
		callback: async (feedback, _context) => {
			const source = Math.round(feedback.options.source)
			const dest = Math.round(feedback.options.dest)
			const matrix = self.resolveMatrixOption(feedback.options.matrix)
			checkSourceDestRange(source, FeedbackIds.CrosspointConnectedByName, sourceMax)
			checkSourceDestRange(dest, FeedbackIds.CrosspointConnectedByName, destMax)
			if (!self.config.tally_dump_and_update && !self.hasDestInRoutemap(matrix, dest)) {
				void self.getCrosspoints(dest, undefined, matrix)
			}
			// look for self dest in route table
			logger.debug(
				`dest:source feedback ${matrix}/${feedback.options.dest}:${feedback.options.source} (${dest}:${source})`,
			)
			return self.hasSourceInAnyLevelRoutemap(matrix, dest, source)
		},
	}

	feedbackDefinitions[FeedbackIds.DestinationSourceName] = {
		type: 'value',
		name: 'Destination Source Name',
		description: 'Return name of source routed to selected destination',
		options: [
			matrixOption,
			{ ...feedbackOptions.level, choices: self.levels },
			{
				...feedbackOptions.destinationName,
				choices: Array.from(mergedDestNames.values()),
			},
		],
		callback: async (feedback, _context) => {
			const level = Math.round(feedback.options.level)
			const dest = Math.round(feedback.options.dest)
			const matrix = self.resolveMatrixOption(feedback.options.matrix)
			checkSourceDestRange(
				level,
				FeedbackIds.DestinationSourceName,
				self.config.extended_support ? self.config.max_levels_ext : self.config.max_levels,
			)
			checkSourceDestRange(dest, FeedbackIds.CrosspointConnectedByName, destMax)
			if (!self.config.tally_dump_and_update && !self.hasDestInRoutemap(matrix, dest)) {
				void self.getCrosspoints(dest, undefined, matrix)
			}
			// look for self dest in route table
			logger.debug(
				`${FeedbackIds.DestinationSourceName} feedback ${matrix}/${feedback.options.dest}:${feedback.options.level}`,
			)
			const source = self.getSourceInRoutemap(matrix, level, dest)
			return source === undefined ? '' : (self.sourceNamesForMatrix(matrix).get(source - 1)?.label ?? '')
		},
	}

	feedbackDefinitions[FeedbackIds.CanTake] = {
		type: 'boolean',
		name: 'Can Take',
		description: 'True when a take is possible',
		defaultStyle: {
			color: colours.black,
			bgcolor: colours.red,
		},
		options: [],
		callback: (_feedback) => {
			return self.selected_source !== 0 && self.selected_dest !== 0 && self.selected_level.length > 0
		},
	}

	self.setFeedbackDefinitions(feedbackDefinitions as CompanionFeedbackDefinitions<FeedbackSchema>)
}
