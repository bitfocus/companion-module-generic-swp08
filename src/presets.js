import { colours } from './consts.js'

export async function UpdatePresets(self) {
	let presets = []

	presets.push({
		category: 'Actions',
		type: 'button',
		name: 'Take',
		style: {
			style: 'text',
			text: 'Take',
			size: '18',
			color: colours.white,
			bgcolor: colours.red,
		},
		steps: [{
			down:{
				action: 'take',
			},
        }],
	})

	presets.push({
		category: 'Actions',
		type: 'button',
		name: 'Refresh Names',
		style: {
			style: 'text',
			text: 'Refresh Names',
			size: '18',
			color: colours.white,
			bgcolor: colours.black,
		},
		actions: [
			{
				action: 'get_names',
			},
		],
	})

	for (let i = 1; i <= 32; i++) {
		presets.push({
			category: 'Sources (by number)',
			type: 'button',
			name: 'Source ' + i,
			style: {
				style: 'text',
				text: 'S' + i,
				size: '18',
				color: colours.white,
				bgcolor: colours.black,
			},
			actions: [
				{
					action: 'select_source',
					options: {
						source: i,
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
		})

		presets.push({
			category: 'Destinations (by number)',
			type: 'button',
			name: 'Destination ' + i,
			style: {
				style: 'text',
				text: 'D' + i,
				size: '18',
				color: colours.white,
				bgcolor: colours.black,
			},
			actions: [
				{
					action: 'select_dest',
					options: {
						dest: i,
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
		})
	}
	self.setPresetDefinitions(presets)
}
