module.exports = {
	// Indicates whether the coverage information should be collected
	collectCoverage: false,

	// The directory where Jest should output its coverage files
	coverageDirectory: "coverage",

	// Indicates which provider should be used to instrument code for coverage
	coverageProvider: "v8",

	// A list of reporter names that Jest uses when writing coverage reports
	coverageReporters: ["json", "text", "lcov", "clover"],

	// A list of paths to directories that Jest should use to search for test files
	testMatch: ["**/tests/**/*.test.js"],

	// The test environment that will be used for testing
	testEnvironment: "node",

	// Automatically clear mock calls, instances and results before every test
	clearMocks: true,

	// The maximum amount of workers used to run your tests
	maxWorkers: "50%",

	// An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
	testPathIgnorePatterns: ["/node_modules/"],

	// Indicates whether each individual test should be reported during the run
	verbose: true,

	// Default timeout in milliseconds
	testTimeout: 30000,

	// Create folder for manual mocks
	moduleDirectories: ["node_modules", "tests"],

	// Transform files to CommonJS for testing
	transform: {
		"^.+\\.js$": "babel-jest",
	},

	// Default babel configuration if not specified elsewhere
	transformIgnorePatterns: ["/node_modules/"],

	// Support for both ESM and CommonJS modules
	moduleFileExtensions: ["js", "json", "node"],
}
