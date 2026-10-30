// Regression tests for the "console flooded with 'Unable to get crosspoint destination 0'"
// bug: selected_dest/selected_source default to 0 as a "nothing selected yet" sentinel
// (also used deliberately by the clear action and the CanTake feedback), and on a router
// that doesn't push tally updates, every single crosspoint update re-checked the
// SourceDestRoute feedback, which queried getCrosspoints(self.selected_dest) - flooding
// the log with warnings for the unselected (0) destination on every port update at startup.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackIds, UpdateFeedbacks } from '../feedbacks.js'
import { createTestInstance, type TestableInstance } from './testHarness.js'

describe('getCrosspoints(0) - the "nothing selected" sentinel', () => {
	let instance: TestableInstance

	beforeEach(() => {
		;({ instance } = createTestInstance())
		instance.sendMessage = vi.fn().mockResolvedValue(undefined)
	})

	it('does not send anything and does not log a warning', async () => {
		const warnSpy = vi.spyOn(instance, 'log')

		await instance.getCrosspoints(0)

		expect(instance.sendMessage).not.toHaveBeenCalled()
		expect(warnSpy).not.toHaveBeenCalledWith('warn', expect.anything())
	})

	it('still warns for genuinely invalid destinations (negative / non-integer / out of range)', async () => {
		const warnSpy = vi.spyOn(instance, 'log')

		await instance.getCrosspoints(-1)
		await instance.getCrosspoints(1.5)
		await instance.getCrosspoints(70000)

		expect(warnSpy.mock.calls.filter((c) => c[0] === 'warn')).toHaveLength(3)
		expect(instance.sendMessage).not.toHaveBeenCalled()
	})
})

describe('selected_dest/selected_source default to the 0 "unselected" sentinel', () => {
	it('starts unselected after setupVariables, rather than defaulting to a valid port like 1', () => {
		const { instance } = createTestInstance()

		expect(instance.selected_dest).toBe(0)
		expect(instance.selected_source).toBe(0)
	})
})

describe('SourceDestRoute feedback - does not poll the router for an unselected destination', () => {
	let instance: TestableInstance
	let feedbackDef: any

	beforeEach(() => {
		const created = createTestInstance({ tally_dump_and_update: false })
		instance = created.instance
		UpdateFeedbacks(instance as never)
		const definitions = created.context.setFeedbackDefinitions.mock.calls.at(-1)?.[0]
		feedbackDef = definitions[FeedbackIds.SourceDestRoute]
		instance.getCrosspoints = vi.fn().mockResolvedValue(undefined)
	})

	it('does not call getCrosspoints while selected_dest is 0 (nothing selected yet)', () => {
		expect(instance.selected_dest).toBe(0)

		feedbackDef.callback({ options: { source: 1 } })

		expect(instance.getCrosspoints).not.toHaveBeenCalled()
	})

	it('does call getCrosspoints once a real destination is selected and not yet in the routemap', () => {
		instance.selected_dest = 5

		feedbackDef.callback({ options: { source: 1 } })

		// SourceDestRoute now targets a specific matrix (primary, when the option is absent)
		expect(instance.getCrosspoints).toHaveBeenCalledWith(5, undefined, instance.primaryMatrix)
	})

	it('polls a destination only once per connection', () => {
		instance.selected_dest = 5

		feedbackDef.callback({ options: { source: 1 } })
		feedbackDef.callback({ options: { source: 2 } })
		instance.setRoutemap(instance.primaryMatrix, 1, 5, 1)
		feedbackDef.callback({ options: { source: 1 } })

		expect(instance.getCrosspoints).toHaveBeenCalledTimes(1)
	})
})

describe('CrosspointConnectedByLevel feedback - learns state when the router skips the tally dump', () => {
	it('interrogates the destination even with tally dump enabled, then lights from the reply', () => {
		const created = createTestInstance({ tally_dump_and_update: true })
		const instance = created.instance
		UpdateFeedbacks(instance as never)
		const feedbackDef =
			created.context.setFeedbackDefinitions.mock.calls.at(-1)?.[0][FeedbackIds.CrosspointConnectedByLevel]
		instance.getCrosspoints = vi.fn().mockResolvedValue(undefined)
		const options = { matrix: instance.primaryMatrix, level: [2], dest: 7, source: 3 }

		expect(feedbackDef.callback({ options })).toBe(false)
		expect(instance.getCrosspoints).toHaveBeenCalledWith(7, undefined, instance.primaryMatrix)

		instance.setRoutemap(instance.primaryMatrix, 3, 7, 2)
		expect(feedbackDef.callback({ options })).toBe(true)
		expect(instance.getCrosspoints).toHaveBeenCalledTimes(1)
	})
})

describe('CanTake feedback - 0 still means "nothing selected" (used by the clear action)', () => {
	it('is false when either selected_dest or selected_source is 0', () => {
		const { instance, context } = createTestInstance()
		UpdateFeedbacks(instance as never)
		const definitions = context.setFeedbackDefinitions.mock.calls.at(-1)?.[0]
		const canTake = definitions[FeedbackIds.CanTake]

		instance.selected_dest = 0
		instance.selected_source = 3
		expect(canTake.callback({ options: {} })).toBe(false)

		instance.selected_dest = 3
		instance.selected_source = 0
		expect(canTake.callback({ options: {} })).toBe(false)
	})
})

describe('advanced tally route variables', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it('does not republish definitions when crosspoint values change', () => {
		vi.useFakeTimers()
		const { instance, context } = createTestInstance({ tally_dump_variables: true })
		context.setVariableDefinitions.mockClear()
		context.setVariableValues.mockClear()

		instance.setRoutemap(instance.primaryMatrix, 10, 20, 1)
		instance.debouncedCrosspointUpdate()
		vi.advanceTimersByTime(250)

		expect(context.setVariableDefinitions).not.toHaveBeenCalled()
		expect(context.setVariableValues).toHaveBeenCalledWith({ Route_1_20: 10 })
	})

	it('still publishes advanced route definitions during the explicit initial-load flush', () => {
		const { instance, context } = createTestInstance({ tally_dump_variables: true })
		context.setVariableDefinitions.mockClear()
		context.setVariableValues.mockClear()

		instance.setRoutemap(instance.primaryMatrix, 10, 20, 1)
		instance.flushAfterLoad('complete')

		const definitions = context.setVariableDefinitions.mock.calls.at(-1)?.[0]
		expect(definitions).toHaveProperty('Route_1_20')
		expect(context.setVariableValues).toHaveBeenCalledWith(expect.objectContaining({ Route_1_20: 10 }))
	})
})
