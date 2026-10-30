import { describe, expect, it } from 'vitest'
import type { SwP08Config } from '../config.js'
import { UpdatePresets } from '../presets.js'
import { createTestInstance } from './testHarness.js'

/** Build presets for a router with the given port names, on matrix 1 unless the config says otherwise. */
function buildPresets(config: Partial<SwP08Config>, sources: string[], dests: string[]) {
	const { instance, context } = createTestInstance(config)
	for (const m of instance.matrices) {
		sources.forEach((label, i) => instance.sourceNamesForMatrix(m.id).set(i + 1, { id: i + 1, label }))
		dests.forEach((label, i) => instance.destNamesForMatrix(m.id).set(i + 1, { id: i + 1, label }))
	}
	UpdatePresets(instance as never)
	const [structure, presets] = context.setPresetDefinitions.mock.calls.at(-1) as [any[], Record<string, any>]
	return { crosspoints: structure.filter((s) => s.id.startsWith('crosspoints_')), presets }
}

describe('crosspoint presets', () => {
	const sources = ['1: Cam 1', '2: N/C', '3: Spare']
	const dests = ['1: Mon', '2: N/C']

	it('are off by default', () => {
		const { crosspoints, presets } = buildPresets({}, sources, dests)

		expect(crosspoints).toEqual([])
		expect(Object.keys(presets).filter((id) => id.startsWith('crosspoint_'))).toEqual([])
	})

	it('generate a section per level, a group per destination and a button per source', () => {
		const { crosspoints, presets } = buildPresets({ crosspoint_presets: true, max_levels: 2 }, sources, dests)

		expect(crosspoints.map((s) => s.id)).toEqual(['crosspoints_matrix_1_level_1', 'crosspoints_matrix_1_level_2'])
		const groups = crosspoints[1].definitions
		expect(groups).toHaveLength(1)
		expect(groups[0].commonVariableValues).toEqual({ matrix: 1, level: 2, dest: 1, show_dest_name: '', bg_color: '' })
		expect(groups[0].templateValues.map((v: { value: number }) => v.value)).toEqual([1, 3])
		expect(presets[groups[0].presetId]).toBeDefined()
	})

	it('leave out the configured port names', () => {
		const { crosspoints } = buildPresets({ crosspoint_presets: true, unused_port_names: 'spare' }, sources, dests)

		expect(crosspoints[0].definitions.map((g: { name: string }) => g.name)).toEqual(['To 1: Mon', 'To 2: N/C'])
		expect(crosspoints[0].definitions[0].templateValues.map((v: { value: number }) => v.value)).toEqual([1, 2])
	})

	it('generate a section per configured matrix', () => {
		const { crosspoints } = buildPresets(
			{ crosspoint_presets: true, matrices: '3:Video, 4:Audio', max_levels: 1 },
			sources,
			dests,
		)

		expect(crosspoints.map((s) => s.name)).toEqual(['Crosspoints Video Level 1', 'Crosspoints Audio Level 1'])
	})

	it('skip a matrix with no usable ports', () => {
		const { crosspoints } = buildPresets({ crosspoint_presets: true }, ['N/C'], dests)

		expect(crosspoints).toEqual([])
	})
})
