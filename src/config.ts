import { Regex, SomeCompanionConfigField } from '@companion-module/base'
import { DEFAULT_UNUSED_PORT_NAMES } from './util.js'

export type SwP08Config = {
	host: string
	port: string
	matrices: string
	matrix: number
	matrix_ext: number
	max_levels: number
	max_levels_ext: number
	tally_dump_and_update: boolean
	tally_dump_variables: boolean
	supported_commands_on_connect: boolean
	read_names_on_connect: boolean
	extended_support: boolean
	name_chars: '00' | '01' | '02'
	/** optional: absent on connections saved before these options existed */
	crosspoint_presets?: boolean
	unused_port_names?: string
}

export type SwP08Secrets = undefined

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module will allow you to control broadcast routers which implement the SW-P-08 standard protocol.',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Device IP',
			width: 6,
			regex: Regex.IP,
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Device Port',
			width: 6,
			default: '8910',
			regex: Regex.PORT,
		},
		{
			type: 'textinput',
			label: 'Matrices (optional, e.g. "1:Video, 2:Audio")',
			id: 'matrices',
			width: 12,
			default: '',
			description:
				'Leave blank to control a single matrix (the Matrix Number below). ' +
				'To control several matrices over one connection, list them comma separated: ' +
				'"1:Video, 2:Audio" (ids with labels), "1,2,3" (ids only), or "3" (a count -> matrices 1..3). ' +
				'The first matrix in the list is the primary one and keeps the un-prefixed variables.',
		},
		{
			type: 'number',
			label: 'Matrix Number (primary / fallback) (normal mode)',
			id: 'matrix',
			width: 6,
			default: 1,
			min: 1,
			max: 16,
			range: true,
			step: 1,
			isVisibleExpression: '!$(options:extended_support)',
			asInteger: true,
		},
		{
			type: 'number',
			label: 'Matrix Number (primary / fallback) (extended mode)',
			id: 'matrix_ext',
			width: 6,
			default: 1,
			min: 1,
			max: 256,
			range: true,
			step: 1,
			isVisibleExpression: '$(options:extended_support)',
			asInteger: true,
		},
		{
			type: 'number',
			label: 'Number of levels defined in route (normal mode)',
			id: 'max_levels',
			width: 6,
			default: 3,
			min: 1,
			max: 16,
			range: true,
			step: 1,
			isVisibleExpression: '!$(options:extended_support)',
			asInteger: true,
		},
		{
			type: 'number',
			label: 'Number of levels defined in router (extended mode)',
			id: 'max_levels_ext',
			width: 6,
			default: 3,
			min: 1,
			max: 256,
			range: true,
			step: 1,
			isVisibleExpression: '$(options:extended_support)',
			asInteger: true,
		},
		{
			type: 'checkbox',
			label: 'My router supports tally dump, and sends tally updates',
			id: 'tally_dump_and_update',
			width: 1,
			default: false,
			description:
				'If enabled, the module will request a tally dump on connection. Crosspoint feedbacks still interrogate each destination they use once per connection.',
		},
		{
			type: 'checkbox',
			label: 'Advanced tally/routing variables',
			id: 'tally_dump_variables',
			width: 1,
			default: false,
			description:
				'If enabled, there will be generated variables for each destination on each level. Should only be enabled if you need them specifically.',
		},
		{
			type: 'checkbox',
			label: 'Request supported commands on connection',
			id: 'supported_commands_on_connect',
			width: 1,
			default: true,
			description: 'Not supported by all router controllers. Try disabling this feature if you encounter problems',
		},
		{
			type: 'checkbox',
			label: 'Request names on connection',
			id: 'read_names_on_connect',
			width: 1,
			default: false,
			description: 'Not supported by all router controllers',
		},
		{
			type: 'checkbox',
			label: 'Router has more than 1024 source or destinations or has more than 16 levels',
			id: 'extended_support',
			width: 1,
			default: false,
			description: 'Use extended command set. Not supported by all router controllers',
		},
		{
			type: 'dropdown',
			label: 'Request name length (ignored by some routers)',
			id: 'name_chars',
			width: 6,
			default: '01',
			choices: [
				{ id: '00', label: '4 characters' },
				{ id: '01', label: '8 characters' },
				{ id: '02', label: '12 characters' },
			],
			allowCustom: false,
		},
		{
			type: 'checkbox',
			label: 'Generate crosspoint presets',
			id: 'crosspoint_presets',
			width: 6,
			default: false,
			description:
				'Adds a preset for every source and destination pair, on every matrix and level. ' +
				'Needs names from the router, and can get very large on big routers.',
		},
		{
			type: 'textinput',
			label: 'Port names to leave out of crosspoint presets',
			id: 'unused_port_names',
			width: 6,
			default: DEFAULT_UNUSED_PORT_NAMES,
			description: 'Comma separated, not case sensitive. Ports with no name are always left out.',
			isVisibleExpression: '$(options:crosspoint_presets)',
		},
	]
}
