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
