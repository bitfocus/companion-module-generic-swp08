export async function SetupVariables(self) {
	// Implemented Commands
	let varList = []
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

	// Labels
	self.source_names = []
	self.dest_names = []

	self.updateVariableDefinitions()

	varList['Sources'] = 0
	varList['Destinations'] = 0

	varList['Source'] = self.selected_source
	varList['Destination'] = self.selected_dest
	self.setVariableValues(varList)
}

export async function UpdateVariableDefinitions(self) {
	let coreVariables = []
	const sourceKeys = Object.keys(self.source_names)
	const destKeys = Object.keys(self.dest_names)

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
			name: 'Selected destination source for level ' + i.toString(),
			variableId: 'Sel_Dest_Source_Level_' + i.toString(),
		})
		coreVariables.push({
			name: 'Selected destination source name for level ' + i.toString(),
			variableId: 'Sel_Dest_Source_Name_Level_' + i.toString(),
		})
	}

	for (let i = 1; i <= sourceKeys.length; i++) {
		coreVariables.push({
			name: 'Source ' + i.toString(),
			variableId: 'Source_' + i.toString(),
		})
	}

	for (let i = 1; i <= destKeys.length; i++) {
		coreVariables.push({
			name: 'Destination ' + i.toString(),
			variableId: 'Destination_' + i.toString(),
		})
	}

	self.setVariableDefinitions(coreVariables)

	let labelDump = []

	for (let i = 0; i < sourceKeys.length; i++) {
		labelDump[`Source_${self.source_names[i].id}`] = self.stripNumber(self.source_names[i].label)
	}

	for (let i = 0; i < destKeys.length; i++) {
		labelDump[`Destination_${self.dest_names[i].id}`] = self.stripNumber(self.dest_names[i].label)
	}

	self.setVariableValues(labelDump)
}
