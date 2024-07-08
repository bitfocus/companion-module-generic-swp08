import { colours, presetDefaults } from './consts.js'

export async function UpdatePresets(self) {
	let presets = []

	presets['take']={
		category: 'Actions',
		type: 'button',
		name: 'Take',
		style: {
			...presetDefaults.style,
			text: 'Take',
			bgcolor: colours.red,
		},
		steps: [{
			down:{
				action: 'take',
			},
        }],
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
				down: {
					action: 'get_names',
				},
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
					down: {
						action: 'select_source',
						options: {
							source: i,
						},
					},
				},
			],
			feedbacks: [
				{
					type: 'selected_source',
					options: {
						source: i,
					},
					style: {
						color: colours.black,
						bgcolor: colours.cyan,
					},
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
					down: {
						action: 'select_dest',
						options: {
							dest: i,
						},
					},
				},
			],
			feedbacks: [
				{
					type: 'selected_dest',
					options: {
						dest: i,
					},
					style: {
						color: colours.black,
						bgcolor: colours.green,
					},
				},
			],
		}
	}
	self.setPresetDefinitions(presets)
}
