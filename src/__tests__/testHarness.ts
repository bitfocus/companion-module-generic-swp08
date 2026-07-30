import { vi } from 'vitest'
import SW_P_08 from '../index.js'
import type { SwP08Config } from '../config.js'

/**
 * Minimal stand-in for the host-side InstanceContext that @companion-module/base's
 * InstanceBase constructor requires. Only needs to satisfy `isInstanceContext()`
 * and provide no-op/spy implementations of everything InstanceBase forwards to it,
 * so we can construct a real SW_P_08 instance without a running Companion host.
 */
export function createInstanceContext(): {
	id: string
	_isInstanceContext: true
	label: string
	saveConfig: ReturnType<typeof vi.fn>
	setActionDefinitions: ReturnType<typeof vi.fn>
	setFeedbackDefinitions: ReturnType<typeof vi.fn>
	setPresetDefinitions: ReturnType<typeof vi.fn>
	setCompositeElementDefinitions: ReturnType<typeof vi.fn>
	setVariableDefinitions: ReturnType<typeof vi.fn>
	setVariableValues: ReturnType<typeof vi.fn>
	getVariableValue: ReturnType<typeof vi.fn>
	checkAllFeedbacks: ReturnType<typeof vi.fn>
	checkFeedbacks: ReturnType<typeof vi.fn>
	checkFeedbacksById: ReturnType<typeof vi.fn>
	subscribeActions: ReturnType<typeof vi.fn>
	unsubscribeActions: ReturnType<typeof vi.fn>
	unsubscribeFeedbacks: ReturnType<typeof vi.fn>
	recordAction: ReturnType<typeof vi.fn>
	oscSend: ReturnType<typeof vi.fn>
	updateStatus: ReturnType<typeof vi.fn>
} {
	return {
		id: 'test-instance',
		_isInstanceContext: true,
		label: 'test',
		saveConfig: vi.fn(),
		setActionDefinitions: vi.fn(),
		setFeedbackDefinitions: vi.fn(),
		setPresetDefinitions: vi.fn(),
		setCompositeElementDefinitions: vi.fn(),
		setVariableDefinitions: vi.fn(),
		setVariableValues: vi.fn(),
		getVariableValue: vi.fn(),
		checkAllFeedbacks: vi.fn(),
		checkFeedbacks: vi.fn(),
		checkFeedbacksById: vi.fn(),
		subscribeActions: vi.fn(),
		unsubscribeActions: vi.fn(),
		unsubscribeFeedbacks: vi.fn(),
		recordAction: vi.fn(),
		oscSend: vi.fn(),
		updateStatus: vi.fn(),
	}
}

export const baseTestConfig: SwP08Config = {
	host: '',
	port: '8910',
	matrix: 1,
	matrix_ext: 1,
	max_levels: 3,
	max_levels_ext: 3,
	tally_dump_and_update: false,
	tally_dump_variables: false,
	supported_commands_on_connect: false,
	read_names_on_connect: false,
	extended_support: false,
	name_chars: '01',
}

// Deliberately untyped: tests need to reach private members (decode, setRoutemap, ...)
// that TypeScript would otherwise block even through an intersection with SW_P_08,
// since privacy is enforced against the named declaration regardless of a Record<string, any> mixin.
// biome-ignore lint/suspicious/noExplicitAny: test helper needs access to private members
export type TestableInstance = Record<string, any>

/**
 * Build a SW_P_08 instance wired up to a fake instance context, with config applied
 * and internal state initialised the way `configUpdated` normally would - but without
 * opening a real TCP socket (init_tcp/configUpdated are never called).
 */
export function createTestInstance(configOverrides: Partial<SwP08Config> = {}): {
	instance: TestableInstance
	context: ReturnType<typeof createInstanceContext>
} {
	const context = createInstanceContext()
	const instance = new SW_P_08(context) as unknown as TestableInstance
	instance.config = { ...baseTestConfig, ...configOverrides }
	instance.setupVariables()
	return { instance, context }
}
