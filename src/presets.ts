import { CompanionPresetDefinition } from '@companion-module/base'
import { colours, presetDefaults } from './consts.js'
import { SW_P_08 } from './index.js'
import { ActionIds } from './actions.js'
import { FeedbackIds } from './feedbacks.js'

export async function UpdatePresets(self: SW_P_08): Promise<void> {
	const presets: Record<string, CompanionPresetDefinition> = {}

	presets.take = {
		category: 'Actions',
		type: 'button',
		name: 'Take',
		style: {
			...presetDefaults.style,
			text: 'Take',
			bgcolor: colours.red,
		},
		steps: [
			{
				down: [
					{
						actionId: ActionIds.Take,
						delay: 0,
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets.refresh = {
		category: 'Actions',
		type: 'button',
		name: 'Refresh Names',
		style: {
			...presetDefaults.style,
			text: 'Refresh Names',
		},
		steps: [
			{
				down: [
					{
						actionId: ActionIds.GetNames,
						delay: 0,
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	const srcLength =
		self.source_names.size > presetDefaults.sourceCount ? presetDefaults.sourceCount : self.source_names.size
	for (let i = 1; i <= srcLength; i++) {
		presets[`source_number_${i}`] = {
			category: 'Sources (by number)',
			type: 'button',
			name: `Source ${i}`,
			style: {
				...presetDefaults.style,
				text: `S${i}`,
			},
			steps: [
				{
					down: [
						{
							actionId: ActionIds.SelectSource,
							options: {
								source: i,
							},
							delay: 0,
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: FeedbackIds.SelectedSource,
					options: {
						source: i,
					},
					style: {
						color: colours.black,
						bgcolor: colours.cyan,
					},
					isInverted: false,
				},
				{
					feedbackId: FeedbackIds.SourceDestRoute,
					options: {
						source: i,
					},
					style: {
						color: colours.black,
						bgcolor: colours.red,
					},
					isInverted: false,
				},
			],
		}

		presets[`source_name_${i}`] = {
			category: 'Sources (by name)',
			type: 'button',
			name: `$(generic-module:Source_${i})`,
			style: {
				...presetDefaults.style,
				text: `$(generic-module:Source_${i})`,
			},
			steps: [
				{
					down: [
						{
							actionId: ActionIds.SelectSource,
							options: {
								source: i,
							},
							delay: 0,
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: FeedbackIds.SelectedSource,
					options: {
						source: i,
					},
					style: {
						color: colours.black,
						bgcolor: colours.cyan,
					},
					isInverted: false,
				},
				{
					feedbackId: FeedbackIds.SourceDestRoute,
					options: {
						source: i,
					},
					style: {
						color: colours.black,
						bgcolor: colours.red,
					},
					isInverted: false,
				},
			],
		}
	}
	const destLength = self.dest_names.size > presetDefaults.destCount ? presetDefaults.destCount : self.dest_names.size
	for (let i = 1; i <= destLength; i++) {
		presets[`destination_number_${i}`] = {
			category: 'Destinations (by number)',
			type: 'button',
			name: `Destination ${i}`,
			style: {
				...presetDefaults.style,
				text: `D${i}`,
			},
			steps: [
				{
					down: [
						{
							actionId: ActionIds.SelectDest,
							options: {
								dest: i,
							},
							delay: 0,
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: FeedbackIds.SelectedDest,
					options: {
						dest: i,
					},
					style: {
						color: colours.black,
						bgcolor: colours.green,
					},
					isInverted: false,
				},
			],
		}

		presets[`destination_name_${i}`] = {
			category: 'Destinations (by name)',
			type: 'button',
			name: `$(generic-module:Destination_${i})`,
			style: {
				...presetDefaults.style,
				text: `$(generic-module:Destination_${i})`,
			},
			steps: [
				{
					down: [
						{
							actionId: ActionIds.SelectDest,
							options: {
								dest: i,
							},
							delay: 0,
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: FeedbackIds.SelectedDest,
					options: {
						dest: i,
					},
					style: {
						color: colours.black,
						bgcolor: colours.green,
					},
					isInverted: false,
				},
			],
		}
	}

	self.setPresetDefinitions(presets)
}
