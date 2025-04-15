import { colours, presetDefaults } from './consts.js'

export async function UpdatePresets(self) {
	const presets = []

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
						actionId: 'take',
						delay: 0,
					},
				],
			},
		],
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
						actionId: 'get_names',
						delay: 0,
					},
				],
			},
		],
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
							actionId: 'select_source',
							options: {
								source: i,
							},
							delay: 0,
						},
					],
				},
			],
			feedbacks: [
				{
					feedbackId: 'selected_source',
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
					feedbackId: 'source_dest_route',
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
							actionId: 'select_source',
							options: {
								source: i,
							},
							delay: 0,
						},
					],
				},
			],
			feedbacks: [
				{
					feedbackId: 'selected_source',
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
					feedbackId: 'source_dest_route',
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
	const destLength =
		self.dest_names.size > presetDefaults.destCount ? presetDefaults.destCount : self.dest_names.size
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
							actionId: 'select_dest',
							options: {
								dest: i,
							},
							delay: 0,
						},
					],
				},
			],
			feedbacks: [
				{
					feedbackId: 'selected_dest',
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
							actionId: 'select_dest',
							options: {
								dest: i,
							},
							delay: 0,
						},
					],
				},
			],
			feedbacks: [
				{
					feedbackId: 'selected_dest',
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
