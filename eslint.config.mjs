import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const baseConfig = await generateEslintConfig({
	enableTypescript: true,
})

const customConfig = [
	...baseConfig,
	{
		languageOptions: {
			sourceType: 'module',
		},
	},
	{
		files: ['**/*.spec.ts', '**/*.test.ts', 'vitest.config.ts'],
		rules: {
			'n/no-unpublished-import': [
				'error',
				{
					allowModules: ['vitest'],
				},
			],
		},
	},
]

export default customConfig
