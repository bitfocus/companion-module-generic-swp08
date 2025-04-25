import { combineRgb } from '@companion-module/base'

export const msgDelay = 5
export const keepAliveTimeOut = 30000

export const DLE = 0x10
export const STX = 0x02
export const ETX = 0x03
export const ACK = 0x06
export const NAK = 0x15

export const colours = {
	white: combineRgb(255, 255, 255),
	black: combineRgb(0, 0, 0),
	red: combineRgb(240, 0, 0),
	green: combineRgb(102, 255, 102),
	purple: combineRgb(255, 102, 255),
	cyan: combineRgb(102, 255, 255),
	orange: combineRgb(255, 191, 128),
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
export const presetDefaults = {
	style: {
		size: '18',
		show_topbar: 'default',
		alignment: 'center:center',
		color: colours.white,
		bgcolor: colours.black,
	},
	sourceCount: 256,
	destCount: 256,
}

export const cmds = {
	crosspointInterrogate: 0x01,
	crosspointConnect: 0x02,
	crosspointTally: 0x03,
	crosspointConnected: 0x04,
	crosspointTallyDump: 0x15,
	crosspointTallyDumpByteResponse: 0x16,
	crosspointTallyDumpWordResponse: 0x17,
	getSourceNames: 0x64,
	getDestNames: 0x66,
	extendedInterrogate: 0x81,
	extendedCrosspointConnect: 0x82,
	extendedCrosspointTally: 0x83,
	extendedCrosspointConnected: 0x84,
	protocolImplementation: 0x61,
	protocolImplementationResponse: 0x62,
	allSourceNames: 0x64,
	allDestNames: 0x66,
	sourceNamesResponse: 0x6a,
	destNamesResponse: 0x6b,
	extendedCrosspointTallyDump: 0x95,
	extendedCrosspointTallyDumpWordResponse: 0x97,
	extendedGetSourceNames: 0xe4,
	extendedGetDestNames: 0xe6,
	extendedSourceNamesResponse: 0xea,
	extendedDestNamesResponse: 0xeb,
}
