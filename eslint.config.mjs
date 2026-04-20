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
]

export default customConfig
