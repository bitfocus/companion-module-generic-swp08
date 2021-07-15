// Generic SWP08 Routing
// Grass Valley - Snell - Probel - Ross
// https://wwwapps.grassvalley.com/docs/Manuals/sam/Protocols%20and%20MIBs/Router%20Control%20Protocols%20SW-P-88%20Issue%204b.pdf
//
// @author Peter Daniel
//

var tcp = require('../../tcp')
var instance_skel = require('../../instance_skel')
var debug
var log

function instance(system) {
	var self = this

	// super-constructor
	instance_skel.apply(this, arguments)

	self.actions()

	return self
}

instance.prototype.updateConfig = function (config) {
	var self = this

	console.log('update config')

	self.config = config

	self.setupVariables()
	self.setupFeedbacks()
	self.actions()

	self.init_tcp()
}

instance.prototype.init = function () {
	var self = this

	console.log('init')

	debug = self.debug
	log = self.log

	self.setupVariables()
	self.setupFeedbacks()
	self.actions()

	self.checkFeedbacks('selected_level')
	self.checkFeedbacks('selected_level_dest')
	self.checkFeedbacks('selected_dest')
	self.checkFeedbacks('selected_source')

	self.init_tcp()
}

instance.prototype.setupVariables = function () {
	var self = this

	// Implemented Commands
	self.commands = []

	// Hold values
	self.selected_level = []
	self.selected_dest = 0
	self.selected_source = 0

	self.routeTable = []

	self.levels = []

	self.config.max_levels = self.config.max_levels === undefined ? 3 : self.config.max_levels

	for (var i = 1; i <= self.config.max_levels; i++) {
		self.levels.push({ id: i, label: 'Level: ' + i })
		self.selected_level.push({ id: i, enabled: true })
	}

	console.log(self.levels)
	console.log(self.selected_level)

	// Labels
	self.source_names = []
	self.dest_names = []

	self.updateVariableDefinitions()

	self.setVariable('Sources', 0)
	self.setVariable('Destinations', 0)

	self.setVariable('Source', self.selected_source)
	self.setVariable('Destination', self.selected_dest)
}

instance.prototype.updateVariableDefinitions = function () {
	var self = this
	var coreVariables = []

	coreVariables.push(
		{
			label: 'Number of source names returned by router',
			name: 'Sources',
		},
		{
			label: 'Number of destination names returned by router',
			name: 'Destinations',
		},
		{
			label: 'Selected destination',
			name: 'Destination',
		},
		{
			label: 'Selected source',
			name: 'Source',
		}
	)

	for (var i = 1; i <= self.config.max_levels; i++) {
		coreVariables.push({
			label: 'Selected destination source for level ' + i.toString(),
			name: 'Sel_Dest_Source_Level_' + i.toString(),
		})
		coreVariables.push({
			label: 'Selected destination source name for level ' + i.toString(),
			name: 'Sel_Dest_Source_Name_Level_' + i.toString(),
		})
	}

	for (var i = 1; i <= Object.keys(self.source_names).length; i++) {
		coreVariables.push({
			label: 'Source ' + i.toString(),
			name: 'Source_' + i.toString(),
		})
	}

	for (var i = 1; i <= Object.keys(self.dest_names).length; i++) {
		coreVariables.push({
			label: 'Destination ' + i.toString(),
			name: 'Destination_' + i.toString(),
		})
	}

	self.setVariableDefinitions(coreVariables)

	var labelDump = {}

	for (var i = 0; i < Object.keys(self.source_names).length; i++) {
		var variableName = 'Source_' + self.source_names[i].id
		var variableValue = self.stripNumber(self.source_names[i].label)
		labelDump[variableName] = variableValue
	}

	for (var i = 0; i < Object.keys(self.dest_names).length; i++) {
		var variableName = 'Destination_' + self.dest_names[i].id
		var variableValue = self.stripNumber(self.dest_names[i].label)
		labelDump[variableName] = variableValue
	}

	console.log(labelDump)
	self.setVariables(labelDump)
}

instance.prototype.init_tcp = function () {
	var self = this
	var receivebuffer = Buffer.from('')

	if (self.socket !== undefined) {
		self.socket.destroy()
		delete self.socket
	}

	if (self.config.host) {
		self.socket = new tcp(self.config.host, self.config.port)

		self.socket.on('status_change', function (status, message) {
			self.status(status, message)
		})

		self.socket.on('error', function (err) {
			debug('Network error', err)
			self.log('error', 'Network error: ' + err.message)
		})

		self.socket.on('connect', function () {
			debug('Connected')
			// request protocol implementation
			self.sendMessage('61019E')
		})

		self.socket.on('data', function (chunk) {
			if (Buffer.compare(chunk, receivebuffer) != 0) {
				console.log('Received: ' + chunk.length + ' bytes ', chunk.toString('hex').match(/../g).join(' '))
				// send ACK
				self.sendAck()
				// Decode
				self.socket.emit('decode', chunk)
				receivebuffer = chunk
			} else {
				// duplicate
				console.log('Repeated: ' + chunk.length + ' bytes')
			}
		})

		self.socket.on('decode', function (data) {
			var message = []

			if (data.length > 0) {
				for (var j = 0; j < data.length; j++) {
					if (data[j] == 0x10) {
						switch (data[j + 1]) {
							case 0x02:
								console.log('Received SOM')
								j++
								continue
								break

							case 0x03:
								console.log('Received EOM')
								j++
								continue
								break

							case 0x06:
								console.log('Received ACK')
								j++
								continue
								break

							case 0x10:
								// remove repeated byte 0x10
								message.push(data[j])
								j++
								continue
								break

							case 0x15:
								console.log('Received NAK')
								j++
								continue
								break

							default:
								message.push(data[j])
								continue
						}
					}
					message.push(data[j])
				}
			}

			if (message.length > 2) {
				console.log('message extracted: ' + message)
				console.log('Command id: ' + message[0])
				switch (message[0]) {
					// Command
					case 0x03:
					case 0x04:
						// Crosspoint Tally, Crosspoint Connected
						self.crosspointConnected(message)
						break

					case 0x62:
						// Protocol Implementation Response
						var requests = message[1]
						var responses = message[2]

						self.commands = []

						for (var j = 3; j < message.length - 2; j++) {
							self.commands.push(message[j])
						}

						console.log('This router implements: ' + self.commands)

						// request names
						if (self.config.read_names_on_connect) {
							self.readNames()
						}
						break

					case 0x6a:
					case 0x6b:
						// Names Reply
						self.processLabels(message)
						break

					default:
						self.log('warn', 'Unknown response code ' + message[0])
						console.log('Unknown response code ' + message[0])
						break
				}
			}
		})
	}
}

instance.prototype.processLabels = function (data) {
	var self = this

	var s = 6
	var l = 0
	var char_length_table = [4, 8, 12]

	var char_length = char_length_table[data[2]]
	var multiplier = data[3]
	var label_number = 256 * multiplier + data[4]
	var labels_in_part = data[5]

	// self.log('debug','label decode ' + data[0] + ' from: ' + label_number + ' count: ' + labels_in_part)

	console.log('label chars:' + char_length)
	console.log('label number:' + label_number)
	console.log('labels in part: ' + labels_in_part)

	while (l < labels_in_part) {
		var label = ''
		for (var j = 0; j < char_length; j++) {
			label = label + String.fromCharCode(data[s + j])
		}

		s = s + char_length
		l = l + 1
		label_number = label_number + 1

		if (data[0] == 0x6a) {
			// sources
			self.source_names.splice(label_number - 1, 0, {
				id: label_number,
				label: label_number.toString() + ': ' + label.trim(),
			})
		} else if (data[0] == 0x6b) {
			// destinations
			self.dest_names.splice(label_number - 1, 0, {
				id: label_number,
				label: label_number.toString() + ': ' + label.trim(),
			})
		}

		// console.log('label ' + self.padLeft(label_number,2) + ' |' + label + '|')
		// self.log('debug','label ' + self.padLeft(label_number,2) + ' |' + label + '|')
	}

	self.setVariable('Sources', Object.keys(self.source_names).length)
	self.setVariable('Destinations', Object.keys(self.dest_names).length)

	// need to find a way of only calling these functions on the last part of the labels
	self.updateVariableDefinitions()

	console.log(self.source_names)
	console.log(self.dest_names)

	// update dropdown lists
	self.actions()
}

instance.prototype.crosspointConnected = function (data) {
	var self = this

	var matrix = ((data[1] & 0xf0) >> 4) + 1
	var level = (data[1] & 0x0f) + 1
	var destDiv = (data[2] & 0x70) >> 4
	var sourceDiv = data[2] & 0x7
	var dest = 128 * destDiv + data[3] + 1
	var source = 128 * sourceDiv + data[4] + 1

	console.log('Source ' + source + ' routed to ' + dest + ' on level ' + level)
	self.log('debug', 'Source ' + source + ' routed to destination ' + dest + ' on level ' + level)

	if (dest == self.selected_dest) {
		// update variables for selected dest source
		self.setVariable('Sel_Dest_Source_Level_' + level.toString(), source)
		if (self.source_names.length > 0) {
			// only if names have been retrieved
			self.setVariable(
				'Sel_Dest_Source_Name_Level_' + level.toString(),
				self.stripNumber(self.source_names[source - 1].label)
			)
		}
	}

	// store route data
	for (var i = 0; i < self.routeTable.length; i++) {
		if (self.routeTable[i].level === level && self.routeTable[i].dest === dest) {
			// update existing
			self.routeTable[i].source = source
			console.log(self.routeTable)
			return
		}
	}

	// add new
	var new_route = { level: level, dest: dest, source: source }
	self.routeTable.push(new_route)
	console.log(self.routeTable)
}

instance.prototype.config_fields = function () {
	var self = this

	return [
		{
			type: 'text',
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
			regex: self.REGEX_IP,
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Device Port',
			width: 6,
			default: '8910',
			regex: self.REGEX_PORT,
		},
		{
			type: 'number',
			label: 'Matrix Number (Default 1)',
			id: 'matrix',
			width: 6,
			default: 1,
			min: 1,
			max: 16,
		},
		{
			type: 'number',
			label: 'Number of levels defined in router',
			id: 'max_levels',
			width: 6,
			default: 3,
			min: 1,
			max: 16,
		},
		{
			type: 'checkbox',
			label: 'Request names from router on connection',
			id: 'read_names_on_connect',
			width: 6,
			default: false,
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

instance.prototype.destroy = function () {
	// When module gets deleted
	var self = this

	if (self.socket !== undefined) {
		self.socket.destroy()
	}

	debug('destroy', self.id)
}

instance.prototype.setupFeedbacks = function (system) {
	var self = this

	// feedback
	var feedbacks = {}

	feedbacks['selected_level'] = {
		type: 'boolean',
		label: 'Selected Levels',
		description: 'Change colour of button on selected levels',
		style: {
			color: self.rgb(0, 0, 0),
			bgcolor: self.rgb(255, 102, 255),
		},
		options: [
			{
				type: 'multiselect',
				label: 'Levels',
				id: 'level',
				default: [1],
				choices: self.levels,
				minSelection: 1,
			},
		],
	}

	feedbacks['selected_level_dest'] = {
		type: 'boolean',
		label: 'Selected Levels and Destination',
		description: 'Change colour of button on selected levels and destination',
		style: {
			color: self.rgb(0, 0, 0),
			bgcolor: self.rgb(255, 102, 255),
		},
		options: [
			{
				type: 'multiselect',
				label: 'Levels',
				id: 'level',
				default: [1],
				choices: self.levels,
				minSelection: 1,
			},
			{
				type: 'number',
				label: 'Destination',
				id: 'dest',
				default: 1,
				min: 1,
			},
		],
	}

	feedbacks['selected_dest'] = {
		type: 'boolean',
		label: 'Selected Destination',
		description: 'Change colour of button on selected destination',
		style: {
			color: self.rgb(0, 0, 0),
			bgcolor: self.rgb(102, 255, 102),
		},
		options: [
			{
				type: 'number',
				label: 'Destination',
				id: 'dest',
				default: 1,
				min: 1,
			},
		],
	}

	feedbacks['selected_source'] = {
		type: 'boolean',
		label: 'Selected Source',
		description: 'Change colour of button on selected source',
		style: {
			color: self.rgb(0, 0, 0),
			bgcolor: self.rgb(102, 255, 255),
		},
		options: [
			{
				type: 'number',
				label: 'Source',
				id: 'source',
				default: 1,
				min: 1,
			},
		],
	}

	self.setFeedbackDefinitions(feedbacks)
}

instance.prototype.feedback = function (feedback, bank) {
	var self = this

	switch (feedback.type) {
		case 'selected_level': {
			var l = feedback.options.level.length
			var k = self.selected_level.length

			for (var i = 0; i < l; i++) {
				var feedback_test = feedback.options.level[i]
				for (var j = 0; j < k; j++) {
					if (self.selected_level[j].id == feedback_test) {
						if (self.selected_level[j].enabled === true) {
							// matched
						} else {
							return false
						}
					}
				}
			}
			return true
			break
		}

		case 'selected_level_dest': {
			if (self.selected_dest === feedback.options.dest) {
				var l = feedback.options.level.length
				var k = self.selected_level.length

				for (var i = 0; i < l; i++) {
					var feedback_test = feedback.options.level[i]
					for (var j = 0; j < k; j++) {
						if (self.selected_level[j].id == feedback_test) {
							if (self.selected_level[j].enabled === true) {
								// matched
							} else {
								return false
							}
						}
					}
				}
				return true
			} else {
				return false
			}
			break
		}

		case 'selected_dest': {
			if (self.selected_dest === feedback.options.dest) {
				return true
			} else {
				return false
			}
			break
		}

		case 'selected_source': {
			if (self.selected_source === feedback.options.source) {
				return true
			} else {
				return false
			}
			break
		}
	}
}

instance.prototype.init_presets = function () {
	var self = this
	var presets = []

	self.setPresetDefinitions(presets)
}

instance.prototype.actions = function () {
	var self = this

	self.system.emit('instance_actions', self.id, {
		select_level: {
			label: 'Select Levels',
			options: [
				{
					type: 'multiselect',
					label: 'Levels',
					id: 'level',
					default: [1],
					choices: self.levels,
					minSelection: 1,
				},
			],
		},

		deselect_level: {
			label: 'De-Select Levels',
			options: [
				{
					type: 'multiselect',
					label: 'Levels',
					id: 'level',
					default: [1],
					choices: self.levels,
					minSelection: 1,
				},
			],
		},

		toggle_level: {
			label: 'Toggle Levels',
			options: [
				{
					type: 'multiselect',
					label: 'Levels',
					id: 'level',
					default: [1],
					choices: self.levels,
					minSelection: 1,
				},
			],
		},

		select_dest: {
			label: 'Select Destination',
			options: [
				{
					type: 'number',
					label: 'Destination',
					id: 'dest',
					default: 1,
					min: 1,
				},
			],
		},

		select_dest_name: {
			label: 'Select Destination name',
			options: [
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'dest',
					default: 1,
					choices: self.dest_names,
				},
			],
		},

		select_source: {
			label: 'Select Source',
			options: [
				{
					type: 'number',
					label: 'Source',
					id: 'source',
					default: 1,
					min: 1,
				},
			],
		},

		select_source_name: {
			label: 'Select Source name',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: 1,
					choices: self.source_names,
				},
			],
		},

		route_source: {
			label: 'Route Source to selected Levels and Destination',
			options: [
				{
					type: 'number',
					label: 'Source',
					id: 'source',
					default: 1,
					min: 1,
				},
			],
		},

		route_source_name: {
			label: 'Route Source name to selected Levels and Destination',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: 1,
					choices: self.source_names,
				},
			],
		},

		take: {
			label: 'Take',
		},

		clear: {
			label: 'Clear',
			options: [
				{
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
				{
					type: 'checkbox',
					label: "Enable all levels on 'Clear All' or 'Clear Levels'",
					id: 'clear_enable_levels',
					default: true,
				},
			],
		},

		set_crosspoint: {
			label: 'Set crosspoint',
			options: [
				{
					type: 'multiselect',
					label: 'Levels',
					id: 'level',
					default: [1],
					choices: self.levels,
					minSelection: 1,
				},
				{
					type: 'number',
					label: 'Source',
					id: 'source',
					default: 1,
					min: 1,
				},
				{
					type: 'number',
					label: 'Destination',
					id: 'dest',
					default: 1,
					min: 1,
				},
			],
		},

		set_crosspoint_name: {
			label: 'Set crosspoint by name',
			options: [
				{
					type: 'multiselect',
					label: 'Levels',
					id: 'level',
					default: [1],
					choices: self.levels,
					minSelection: 1,
				},
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: 1,
					choices: self.source_names,
				},
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'dest',
					default: 1,
					choices: self.dest_names,
				},
			],
		},

		get_names: {
			label: 'Refresh Source and Destination names',
		},
	})
}

instance.prototype.action = function (action) {
	var self = this

	const opt = action.options

	if (action.action === 'select_level') {
		self.processLevelsSelection(opt.level, true)
		return
	}

	if (action.action === 'deselect_level') {
		self.processLevelsSelection(opt.level, false)
		return
	}

	if (action.action === 'toggle_level') {
		self.processLevelsSelection(opt.level, 'toggle')
		return
	}

	if (action.action === 'select_dest' || action.action === 'select_dest_name') {
		self.selected_dest = parseInt(opt.dest)
		self.getCrosspoints(opt.dest)
		console.log('set destination ' + self.selected_dest)
		self.setVariable('Destination', self.selected_dest)
		self.checkFeedbacks('selected_dest')
		self.checkFeedbacks('selected_level_dest')
		return
	}

	if (action.action === 'select_source' || action.action === 'select_source_name') {
		self.selected_source = parseInt(opt.source)
		console.log('set source ' + self.selected_source)
		self.setVariable('Source', self.selected_source)
		self.checkFeedbacks('selected_source')
		return
	}

	if (action.action === 'route_source' || action.action === 'route_source_name') {
		console.log(self.selected_level)
		var l = self.selected_level.length
		for (var i = 0; i < l; i++) {
			if (self.selected_level[i].enabled === true) {
				self.SetCrosspoint(opt.source, self.selected_dest, self.selected_level[i].id)
			}
		}
	}

	if (action.action === 'take') {
		console.log(self.selected_level)
		var l = self.selected_level.length
		for (var i = 0; i < l; i++) {
			if (self.selected_level[i].enabled === true) {
				self.SetCrosspoint(self.selected_source, self.selected_dest, self.selected_level[i].id)
			}
		}
	}

	if (action.action === 'set_crosspoint' || action.action === 'set_crosspoint_name') {
		for (let level_val of opt.level) {
			self.SetCrosspoint(opt.source, opt.dest, level_val)
		}
	}

	if (action.action === 'clear') {
		if (opt.clear === 'all' || opt.clear === 'level') {
			self.selected_level = []
			for (var i = 1; i <= self.config.max_levels; i++) {
				self.selected_level.push({ id: i, enabled: opt.clear_enable_levels })
			}
			self.checkFeedbacks('selected_level')
			self.checkFeedbacks('selected_level_dest')
			console.log('clear levels')
			console.log(self.selected_level)
		}

		if (opt.clear === 'all' || opt.clear === 'dest') {
			self.selected_dest = 0
			self.setVariable('Destination', self.selected_dest)
			self.checkFeedbacks('selected_dest')
			self.checkFeedbacks('selected_level_dest')
			console.log('clear dest')
		}

		if (opt.clear === 'all' || opt.clear === 'source') {
			self.selected_source = 0
			self.setVariable('Source', self.selected_source)
			self.checkFeedbacks('selected_source')
			console.log('clear source')
		}
	}

	if (action.action === 'get_names') {
		self.readNames()
	}
}

instance.prototype.processLevelsSelection = function (selection, state) {
	var self = this

	console.log(selection)
	selection.forEach((level) => {
		if (state === 'toggle') {
			self.selected_level[level - 1].enabled = !self.selected_level[level - 1].enabled
		} else {
			self.selected_level[level - 1].enabled = state
		}
	})

	console.log(self.selected_level)
	self.checkFeedbacks('selected_level')
	self.checkFeedbacks('selected_level_dest')
}

instance.prototype.readNames = function () {
	var self = this

	// reset
	self.source_names = []
	self.dest_names = []
	self.setVariable('Sources', 0)
	self.setVariable('Destinations', 0)

	get_source = '64' + self.config.name_chars + '02'
	get_dest = '66' + self.config.name_chars + '02'

	// get source names
	self.sendMessage(get_source + self.checksum8(get_source))

	// get dest names
	self.sendMessage(get_dest + self.checksum8(get_dest))
}

instance.prototype.sendAck = function () {
	var self = this

	console.log('Sending ACK')
	if (self.socket !== undefined && self.socket.connected) {
		self.socket.send(self.hexStringToBuffer('1006'))
	} else {
		debug('Socket not connected :(')
	}
}

instance.prototype.sendMessage = function (message) {
	var self = this
	const DLE = '10'
	const STX = '02'
	const ETX = '03'

	// minimum length is 1 byte
	if (message.length < 2) {
		self.log('warn', 'Empty or invalid message!')
		return
	}

	// check that the command is implemented in the router
	var cmdCode = parseInt(message.substring(0, 2), 16)

	if (cmdCode !== 97) {
		if (self.commands.length > 0) {
			if (self.commands.indexOf(cmdCode) !== -1) {
				// all good
			} else {
				self.log('warn', 'Command code ' + cmdCode + ' is not implemented by this hardware')
				return
			}
		} else {
			self.log('warn', 'Unable to verify list of implemented commands')
			return
		}
	}

	// replace byte value 10 (DLE) in data with 1010
	var packed = ''
	for (var j = 0; j < message.length; j = j + 2) {
		var b = message.substr(j, 2)
		if (b === '10') {
			packed = packed + '1010'
		} else {
			packed = packed + b
		}
	}

	cmd = DLE + STX + packed + DLE + ETX

	console.log('Sending >> ' + cmd)

	if (cmd !== undefined) {
		if (self.socket !== undefined && self.socket.connected) {
			self.socket.send(self.hexStringToBuffer(cmd))
		} else {
			debug('Socket not connected :(')
		}
	}
}

instance.prototype.SetCrosspoint = function (sourceN, destN, levelN) {
	var self = this

	self.log('debug', 'Crosspoint ' + sourceN + '>' + destN + ' level ' + levelN)
	console.log('SetCrosspoint ' + sourceN + '>' + destN + ' level ' + levelN)

	if (sourceN <= 0 || sourceN > 1024) {
		self.log('warn', 'Unable to route source ' + sourceN)
		return
	}

	if (destN <= 0 || destN > 1024) {
		self.log('warn', 'Unable to route destination ' + destN)
		return
	}

	if (levelN <= 0 || levelN > 16) {
		self.log('warn', 'Unable to route level ' + levelN)
		return
	}

	const COM = '02'

	// Matrix and Level
	var matrix = (self.config.matrix - 1) << 4
	var level = levelN - 1
	var matrix_level = self.padLeft((matrix | level).toString(16), 2)

	// Multiplier if source or dest > 128
	var destDIV = Math.floor((destN - 1) / 128)
	var sourceDIV = Math.floor((sourceN - 1) / 128)
	var multiplier = self.padLeft(((destDIV << 4) | sourceDIV).toString(16), 2)

	// Destination MOD 128
	var dest = self.padLeft(((destN - 1) % 128).toString(16), 2)

	// Source MOD 128
	var source = self.padLeft(((sourceN - 1) % 128).toString(16), 2)

	// Byte count
	var count = '05'

	// checksum
	var checksum = self.checksum8(COM + matrix_level + multiplier + dest + source + count)

	// message
	var action = COM + matrix_level + multiplier + dest + source + count + checksum

	self.sendMessage(action)
}

instance.prototype.getCrosspoints = function (destN) {
	var self = this

	console.log('GetCrosspoint ' + destN)

	if (destN <= 0 || destN > 1024) {
		self.log('warn', 'Unable to get crosspoint destination ' + destN)
		return
	}

	const COM = '01'
	// Byte count
	var count = '04'

	// Matrix and Level
	var matrix = (self.config.matrix - 1) << 4

	// Multiplier if dest > 128
	var destDIV = Math.floor((destN - 1) / 128)
	var multiplier = self.padLeft((destDIV << 4).toString(16), 2)

	// Destination MOD 128
	var dest = self.padLeft(((destN - 1) % 128).toString(16), 2)

	// check all levels
	for (var i = 0; i <= self.config.max_levels - 1; i++) {
		var matrix_level = self.padLeft((matrix | i).toString(16), 2)
		// checksum
		var checksum = self.checksum8(COM + matrix_level + multiplier + dest + count)
		// message
		var action = COM + matrix_level + multiplier + dest + count + checksum
		self.sendMessage(action)
	}
}

instance.prototype.stripNumber = function (str) {
	var n = str.indexOf(':')
	if (n > 0) {
		return str.slice(n + 2)
	} else {
		return str
	}
}
instance.prototype.padLeft = function (nr, n, str) {
	return Array(n - String(nr).length + 1).join(str || '0') + nr
}

instance.prototype.asciiToHex = function (str) {
	var arr1 = []
	for (var n = 0, l = str.length; n < l; n++) {
		var hex = Number(str.charCodeAt(n)).toString(16)
		arr1.push(hex)
	}
	return arr1.join('')
}

instance.prototype.hexStringToBuffer = function (str) {
	return Buffer.from(str, 'hex')
}

instance.prototype.getLength = function (str) {
	var self = this

	var length = (str.length / 2).toString(16)
	return self.padLeft(length, 4)
}

instance.prototype.checksum8 = function (N) {
	// convert input value to upper case
	strN = new String(N)
	strN = strN.toUpperCase()

	strHex = new String('0123456789ABCDEF')
	result = 0
	fctr = 16

	for (i = 0; i < strN.length; i++) {
		if (strN.charAt(i) == ' ') continue

		v = strHex.indexOf(strN.charAt(i))
		if (v < 0) {
			result = -1
			break
		}

		result += v * fctr

		if (fctr == 16) fctr = 1
		else fctr = 16
	}

	// Calculate 2's complement
	result = (~(result & 0xff) + 1) & 0xff

	// Convert result to string
	strResult = strHex.charAt(Math.floor(result / 16)) + strHex.charAt(result % 16)

	// console.log('checksum: ' + strResult)
	return strResult
}

instance_skel.extendedBy(instance)
exports = module.exports = instance
