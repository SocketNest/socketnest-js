const terser = require("@rollup/plugin-terser")
const resolve = require("@rollup/plugin-node-resolve")
const commonjs = require("@rollup/plugin-commonjs")
const replace = require("@rollup/plugin-replace")
const typescript = require("@rollup/plugin-typescript")

module.exports = {
	input: "src/browser.ts",
	output: {
		file: "socketnest.bundle.js",
		format: "umd",
		name: "Socketnest",
		sourcemap: true,
	},
	plugins: [
		typescript({ 
			tsconfig: './tsconfig.json',
			compilerOptions: {
				module: "esnext",
				importHelpers: true,
				outDir: ".", // Set outDir to current directory to match Rollup output
				declaration: false // Disable declaration file generation for browser build
			}
		}),
		replace({
			"process.env.NODE_ENV": JSON.stringify("production"),
			preventAssignment: true,
		}),
		resolve({ browser: true }),
		commonjs(),
		terser(),
	],
}