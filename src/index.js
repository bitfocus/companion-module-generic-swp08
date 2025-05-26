// Generic SWP08 Routing
// Grass Valley - Snell - Probel - Ross
// https://wwwapps.grassvalley.com/docs/Manuals/sam/Protocols%20and%20MIBs/Router%20Control%20Protocols%20SW-P-88%20Issue%204b.pdf
//
// @author Peter Daniel
//
// Updated for Companion v3 July 2024, Phillip Ivan Pietruschka

import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import { UpgradeScripts } from './upgrades.js'
import * as config from './config.js'
import * as actions from './actions.js'
import * as crosspoints from './crosspoints.js'
import * as decode from './decode.js'
import * as keepalive from './keepalive.js'
import * as presets from './presets.js'
import * as variables from './variables.js'
import * as labels from './labels.js'
import * as levels from './levels.js'
import * as names from './names.js'
import * as feedbacks from './feedbacks.js'
import * as tcp from './tcp.js'
import * as util from './util.js'
import _ from 'lodash'
import PQueue from 'p-queue'

class SW_P_08 extends InstanceBase {
	throttledUpdate = _.throttle(() => {
		this.updateVariableDefinitions()
		this.updateAllNames()
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
	}, 1000)

	throttledCrosspointUpdate = _.throttle(
		() => {
			this.updateVariableDefinitions()
			this.updateAllNames()
			this.updateAllCrosspoints()
		},
		1000,
		{ trailing: true },
	)

	constructor(internal) {
		super(internal)
		Object.assign(this, {
			...config,
			...actions,
			...feedbacks,
			...presets,
			...variables,
			...crosspoints,
			...decode,
			...keepalive,
			...labels,
			...levels,
			...names,
			...tcp,
			...util,
		})
		this.ackCallbacks = []
		this.routeMap = new Map()
		this.lastVariables = new Map()
		this.lastVariableDefinitions = new Map()
	}

	async init(config) {
		this.queue = new PQueue({ concurrency: 1, interval: 10, intervalCap: 1 })
		this.configUpdated(config)
	}

	async configUpdated(config) {
		this.queue.clear()
		this.updateStatus(InstanceStatus.Connecting)

		if (config.extended_support) {
			const newMatrix = Math.min(config.matrix_ext, 16)
			const newLevels = Math.min(config.max_levels_ext, 16)

			// Save the clamped values to the normal config too, in case the user
			// switches between extended and normal mode
			if (newMatrix !== config.matrix || newLevels !== config.max_levels) {
				config.matrix = newMatrix
				config.max_levels = newLevels
				// This will not trigger a new configUpdated, so continue processing
				// the rest of the config
				this.saveConfig(config)
			}
		} else {
			// Keep the extended values updated, in case the user switches
			// between extended and normal mode
			if (config.matrix_ext !== config.matrix || config.max_levels_ext !== config.max_levels) {
				config.matrix_ext = config.matrix
				config.max_levels_ext = config.max_levels
				// This will not trigger a new configUpdated, so continue processing
				// the rest of the config
				this.saveConfig(config)
			}
		}

		this.config = config
		this.setupVariables()
		this.updateFeedbacks()
		this.updateActions()
		this.updatePresets()
		this.init_tcp()
		this.checkFeedbacks(
			'selected_level',
			'selected_level_dest',
			'selected_dest',
			'selected_source',
			'crosspoint_connected',
			'crosspoint_connected_by_name',
			'crosspoint_connected_by_level',
		)
	}

	async destroy() {
		this.log('debug', `destroy. ID: ${this.id}`)
		this.queue.clear()
		this.stopKeepAliveTimer()
		if (this.socket) {
			this.socket.destroy()
		}
		this.updateStatus(InstanceStatus.Disconnected)
	}

	handleStartStopRecordActions(isRecording) {
		this.isRecordingActions = isRecording
	}
}
runEntrypoint(SW_P_08, UpgradeScripts)
