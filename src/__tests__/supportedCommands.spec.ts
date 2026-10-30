// "Request supported commands" on a router that never answers the protocol
// implementation request (e.g. Lawo VSM) used to leave the module waiting
// forever: names and tally were only requested from the response handler.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cmds, crosspointConfirmDelay, supportedCommandsTimeout } from '../consts.js'
import { createTestInstance } from './testHarness.js'

describe('requestSupportedCommands', () => {
	let instance: any

	beforeEach(() => {
		vi.useFakeTimers()
		instance = createTestInstance({
			supported_commands_on_connect: true,
			read_names_on_connect: true,
			tally_dump_and_update: true,
		}).instance
		instance.sendMessage = vi.fn().mockResolvedValue(undefined)
		instance.readNames = vi.fn().mockResolvedValue(undefined)
		instance.readTally = vi.fn().mockResolvedValue(undefined)
	})

	afterEach(() => {
		instance.clearSupportedCommandsTimer()
		vi.useRealTimers()
	})

	it('reads names and tally anyway when the router never answers', () => {
		instance.requestSupportedCommands()
		expect(instance.sendMessage).toHaveBeenCalledWith([cmds.protocolImplementation])
		expect(instance.readNames).not.toHaveBeenCalled()

		vi.advanceTimersByTime(supportedCommandsTimeout)

		expect(instance.readNames).toHaveBeenCalledTimes(1)
		expect(instance.readTally).toHaveBeenCalledTimes(1)
	})

	it('reads once, straight away, when the router answers in time', () => {
		instance.requestSupportedCommands()
		instance.processMessage(Buffer.from([cmds.protocolImplementationResponse, 0, 0, cmds.crosspointConnect]))

		expect(instance.commands).toEqual([cmds.crosspointConnect])
		expect(instance.readNames).toHaveBeenCalledTimes(1)

		vi.advanceTimersByTime(supportedCommandsTimeout)
		expect(instance.readNames).toHaveBeenCalledTimes(1)
	})
})

describe('SetCrosspoint confirm interrogation', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it('interrogates the crosspoint shortly after connecting it, once per burst', async () => {
		vi.useFakeTimers()
		const instance: any = createTestInstance().instance
		instance.sendMessage = vi.fn().mockResolvedValue(undefined)
		instance.getCrosspoints = vi.fn().mockResolvedValue(undefined)

		await instance.SetCrosspoint(12, 1, 1, instance.primaryMatrix)
		await instance.SetCrosspoint(13, 1, 1, instance.primaryMatrix)
		expect(instance.getCrosspoints).not.toHaveBeenCalled()

		vi.advanceTimersByTime(crosspointConfirmDelay)

		expect(instance.getCrosspoints).toHaveBeenCalledTimes(1)
		expect(instance.getCrosspoints).toHaveBeenCalledWith(1, 1, instance.primaryMatrix)
	})
})
