import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['src/**/*.spec.ts'],
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.spec.ts', 'src/**/__tests__/**'],
		},
	},
})
