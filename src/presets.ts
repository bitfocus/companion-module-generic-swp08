import { CompanionPresetDefinitions, CompanionPresetGroup, CompanionPresetSection } from '@companion-module/base'
import { colours, presetDefaults } from './consts.js'
import SW_P_08 from './index.js'
import { ActionIds } from './actions.js'
import { FeedbackIds } from './feedbacks.js'
import type { SWP08Types } from './types.js'
import { mapNamesToTemplateValues } from './util.js'

export function UpdatePresets(self: SW_P_08): void {
	const presets: CompanionPresetDefinitions<SWP08Types> = {}
	const sourceGroups: CompanionPresetGroup<SWP08Types>[] = []
	const destGroups: CompanionPresetGroup<SWP08Types>[] = []
	const structure: CompanionPresetSection[] = [
		{
			id: 'section1',
			name: 'Action',
			definitions: [
				{
					id: 'actions',
					name: 'Actions',
					description: '',
					type: 'simple',
					presets: ['take', 'refresh'],
				},
			],
		},
		{
			id: 'section2',
			name: 'Sources',
			definitions: sourceGroups,
		},
		{
			id: 'section3',
			name: 'Destinations',
			definitions: destGroups,
		},
	]

	presets.take = {
		type: 'simple',
		name: 'Take',
		style: {
			...presetDefaults.style,
			text: 'Take',
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
		feedbacks: [
			{
				feedbackId: FeedbackIds.CanTake,
				options: {},
				style: {
					color: colours.black,
					bgcolor: colours.red,
				},
				isInverted: false,
			},
		],
	}

	presets.refresh = {
		type: 'simple',
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
	presets[`source_number_template`] = {
		type: 'simple',
		name: `Source X`,
		style: {
			...presetDefaults.style,
			text: `S$(local:source)`,
		},
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: 1 }],
		steps: [
			{
				down: [
					{
						actionId: ActionIds.SelectSource,
						options: {
							source: { isExpression: true, value: '$(local:source)' },
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
					source: { isExpression: true, value: '$(local:source)' },
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
					source: { isExpression: true, value: '$(local:source)' },
				},
				style: {
					color: colours.black,
					bgcolor: colours.red,
				},
				isInverted: false,
			},
		],
	}
	presets[`source_name_template`] = {
		type: 'simple',
		name: `$(${self.label}:Source_$(local:source))`,
		style: {
			...presetDefaults.style,
			text: `$(${self.label}:Source_$(local:source))`,
		},
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: 1 }],
		steps: [
			{
				down: [
					{
						actionId: ActionIds.SelectSource,
						options: {
							source: { isExpression: true, value: '$(local:source)' },
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
					source: { isExpression: true, value: '$(local:source)' },
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
					source: { isExpression: true, value: '$(local:source)' },
				},
				style: {
					color: colours.black,
					bgcolor: colours.red,
				},
				isInverted: false,
			},
		],
	}

	presets[`destination_number_template`] = {
		type: 'simple',
		name: `Destination $(local:destination)`,
		style: {
			...presetDefaults.style,
			text: `D$(local:destination)`,
		},
		localVariables: [{ variableType: 'simple', variableName: 'destination', startupValue: 1 }],
		steps: [
			{
				down: [
					{
						actionId: ActionIds.SelectDest,
						options: {
							dest: { isExpression: true, value: '$(local:destination)' },
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
					dest: { isExpression: true, value: '$(local:destination)' },
				},
				style: {
					color: colours.black,
					bgcolor: colours.green,
				},
				isInverted: false,
			},
		],
	}

	presets[`destination_name_template`] = {
		type: 'simple',
		name: `$(${self.label}:Destination_$(local:destination))`,
		style: {
			...presetDefaults.style,
			text: `$(${self.label}:Destination_$(local:destination))`,
		},
		localVariables: [{ variableType: 'simple', variableName: 'destination', startupValue: 1 }],
		steps: [
			{
				down: [
					{
						actionId: ActionIds.SelectDest,
						options: {
							dest: { isExpression: true, value: '$(local:destination)' },
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
					dest: { isExpression: true, value: '$(local:destination)' },
				},
				style: {
					color: colours.black,
					bgcolor: colours.green,
				},
				isInverted: false,
			},
		],
	}

	sourceGroups.push({
		id: `select_source_number`,
		name: 'Select Source by Number',
		type: 'template',
		presetId: 'source_number_template',
		templateVariableName: 'source',
		templateValues: mapNamesToTemplateValues(self.source_names, 'Source'),
	})
	sourceGroups.push({
		id: `select_source_name`,
		name: 'Select Source by Name',
		type: 'template',
		presetId: 'source_name_template',
		templateVariableName: 'source',
		templateValues: mapNamesToTemplateValues(self.source_names, 'Source'),
	})

	destGroups.push({
		id: `select_destination_number`,
		name: 'Select Destination by Number',
		type: 'template',
		presetId: 'destination_number_template',
		templateVariableName: 'destination',
		templateValues: mapNamesToTemplateValues(self.dest_names, 'Destination'),
	})
	destGroups.push({
		id: `select_destination_name`,
		name: 'Select Destination by Name',
		type: 'template',
		presetId: 'destination_name_template',
		templateVariableName: 'destination',
		templateValues: mapNamesToTemplateValues(self.dest_names, 'Destination'),
	})

	self.setPresetDefinitions(structure, presets)
}
