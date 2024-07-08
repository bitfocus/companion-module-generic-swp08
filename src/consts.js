import { combineRgb } from '@companion-module/base'

export const msgDelay = 5
export const keepAliveTimeOut = 30000

export const DLE = '10'
export const STX = '02'
export const ETX = '03'
export const ACK = '06'
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
export const presetDefaults = {
	style: {
		size: '18',
		show_topbar: 'default',
		alignment: 'center:center',
		color: colours.white,
		bgcolor: colours.black,
	},
}

export const cmd = {
	interrogate: '01',
	connect: '02',
	tally: '03',
	connected: '04',
	tallyDumpRequest: '21',
	tallyDumpByteMessage: '22',
	tallyDumpWordMessage: '23',
	getSourceName: '64',
	getDestName: '66',
	connectOnGoGroupSalvo: '78',
	goGroupSalvo: '79',
	connectOnGoGroupSalvoAck: '7A',
	goDoneGroupSalvoAck: '7B',
	salvoGroupInterrogate: '7C',
	groupSalvoTally: '7D',
	extendedinterrogate: '81',
	extendedConnect: '82',
	extendedGetSourceName: 'E4',
	extendedGetDestName: 'E6',
}

export const hexBytes = {
	DLE: 0x10,
	STX: 0x02,
	ETX: 0x03,
	ACK: 0x06,
	NAK: 0x15,
	cmd: {
		tally: 0x03,
		connected: 0x04,
		extendedTally: 0x83,
		extendedConnected: 0x84,
		protocolImplementation: 0x62,
		sourceNames: 0x6a,
		destNames: 0x6b,
		extendedSourceNames: 0xea,
		extendedDestNames: 0xeb,
	}
}