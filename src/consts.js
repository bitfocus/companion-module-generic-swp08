import { combineRgb } from '@companion-module/base'

export const msgDelay = 5

export const DLE = '10'
export const STX = '02'
export const ETX = '03'

export const colours = {
	white: combineRgb(255, 255, 255),
	black: combineRgb(0, 0, 0),
	red: combineRgb(240, 0, 0),
	green: combineRgb(102, 255, 102),
	purple: combineRgb(255, 102, 255),
	cyan: combineRgb(102, 255, 255),
	orange: combineRgb(255, 191, 128)
}

export const feedbackOptions = {
	levels: {
		type: 'multidropdown',
		label: 'Levels',
		id: 'level',
		default: [1],
		minSelection: 1,
	},
	destination: {
		type: 'number',
		label: 'Destination',
		id: 'dest',
		default: 1,
		min: 1,
		max: 65536,
	},
	source: {
		type: 'number',
		label: 'Source',
		id: 'source',
		default: 1,
		min: 1,
		max: 65536,
	},
}

export const actionOptions = {
	levels: {
		type: 'multidropdown',
		label: 'Levels',
		id: 'level',
		default: [1],
		minSelection: 1,
	},
	destination: {
		type: 'number',
		label: 'Destination',
		id: 'dest',
		default: 1,
		min: 1,
		max: 65536,
	},
	destinationName: {
		type: 'dropdown',
		label: 'Destination',
		id: 'dest',
		default: 1,
		allowCustom: true,
		tooltip: 'Accepts Variable. Should return an integer between 1 & 65536',
	},
	source: {
		type: 'number',
		label: 'Source',
		id: 'source',
		default: 1,
		min: 1,
		max: 65536,
	},
	sourceName: {
		type: 'dropdown',
		label: 'Source',
		id: 'source',
		default: 1,
		allowCustom: true,
		tooltip: 'Accepts Variable. Should return an integer between 1 & 65536',
	},
	clear: {
		type: 'dropdown',
		label: 'Clear',
		id: 'clear',
		default: 'all',
		choices: [
			{ id: 'all', label: 'All' },
			{ id: 'level', label: 'Levels' },
			{ id: 'dest', label: 'Destination' },
			{ id: 'source', label: 'Source' },
		],
	},
	clearEnableLevels: {
		type: 'checkbox',
		label: "Enable all levels on 'Clear All' or 'Clear Levels'",
		id: 'clear_enable_levels',
		default: true,
	},
}
