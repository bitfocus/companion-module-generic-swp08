import { combineRgb, SomeCompanionActionInputField, type SomeCompanionFeedbackInputField } from '@companion-module/base'

export const msgDelay = 5
export const keepAliveTime = 30000

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
		choices: [],
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
		choices: [],
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
		choices: [],
	},
} as const satisfies Record<string, SomeCompanionFeedbackInputField>

export const actionOptions = {
	levels: {
		type: 'multidropdown',
		label: 'Levels',
		id: 'level',
		default: [1],
		minSelection: 1,
		choices: [],
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
		choices: [],
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
		choices: [],
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
} as const satisfies Record<string, SomeCompanionActionInputField>

export const presetDefaults = {
	style: {
		size: '18',
		alignment: 'center:center',
		color: colours.white,
		bgcolor: colours.black,
	},
	sourceCount: 256,
	destCount: 256,
} as const

export const cmds = {
	commandEnable: 0x00,
	crosspointInterrogate: 0x01,
	crosspointConnect: 0x02,
	crosspointTally: 0x03,
	crosspointConnected: 0x04,
	maintenance: 0x07,
	dualControllerStatusRequest: 0x08,
	dualControllerStatusResponse: 0x09,
	protectInterrogate: 0x0a,
	protectTally: 0x0b,
	protectConnect: 0x0c,
	protectConnected: 0x0d,
	protectDisconnect: 0x0e,
	protectDisconnected: 0x0f,
	protectDeviceNameRequest: 0x11,
	protectDeviceNameResponse: 0x12,
	protectTallyDumpRequest: 0x13,
	protectTallyDumpResponse: 0x14,
	crosspointTallyDump: 0x15,
	crosspointTallyDumpByteResponse: 0x16,
	crosspointTallyDumpWordResponse: 0x17,
	routerIoParameterInterrogate: 0x19,
	routerIoParametersTally: 0x1a,
	routerIoParametersConnect: 0x1b,
	routerIoParametersConnected: 0x1c,
	masterProtectConnect: 0x1d,
	namesUpdated: 0x1e,
	diagnosticRequest: 0x29,
	diagnosticResponse: 0x2b,
	logMessage: 0x2c,
	statusConfigurationAndEnableFlagsRequest: 0x4c,
	statusConfigurationTally: 0x4d,
	loggingStrings: 0x4e,
	errorAndStatusRequestMessage: 0x4f,
	softKeyTallyRequest: 0x57,
	softKeyTallyResponse: 0x58,
	softKeyAssignmentSetRequest: 0x59,
	softKeyAssignmentSetResponse: 0x5a,
	protocolImplementation: 0x61,
	protocolImplementationResponse: 0x62,
	getSourceNames: 0x64,
	getSingleSourceName: 0x65,
	getDestNames: 0x66,
	getSingleDestName: 0x67,
	getUmdLabels: 0x68,
	getSingleUmdLabel: 0x69,
	sourceNamesResponse: 0x6a,
	destNamesResponse: 0x6b,
	umdLabelsResponse: 0x6c,
	crosspointTieLineConnect: 0x6f,
	crosspointTieLineInterrogate: 0x70,
	crosspointTieLineTally: 0x71,
	getSourceAssociationNames: 0x72, // Direct Out Manual says 0x71
	getSingleSourceAssociationName: 0x73, // Direct Out Manual says 0x72
	sourceAssociationNamesResponse: 0x74,
	updateName: 0x75,
	crosspointConnectOnGoSalvo: 0x78,
	crosspointGoGroupSalvo: 0x79,
	crosspointConnectOnGoGroupSalvoAck: 0x7a,
	crosspointGoDoneGroupSalvo: 0x7b,
	crosspointSalvoGroupInterrogate: 0x7c,
	crosspointGroupSalvoTally: 0x7d,
	extendedInterrogate: 0x81,
	extendedCrosspointConnect: 0x82,
	extendedCrosspointTally: 0x83,
	extendedCrosspointConnected: 0x84,
	extendedProtectInterrogate: 0x8a,
	extendedProtectTally: 0x8b,
	extendedProtectConnect: 0x8c,
	extendedProtectConnected: 0x8d,
	extendedProtectDisconnect: 0x8e,
	extendedProtectDisconnected: 0x8f,
	extendedProtectTallyDumpRequest: 0x93,
	extendedCrosspointTallyDump: 0x95,
	extendedCrosspointTallyDumpWordResponse: 0x97,
	extendedRouterIoParameterInterrogate: 0x99,
	extendedRouterIoParameterConnect: 0x9b,
	extendedGetSourceNames: 0xe4,
	extendedGetSingleSourceName: 0xe5,
	extendedGetDestNames: 0xe6,
	extendedGetSingleDestName: 0xe7,
	extendedGetUmdLabels: 0xe8,
	extendedGetSingleUmdLabel: 0xe9,
	extendedSourceNamesResponse: 0xea,
	extendedDestNamesResponse: 0xeb,
	extendedCrosspointConnectOnGoGroupSalvo: 0xf8,
	extendedCrosspointSalvoGroupInterrogate: 0xfc,
	ack: 0x1006,
	nak: 0x1015,
} as const satisfies Record<string, number>

export function getCommandName(value: number): string {
	for (const [key, val] of Object.entries(cmds)) {
		if (val === value) {
			return key
		}
	}
	return 'Unknown Command'
}
