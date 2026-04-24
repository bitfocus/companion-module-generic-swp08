import type { InstanceBase } from '@companion-module/base'
import type { SwP08Config, SwP08Secrets } from './config.js'
import type { ActionSchema } from './actions.js'
import type { FeedbackSchema } from './feedbacks.js'

export interface AckCallback {
	resolve: () => void
	reject: () => void
}

export interface ProcessLabelsOptions {
	hasMatrix: boolean // Indicates if the command has matrix information.
	hasLevels: boolean // Indicates if the command has level information.
	extended: boolean // Indicates if it is an extended command.
}

export interface Level {
	enabled: boolean
	id: number
}

export type VarList = Record<string, number | string>

export interface SWP08Types {
	config: SwP08Config
	secrets: SwP08Secrets
	actions: ActionSchema
	feedbacks: FeedbackSchema
	variables: Record<string, string | number>
}

export interface InstanceBaseExt extends InstanceBase<SWP08Types> {
	config: SwP08Config
}
