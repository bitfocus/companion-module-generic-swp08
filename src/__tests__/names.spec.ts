import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cmds } from '../consts.js'
import { FeedbackIds, UpdateFeedbacks } from '../feedbacks.js'
import { createTestInstance, frame, lastVariableValue, namesResponse } from './testHarness.js'

// Lets the 200 ms names debounce run
const afterNamesDebounce = 250

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

describe('source name of the selected destination', () => {
	// Name keys are 1-based (since 76b682b), as are the sources in the routemap
	it('names the routed source, not the one before it', async () => {
		const { instance, context } = createTestInstance({ max_levels: 1 })
		instance.decode(frame(namesResponse('source', 1, ['CAM 1', 'CAM 2', 'CAM 3'])))
		vi.advanceTimersByTime(afterNamesDebounce)

		instance.selected_dest = 1
		// dest 1 <- source 2 on matrix 1, level 1
		instance.decode(frame([cmds.crosspointConnected, 0x00, 0x00, 0x00, 0x01]))

		expect(lastVariableValue(context, 'Sel_Dest_Source_Name_Level_1')).toBe('CAM 2')

		UpdateFeedbacks(instance as never)
		const feedbacks = context.setFeedbackDefinitions.mock.calls.at(-1)?.[0]
		const sourceName = await feedbacks[FeedbackIds.DestinationSourceName].callback({ options: { level: 1, dest: 1 } })
		expect(sourceName).toBe('CAM 2')
	})
})
