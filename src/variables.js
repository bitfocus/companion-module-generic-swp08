import _ from 'lodash'
import { getRouteVariableName } from './crosspoints.js'

export async function setupVariables() {
	// Implemented Commands
	const varList = {}
	this.commands = []

	// Hold values
	this.selected_dest = 0
	this.selected_source = 0

	const currentLevels = (this.config.extended_support ? this.config.max_levels_ext : this.config.max_levels) || 3

	this.levels = []
	this.selected_level = []
	for (let i = 1; i <= currentLevels; i++) {
		this.levels.push({ id: i, label: `Level: ${i}` })
		this.selected_level.push({ id: i, enabled: true })
	}

	// Labels
	this.source_names = []
	this.dest_names = []

	this.updateVariableDefinitions()

	varList.Sources = 0
	varList.Destinations = 0

	varList.Source = this.selected_source
	varList.Destination = this.selected_dest

	this.setVariableValuesCached(varList)
}

/**
 * Only set variable values if they have changed, easing the load on companion
 * @param {*} object - Object with variable values to set
 */
export function setVariableValuesCached(object) {
	const objCopy = { ...object }
	for (const [key, value] of Object.entries(objCopy)) {
		if (this.lastVariables.get(key) !== value) {
			this.lastVariables.set(key, value)
		} else {
			delete objCopy[key]
		}
	}
	if (Object.keys(objCopy).length === 0) {
		return
	}
	this.setVariableValues(objCopy)
}

export async function updateVariableDefinitions() {
	const coreVariables = []
	const sourceValues = Array.from(this.source_names.values())
	const destValues = Array.from(this.dest_names.values())

	coreVariables.push(
		{
			name: 'Number of source names returned by router',
			variableId: 'Sources',
		},
		{
			name: 'Number of destination names returned by router',
			variableId: 'Destinations',
		},
		{
			name: 'Selected destination',
			variableId: 'Destination',
		},
		{
			name: 'Selected source',
			variableId: 'Source',
		},
	)

	for (let i = 1; i <= this.config.max_levels; i++) {
		coreVariables.push({
			name: `Selected destination source for level ${i}`,
			variableId: `Sel_Dest_Source_Level_${i}`,
		})
		coreVariables.push({
			name: `Selected destination source name for level ${i}`,
			variableId: `Sel_Dest_Source_Name_Level_${i}`,
		})
	}

	for (let i = 1; i <= sourceValues.length; i++) {
		coreVariables.push({
			name: `Source ${i}`,
			variableId: `Source_${i}`,
		})
	}

	for (let i = 1; i <= destValues.length; i++) {
		coreVariables.push({
			name: `Destination ${i}`,
			variableId: `Destination_${i}`,
		})
	}

	if (this.config.tally_dump_variables) {
		this.routeMap.forEach((levels, index) => {
			for (const level of levels?.keys() ?? []) {
				coreVariables.push({
					name: `Source for destination ${index} at level ${level}`,
					variableId: getRouteVariableName(level, index),
				})
			}
		})
	}

	// Only update if there are changes to the variable definitions
	let changes = false
	for (const variable of coreVariables) {
		if (!_.isEqual(this.lastVariableDefinitions.get(variable.variableId), variable)) {
			this.lastVariableDefinitions.set(variable.variableId, variable)
			changes = true
		}
	}

	// No changes, no need to update
	if (!changes) {
		return
	}

	this.setVariableDefinitions(coreVariables)
}
