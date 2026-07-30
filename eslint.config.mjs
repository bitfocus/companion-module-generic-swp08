import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'
import tseslint from 'typescript-eslint'

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
		// vitest.config.ts lives outside of tsconfig.json's rootDir (./src), so it can't
		// be type-checked against the project - lint it without type information instead.
		files: ['vitest.config.ts'],
		...tseslint.configs.disableTypeChecked,
	},
	{
		// Test-only files aren't published, so devDependencies like vitest are fine to import here.
		files: ['vitest.config.ts', 'src/**/*.spec.ts', 'src/**/__tests__/**'],
		rules: {
			'n/no-unpublished-import': 'off',
		},
	},
]

export default customConfig
