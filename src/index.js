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
import { UpdateFeedbacks } from'./feedbacks.js'
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
	}

	async init(config) {
		this.updateStatus(InstanceStatus.Connecting)
		this.config = config
		this.setupVariables()
		this.updateFeedbacks()
		this.updateActions()
		this.updatePresets()
		this.init_tcp()
		this.checkFeedbacks('selected_level', 'selected_level_dest', 'selected_dest', 'selected_source')
	}

	async configUpdated(config) {
		this.log('debug', 'update config')
		this.updateStatus(InstanceStatus.Connecting)
		this.config = config
		this.setupVariables()
		this.updateFeedbacks()
		this.updateActions()
		this.updatePresets()
		this.init_tcp()
		this.checkFeedbacks('selected_level', 'selected_level_dest', 'selected_dest', 'selected_source')
	}

	// When module gets deleted
	async destroy() {
		this.log('debug', `destroy. ID: ${this.id}`)
		this.stopKeepAliveTimer()
		if (this.socket) {
			this.socket.destroy()
		}
		this.updateStatus(InstanceStatus.Disconnected)
	}

	// Track whether actions are being recorded
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