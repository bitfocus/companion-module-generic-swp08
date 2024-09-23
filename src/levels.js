export function processLevelsSelection(selection, state) {
	console.log(selection)
	selection.forEach((level) => {
		if (state === 'toggle') {
			this.selected_level[level - 1].enabled = !this.selected_level[level - 1].enabled
		} else {
			this.selected_level[level - 1].enabled = state
		}
	})
	console.log(this.selected_level)
	this.checkFeedbacks('selected_level', 'selected_level_dest')
}
