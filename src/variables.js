export async function SetupVariables(self) {
	// Implemented Commands
	const varList = []
	self.commands = []

	// Hold values
	self.selected_level = []
	self.selected_dest = 0
	self.selected_source = 0

	self.routeTable = []

	self.levels = []

	self.config.max_levels = self.config.max_levels === undefined ? 3 : self.config.max_levels

	for (let i = 1; i <= self.config.max_levels; i++) {
		self.levels.push({ id: i, label: `Level: ${i}` })
		self.selected_level.push({ id: i, enabled: true })
	}

	// Labels
	self.source_names = []
	self.dest_names = []

	self.updateVariableDefinitions()

	varList.Sources = 0
	varList.Destinations = 0

	varList.Source = self.selected_source
	varList.Destination = self.selected_dest
	self.setVariableValues(varList)
}

export async function UpdateVariableDefinitions(self) {
	const coreVariables = []
	const sourceValues = Array.from(self.source_names.values())
	const destValues = Array.from(self.dest_names.values())

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

	for (let i = 1; i <= self.config.max_levels; i++) {
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

	self.setVariableDefinitions(coreVariables)

	const labelDump = {}

	for (const sourceValue of sourceValues) {
		labelDump[`Source_${sourceValue.id}`] = self.stripNumber(sourceValue.label)
	}

	for (const destValue of destValues) {
		labelDump[`Destination_${destValue.id}`] = self.stripNumber(destValue.label)
	}

	self.setVariableValues(labelDump)
}
