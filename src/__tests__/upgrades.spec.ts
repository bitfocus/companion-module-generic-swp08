// Upgrading an existing connection stamps the configured matrix onto actions
// and feedbacks saved before the `matrix` option existed.
import { describe, expect, it } from 'vitest'
import { ActionIds } from '../actions.js'
import { FeedbackIds } from '../feedbacks.js'
import { UpgradeScripts } from '../upgrades.js'
import { baseTestConfig } from './testHarness.js'

const v420 = UpgradeScripts[1]

function upgrade(config: object, actions: object[], feedbacks: object[] = []) {
	const context = { currentConfig: { ...baseTestConfig, ...config } } as never
	return v420(context, { config: null, secrets: null, actions, feedbacks } as never)
}

const action = (actionId: string, options: object = {}) => ({ id: 'a', controlId: 'c', actionId, options })
const feedback = (feedbackId: string, options: object = {}) => ({ id: 'f', controlId: 'c', feedbackId, options })

describe('v420 upgrade script', () => {
	it('stamps the configured matrix in the option format Companion stores', () => {
		const result = upgrade(
			{ matrix: 3 },
			[action(ActionIds.SetCrosspoint)],
			[feedback(FeedbackIds.CrosspointConnectedByLevel)],
		)

		expect(result.updatedActions[0].options.matrix).toEqual({ value: 3, isExpression: false })
		expect(result.updatedFeedbacks[0].options.matrix).toEqual({ value: 3, isExpression: false })
	})

	it('uses the extended matrix number in extended mode', () => {
		const result = upgrade({ extended_support: true, matrix: 3, matrix_ext: 40 }, [action(ActionIds.SetCrosspointName)])

		expect(result.updatedActions[0].options.matrix).toEqual({ value: 40, isExpression: false })
	})

	it('leaves actions alone that already have a matrix or have no matrix option', () => {
		const matrix = { value: 2, isExpression: false }
		const result = upgrade({ matrix: 3 }, [action(ActionIds.SetCrosspoint, { matrix }), action(ActionIds.Take)])

		expect(result.updatedActions).toEqual([])
	})
})
