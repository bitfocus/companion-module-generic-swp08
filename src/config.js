import { InstanceStatus, Regex } from '@companion-module/base'

export async function configUpdated(config) {
	this.log('debug','update config')
	this.updateStatus(InstanceStatus.Connecting)
	this.config = config
	this.setupVariables()
	this.updateVariableDefinitions()
	this.updateFeedbacks()
	this.updateActions()
	this.initPresets()
	this.init_tcp()
    this.checkFeedbacks('selected_level', 'selected_level_dest','selected_dest','selected_source')
}

export function getConfigFields() {
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
			label: 'Matrix Number (Default 1)',
			id: 'matrix',
			width: 6,
			default: 1,
			min: 1,
			max: 16,
            range: true,
            step: 1,
		},
		{
			type: 'number',
			label: 'Number of levels defined in router',
			id: 'max_levels',
			width: 6,
			default: 3,
			min: 1,
			max: 256,
            range: true,
            step: 1,
		},
		{
			type: 'checkbox',
			label: 'Enable',
			id: 'supported_commands_on_connect',
			width: 1,
			default: true,
		},
		{
			type: 'static-text',
			label: 'Request supported commands on connection',
			id: 'supported_commands_on_connect_txt',
			value: 'Not supported by all router controllers. Try disabling this feature if you encounter problems',
			width: 11,
		},
		{
			type: 'checkbox',
			label: 'Enable',
			id: 'read_names_on_connect',
			width: 1,
			default: false,
		},
		{
			type: 'static-text',
			label: 'Request names on connection',
			id: 'read_names_on_connect_txt',
			value: 'Not supported by all router controllers',
			width: 11,
		},
		{
			type: 'checkbox',
			label: 'Enable',
			id: 'extended_support',
			width: 1,
			default: false,
		},
		{
			type: 'static-text',
			label: 'Router has more than 1024 source or destination names',
			id: 'extended_support_txt',
			value: 'Use extended command set for name requests. Not supported by all router controllers',
			width: 11,
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