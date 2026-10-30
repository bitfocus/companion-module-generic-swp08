import {
	CompanionPresetDefinitions,
	CompanionPresetGroup,
	CompanionPresetSection,
	DropdownChoice,
} from '@companion-module/base'
import { colours, presetDefaults } from './consts.js'
import SW_P_08 from './index.js'
import { ActionIds } from './actions.js'
import { FeedbackIds } from './feedbacks.js'
import type { SWP08Types } from './types.js'
import { isUnusedPortName, mapNamesToTemplateValues } from './util.js'

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

	if (self.config.crosspoint_presets) {
		addCrosspointPresets(self, structure, presets)
	}

	self.setPresetDefinitions(structure, presets)
}

/** Help shown above each Crosspoints preset section. */
const crosspointSectionDescription =
	'One button per source for each destination. show_dest_name = 0 hides the destination name, and bg_color ' +
	'(e.g. #204080) sets the background. Set them on a button, or as page variables with the same names for every ' +
	'crosspoint button on the page; a button value wins over a page value.'

/**
 * Expression giving a button's local variable when it is set, else the page
 * variable of the same name, always as a string. The result is empty or `$NA`
 * when neither is set, and the caller then applies its default.
 *
 * The page reference is assembled at runtime with `parseVariables()`: when
 * Companion 5.1 creates a button from a preset it rewrites a literal
 * `$(page:...)` to `$(<connection label>:...)`, which breaks the lookup.
 *
 * @param name Variable name, used for both the local and the page variable
 */
export function buttonOrPageExpression(name: string): string {
	const local = `concat($(local:${name}))`
	const page = `parseVariables(concat('$', '(page:${name})'))`
	return `(${local} == '' || ${local} == '$NA' ? ${page} : ${local})`
}

/**
 * Button text expression for a crosspoint preset: the source name, then the
 * destination name unless `show_dest_name` is `0` or `false` on the button or
 * its page. The name references sit inside `parseVariables()` because they
 * are looked up by the button's own `source` / `dest` local variables.
 *
 * @param sourceVar Variable reference for the source name
 * @param destVar Variable reference for the destination name
 */
export function crosspointTextExpression(sourceVar: string, destVar: string): string {
	const showDest = buttonOrPageExpression('show_dest_name')
	const hide = `${showDest} == '0' || ${showDest} == 'false'`
	return `${hide} ? parseVariables('${sourceVar}') : parseVariables('${sourceVar}\\n>\\n${destVar}')`
}

/**
 * Add a "Crosspoints" section per configured matrix and level, holding one
 * group per destination with a button for every source. The lists follow the
 * source / destination names read from the router (skipping unused
 * ports, see the `unused_port_names` config field), like the Sources and
 * Destinations sections. Each matrix gets one template preset; the groups set
 * level and destination through `commonVariableValues`, and expand over source.
 */
function addCrosspointPresets(
	self: SW_P_08,
	structure: CompanionPresetSection[],
	presets: CompanionPresetDefinitions<SWP08Types>,
): void {
	for (const m of self.matrices) {
		const isPrimary = m.id === self.primaryMatrix
		const sourcePrefix = isPrimary ? 'Source_' : `Source_Matrix_${m.id}_`
		const destPrefix = isPrimary ? 'Destination_' : `Destination_Matrix_${m.id}_`
		const isUsed = (name: DropdownChoice): boolean => !isUnusedPortName(name.label, self.config.unused_port_names)
		const sourceNames = Array.from(self.sourceNamesForMatrix(m.id).values()).filter(isUsed)
		const destNames = Array.from(self.destNamesForMatrix(m.id).values()).filter(isUsed)
		if (sourceNames.length === 0 || destNames.length === 0) continue

		const presetId = `crosspoint_matrix_${m.id}_template`
		presets[presetId] = {
			type: 'simple',
			name: `Crosspoint (${m.label})`,
			style: {
				...presetDefaults.style,
				text: crosspointTextExpression(
					`$(${self.label}:${sourcePrefix}$(local:source))`,
					`$(${self.label}:${destPrefix}$(local:dest))`,
				),
				textExpression: true,
			},
			localVariables: [
				{ variableType: 'simple', variableName: 'matrix', startupValue: m.id, headline: 'Matrix number' },
				{ variableType: 'simple', variableName: 'level', startupValue: 1, headline: 'Level number' },
				{ variableType: 'simple', variableName: 'source', startupValue: 1, headline: 'Source number' },
				{ variableType: 'simple', variableName: 'dest', startupValue: 1, headline: 'Destination number' },
				{
					variableType: 'simple',
					variableName: 'show_dest_name',
					startupValue: '',
					headline: 'Destination name: 0 = hide, 1 = show, empty = use the page variable show_dest_name, else show',
				},
				{
					variableType: 'simple',
					variableName: 'bg_color',
					startupValue: '',
					headline:
						'Background colour, e.g. #204080, #f00 or rgb(32, 64, 128); empty = use the page variable bg_color, else black',
				},
			],
			steps: [
				{
					down: [
						{
							actionId: ActionIds.SetCrosspoint,
							delay: 0,
							options: {
								matrix: { isExpression: true, value: '$(local:matrix)' },
								level: { isExpression: true, value: '[$(local:level)]' },
								source: { isExpression: true, value: '$(local:source)' },
								dest: { isExpression: true, value: '$(local:dest)' },
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					// before the route feedback, so the active colour wins
					feedbackId: FeedbackIds.BackgroundColour,
					options: {
						colour: { isExpression: true, value: buttonOrPageExpression('bg_color') },
					},
				},
				{
					feedbackId: FeedbackIds.CrosspointConnectedByLevel,
					options: {
						matrix: { isExpression: true, value: '$(local:matrix)' },
						level: { isExpression: true, value: '[$(local:level)]' },
						source: { isExpression: true, value: '$(local:source)' },
						dest: { isExpression: true, value: '$(local:dest)' },
					},
					style: {
						color: colours.black,
						bgcolor: colours.orange,
					},
					isInverted: false,
				},
			],
		}

		for (const level of self.levels) {
			const sectionName =
				self.matrices.length > 1 ? `Crosspoints ${m.label} Level ${level.id}` : `Crosspoints Level ${level.id}`
			structure.push({
				id: `crosspoints_matrix_${m.id}_level_${level.id}`,
				name: sectionName,
				description: crosspointSectionDescription,
				definitions: destNames.map((dest): CompanionPresetGroup<SWP08Types> => ({
					id: `crosspoints_matrix_${m.id}_level_${level.id}_dest_${dest.id}`,
					name: `To ${dest.label}`,
					type: 'template',
					presetId,
					templateVariableName: 'source',
					templateValues: sourceNames.map((source) => ({
						name: `${source.label} > ${dest.label}`,
						value: source.id,
					})),
					commonVariableValues: { matrix: m.id, level: level.id, dest: dest.id, show_dest_name: '', bg_color: '' },
				})),
			})
		}
	}
}
