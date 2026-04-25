import { type CompanionActionDefinitions, createModuleLogger } from '@companion-module/base'
import { actionOptions } from './consts.js'
import type SW_P_08 from './index.js'
import { FeedbackIds } from './feedbacks.js'
import { checkSourceDestRange, getHighestKey } from './util.js'

export enum ActionIds {
	SelectLevel = 'select_level',
	DeselectLevel = 'deselect_level',
	ToggleLevel = 'toggle_level',
	SelectDest = 'select_dest',
	SelectDestName = 'select_dest_name',
	SelectSource = 'select_source',
	SelectSourceName = 'select_source_name',
	RouteSource = 'route_source',
	RouteSourceName = 'route_source_name',
	Take = 'take',
	Clear = 'clear',
	SetCrosspoint = 'set_crosspoint',
	SetCrosspointName = 'set_crosspoint_name',
	GetNames = 'get_names',
}

export type ActionSchema = {
	[ActionIds.SelectLevel]: {
		options: {
			level: number[]
		}
	}
	[ActionIds.DeselectLevel]: {
		options: {
			level: number[]
		}
	}
	[ActionIds.ToggleLevel]: {
		options: {
			level: number[]
		}
	}
	[ActionIds.SelectDest]: {
		options: {
			dest: number
		}
	}
	[ActionIds.SelectDestName]: {
		options: {
			dest: number
		}
	}
	[ActionIds.SelectSource]: {
		options: {
			source: number
		}
	}
	[ActionIds.SelectSourceName]: {
		options: {
			source: number
		}
	}
	[ActionIds.RouteSource]: {
		options: {
			source: number
		}
	}
	[ActionIds.RouteSourceName]: {
		options: {
			source: number
		}
	}
	[ActionIds.Take]: {
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		options: {}
	}
	[ActionIds.Clear]: {
		options: {
			clear: 'all' | 'level' | 'dest' | 'source'
			clear_enable_levels: boolean
		}
	}
	[ActionIds.SetCrosspoint]: {
		options: {
			level: number[]
			source: number
			dest: number
		}
	}
	[ActionIds.SetCrosspointName]: {
		options: {
			level: number[]
			source: number
			dest: number
		}
	}
	[ActionIds.GetNames]: {
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		options: {}
	}
}

export function UpdateActions(self: SW_P_08): void {
	const actionDefinitions: Partial<CompanionActionDefinitions<ActionSchema>> = {}
	const logger = createModuleLogger('SWP08_Actions')
	const destMax = getHighestKey(self.dest_names) ?? 0xffff
	const sourceMax = getHighestKey(self.source_names) ?? 0xffff
	actionDefinitions[ActionIds.SelectLevel] = {
		name: 'Select Levels',
		options: [{ ...actionOptions.levels, choices: self.levels }],
		callback: ({ options }) => {
			self.processLevelsSelection(options.level, true)
		},
	}

	actionDefinitions[ActionIds.DeselectLevel] = {
		name: 'De-Select Levels',
		options: [{ ...actionOptions.levels, choices: self.levels }],
		callback: ({ options }) => {
			self.processLevelsSelection(options.level, false)
		},
	}

	actionDefinitions[ActionIds.ToggleLevel] = {
		name: 'Toggle Levels',
		options: [{ ...actionOptions.levels, choices: self.levels }],
		callback: ({ options }) => {
			self.processLevelsSelection(options.level, 'toggle')
		},
	}

	actionDefinitions[ActionIds.SelectDest] = {
		name: 'Select Destination',
		options: [{ ...actionOptions.destination, max: destMax }],
		optionsToMonitorForSubscribe: ['dest'],
		callback: async ({ options }) => {
			self.selected_dest = Math.round(options.dest)
			logger.info(`set destination ${self.selected_dest}`)
			self.setVariableValuesCached({ Destination: self.selected_dest })
			self.feedbacksToCheck.add(FeedbackIds.SelectedDest)
			self.feedbacksToCheck.add(FeedbackIds.SelectedLevelDest)
			self.feedbacksToCheck.add(FeedbackIds.SourceDestRoute)
			self.feedbacksToCheck.add(FeedbackIds.CanTake)
			self.throttledFeedbackCheck()
			if (!self.config.tally_dump_and_update) {
				await self.getCrosspoints(self.selected_dest)
			}
		},
		subscribe: async ({ options }) => {
			if (!self.config.tally_dump_and_update) {
				await self.getCrosspoints(Math.round(options.dest))
			}
		},
	}

	actionDefinitions[ActionIds.SelectDestName] = {
		name: 'Select Destination name',
		options: [{ ...actionOptions.destinationName, choices: Array.from(self.dest_names.values()) }],
		optionsToMonitorForSubscribe: ['dest'],
		callback: async ({ options }, _context) => {
			const dest = Math.round(options.dest)
			checkSourceDestRange(dest, ActionIds.SelectDestName, destMax)
			self.selected_dest = dest
			logger.info(`set destination ${self.selected_dest}`)
			self.setVariableValuesCached({ Destination: self.selected_dest })
			self.feedbacksToCheck.add(FeedbackIds.SelectedDest)
			self.feedbacksToCheck.add(FeedbackIds.SelectedLevelDest)
			self.feedbacksToCheck.add(FeedbackIds.SourceDestRoute)
			self.feedbacksToCheck.add(FeedbackIds.CanTake)
			self.throttledFeedbackCheck()
			if (!self.config.tally_dump_and_update) {
				await self.getCrosspoints(dest)
			}
		},
		subscribe: async (action, _context) => {
			if (!self.config.tally_dump_and_update) {
				const dest = Math.round(action.options.dest)
				checkSourceDestRange(dest, `${ActionIds.SelectDestName}: subscribe`, destMax)
				await self.getCrosspoints(dest)
			}
		},
	}

	actionDefinitions[ActionIds.SelectSource] = {
		name: 'Select Source',
		options: [{ ...actionOptions.source, max: sourceMax }],
		callback: ({ options }) => {
			self.selected_source = Math.round(options.source)
			logger.info(`set source ${self.selected_source}`)
			self.setVariableValuesCached({ Source: self.selected_source })
			self.feedbacksToCheck.add(FeedbackIds.SelectedSource)
			self.feedbacksToCheck.add(FeedbackIds.CanTake)
			self.throttledFeedbackCheck()
		},
	}

	actionDefinitions[ActionIds.SelectSourceName] = {
		name: 'Select Source name',
		options: [{ ...actionOptions.sourceName, choices: Array.from(self.source_names.values()) }],
		callback: async ({ options }, _context) => {
			const source = Math.round(options.source)
			checkSourceDestRange(source, ActionIds.SelectSourceName, sourceMax)
			self.selected_source = source
			logger.info(`set source ${self.selected_source}`)
			self.setVariableValuesCached({ Source: self.selected_source })
			self.feedbacksToCheck.add(FeedbackIds.SelectedSource)
			self.feedbacksToCheck.add(FeedbackIds.CanTake)
			self.throttledFeedbackCheck()
		},
	}

	actionDefinitions[ActionIds.RouteSource] = {
		name: 'Route Source to selected Levels and Destination',
		options: [{ ...actionOptions.source, max: sourceMax }],
		callback: async ({ options }) => {
			logger.debug(`Selected Levels: ${JSON.stringify(self.selected_level)}`)
			const l = self.selected_level.length
			for (let i = 0; i < l; i++) {
				if (self.selected_level[i].enabled === true) {
					await self.SetCrosspoint(Math.round(options.source), self.selected_dest, self.selected_level[i].id)
				}
			}
		},
	}

	actionDefinitions[ActionIds.RouteSourceName] = {
		name: 'Route Source name to selected Levels and Destination',
		options: [{ ...actionOptions.sourceName, choices: Array.from(self.source_names.values()) }],
		callback: async ({ options }, _context) => {
			const source = Math.round(options.source)
			checkSourceDestRange(source, ActionIds.RouteSourceName, sourceMax)
			logger.debug(`Selected levels: ${JSON.stringify(self.selected_level)}`)
			const l = self.selected_level.length
			for (let i = 0; i < l; i++) {
				if (self.selected_level[i].enabled === true) {
					await self.SetCrosspoint(source, self.selected_dest, self.selected_level[i].id)
				}
			}
		},
	}

	actionDefinitions[ActionIds.Take] = {
		name: 'Take',
		options: [],
		callback: async () => {
			logger.debug(`Selected levels: ${JSON.stringify(self.selected_level)}`)
			const l = self.selected_level.length
			for (let i = 0; i < l; i++) {
				if (self.selected_level[i].enabled === true) {
					await self.SetCrosspoint(self.selected_source, self.selected_dest, self.selected_level[i].id)
				}
			}
		},
	}

	actionDefinitions[ActionIds.Clear] = {
		name: 'Clear',
		options: [actionOptions.clear, actionOptions.clearEnableLevels],
		callback: ({ options }) => {
			if (options.clear === 'all' || options.clear === 'level') {
				self.selected_level = []
				for (let i = 1; i <= self.config.max_levels; i++) {
					self.selected_level.push({ id: i, enabled: options.clear_enable_levels })
				}
				self.feedbacksToCheck.add(FeedbackIds.SelectedLevel)
				self.feedbacksToCheck.add(FeedbackIds.SelectedLevelDest)
				self.feedbacksToCheck.add(FeedbackIds.SourceDestRoute)
				self.feedbacksToCheck.add(FeedbackIds.CanTake)
				self.throttledFeedbackCheck()
				logger.debug(`Clear Levels\nSelected levels: ${JSON.stringify(self.selected_level)}`)
			}

			if (options.clear === 'all' || options.clear === 'dest') {
				self.selected_dest = 0
				self.setVariableValuesCached({ Destination: self.selected_dest })
				self.feedbacksToCheck.add(FeedbackIds.SelectedLevel)
				self.feedbacksToCheck.add(FeedbackIds.SelectedLevelDest)
				self.feedbacksToCheck.add(FeedbackIds.SourceDestRoute)
				self.feedbacksToCheck.add(FeedbackIds.CanTake)
				self.throttledFeedbackCheck()
				logger.debug('clear dest')
			}

			if (options.clear === 'all' || options.clear === 'source') {
				self.selected_source = 0
				self.setVariableValuesCached({ Source: self.selected_source })
				self.feedbacksToCheck.add(FeedbackIds.SelectedSource)
				self.throttledFeedbackCheck()
			}
		},
	}

	actionDefinitions[ActionIds.SetCrosspoint] = {
		name: 'Set crosspoint',
		options: [{ ...actionOptions.levels, choices: self.levels }, actionOptions.source, actionOptions.destination],
		callback: async ({ options }) => {
			for (const level_val of options.level) {
				await self.SetCrosspoint(Math.round(options.source), Math.round(options.dest), level_val)
			}
		},
	}

	actionDefinitions[ActionIds.SetCrosspointName] = {
		name: 'Set crosspoint by name',
		options: [
			{ ...actionOptions.levels, choices: self.levels },
			{ ...actionOptions.sourceName, choices: Array.from(self.source_names.values()) },
			{ ...actionOptions.destinationName, choices: Array.from(self.dest_names.values()) },
		],
		callback: async ({ options }, _context) => {
			const source = Math.round(options.source)
			const dest = Math.round(options.dest)
			checkSourceDestRange(source, ActionIds.SetCrosspointName, sourceMax)
			checkSourceDestRange(dest, ActionIds.SetCrosspointName, destMax)
			for (const level_val of options.level) {
				await self.SetCrosspoint(source, dest, level_val)
			}
		},
	}

	actionDefinitions[ActionIds.GetNames] = {
		name: 'Refresh Source and Destination names',
		options: [],
		callback: async () => {
			await self.readNames()
		},
	}

	self.setActionDefinitions(actionDefinitions as CompanionActionDefinitions<ActionSchema>)
}
