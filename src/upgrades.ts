import {
	type CompanionStaticUpgradeProps,
	type CompanionStaticUpgradeResult,
	type CompanionUpgradeContext,
	type CompanionStaticUpgradeScript,
	FixupNumericOrVariablesValueToExpressions,
} from '@companion-module/base'
import { ActionIds } from './actions.js'
import { FeedbackIds } from './feedbacks.js'
import type { SwP08Config, SwP08Secrets } from './config.js'

function v400(
	_context: CompanionUpgradeContext<SwP08Config>,
	props: CompanionStaticUpgradeProps<SwP08Config, SwP08Secrets>,
): CompanionStaticUpgradeResult<SwP08Config, SwP08Secrets> {
	const result: CompanionStaticUpgradeResult<SwP08Config, SwP08Secrets> = {
		updatedActions: [],
		updatedConfig: null,
		updatedSecrets: null,
		updatedFeedbacks: [],
	}

	for (const feedback of props.feedbacks) {
		switch (feedback.feedbackId as FeedbackIds) {
			case FeedbackIds.CrosspointConnectedByName:
				feedback.options.source = FixupNumericOrVariablesValueToExpressions(feedback.options.source)
				feedback.options.dest = FixupNumericOrVariablesValueToExpressions(feedback.options.dest)
				result.updatedFeedbacks.push(feedback)
				break
		}
	}
	for (const action of props.actions) {
		switch (action.actionId as ActionIds) {
			case ActionIds.RouteSourceName:
				action.options.source = FixupNumericOrVariablesValueToExpressions(action.options.source)
				result.updatedActions.push(action)
				break
			case ActionIds.SelectDestName:
				action.options.dest = FixupNumericOrVariablesValueToExpressions(action.options.dest)
				result.updatedActions.push(action)
				break
			case ActionIds.SelectSourceName:
				action.options.source = FixupNumericOrVariablesValueToExpressions(action.options.source)
				result.updatedActions.push(action)
				break
			case ActionIds.SetCrosspointName:
				action.options.source = FixupNumericOrVariablesValueToExpressions(action.options.source)
				action.options.dest = FixupNumericOrVariablesValueToExpressions(action.options.dest)
				result.updatedActions.push(action)
				break
		}
	}
	return result
}

export const UpgradeScripts: CompanionStaticUpgradeScript<SwP08Config>[] = [v400]
