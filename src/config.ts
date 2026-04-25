import { Regex, SomeCompanionConfigField } from '@companion-module/base'

export type SwP08Config = {
	host: string
	port: string
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
			type: 'number',
			label: 'Matrix Number (Default 1) (normal mode)',
			id: 'matrix',
			width: 6,
			default: 1,
			min: 1,
			max: 16,
			range: true,
			step: 1,
			isVisibleExpression: '!$(options:extended_support)',
		},
		{
			type: 'number',
			label: 'Matrix Number (Default 1) (extended mode)',
			id: 'matrix_ext',
			width: 6,
			default: 1,
			min: 1,
			max: 256,
			range: true,
			step: 1,
			isVisibleExpression: '$(options:extended_support)',
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
		},
		{
			type: 'checkbox',
			label: 'My router supports tally dump, and sends tally updates',
			id: 'tally_dump_and_update',
			width: 1,
			default: false,
		},
		{
			type: 'static-text',
			label: '',
			id: 'tally_dump_and_update_txt',
			value:
				'If enabled, the module will request a tally dump on connection and will not (need to) interrogate the router for tally updates.',
			width: 11,
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
		},
	]
}
