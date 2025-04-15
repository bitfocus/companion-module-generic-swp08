// Generic SWP08 Routing
// Grass Valley - Snell - Probel - Ross
// https://wwwapps.grassvalley.com/docs/Manuals/sam/Protocols%20and%20MIBs/Router%20Control%20Protocols%20SW-P-88%20Issue%204b.pdf
//
// @author Peter Daniel
//
// Updated for Companion v3 July 2024, Phillip Ivan Pietruschka

import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { SetupVariables, UpdateVariableDefinitions } from './variables.js'
import * as config from './config.js'
import * as crosspoints from './crosspoints.js'
import * as decode from './decode.js'
import * as keepalive from './keepalive.js'
import * as labels from './labels.js'
import * as levels from './levels.js'
import * as names from './names.js'
import * as tcp from './tcp.js'
import * as util from './util.js'
import _ from 'lodash'
import PQueue from 'p-queue'

class SW_P_08 extends InstanceBase {
	constructor(internal) {
		super(internal)
		Object.assign(this, {
			...config,
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
	}

	throttledUpdate = _.throttle(() => {
		this.updateVariableDefinitions()
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
	}, 1000)

	async init(config) {
		this.queue = new PQueue({ concurrency: 1, interval: 10, intervalCap: 1 })
		this.configUpdated(config)
	}

	async configUpdated(config) {
		this.queue.clear()
		this.updateStatus(InstanceStatus.Connecting)
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

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updatePresets() {
		UpdatePresets(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}

	setupVariables() {
		SetupVariables(this)
	}
}
runEntrypoint(SW_P_08, UpgradeScripts)
