import { colours, presetDefaults } from './consts.js'

export async function UpdatePresets(self) {
	let presets = []

	presets['take'] = {
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

	presets['refresh'] = {
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

	for (let i = 1; i <= 32; i++) {
		presets[`source_number_${i}`] = {
			category: 'Sources (by number)',
			type: 'button',
			name: 'Source ' + i,
			style: {
				...presetDefaults.style,
				text: 'S' + i,
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
			],
		}

		presets[`destination_number_${i}`] = {
			category: 'Destinations (by number)',
			type: 'button',
			name: 'Destination ' + i,
			style: {
				...presetDefaults.style,
				text: 'D' + i,
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
