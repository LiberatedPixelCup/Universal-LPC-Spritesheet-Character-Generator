/* To eslint: npm i and run eslint . or set it up to automatically run in your IDE */

module.exports = {
	extends: "eslint:recommended",
	parser: "@babel/eslint-parser",
	parserOptions: {
		requireConfigFile: false,
		ecmaVersion: "latest", // Enables all ES6+ syntax
		sourceType: "commonjs", // Treats the code as ES module files (import/export)
	},
	env: {
		node: true, // Enables Node.js global variables and Node.js scoping
		browser: false, // Enables browser global variables (window, document, etc.)
		es6: true, // Enables ES6 global variables and syntax
	},
	ignorePatterns: ["sources/jszip.min.js", "sources/jhash-2.2.min.js"],
  rules: {
    "no-unused-vars": "warn",
    "no-useless-escape": "off",
    "no-console": "off",  
  },
	overrides: [
		{
			files: ["sources/**/*.js", "item-metadata.js"],
			excludedFiles: ["sources/jszip.min.js"],
			extends: "eslint:recommended",
			parserOptions: {
				ecmaVersion: "latest", // Enables all ES6+ syntax
				sourceType: "module", // Treats the code as ES module files (import/export)
			},
			env: {
				node: false, // Disables Node.js global variables and Node.js scoping
				browser: true, // Enables browser global variables (window, document, etc.)
				es6: true, // Enables ES6 global variables and syntax
			},
			globals: {
				m: "readonly",
			},
      rules: {
        "no-unused-vars": "warn",
        "no-useless-escape": "off",
        "no-console": "off",  
      },
		},
		{
			files: ["tests/**/*.js"],
			extends: "eslint:recommended",
			parserOptions: {
				ecmaVersion: "latest", // Enables all ES6+ syntax
				sourceType: "module", // Treats the code as ES module files (import/export)
			},
			env: {
				node: false, // Disables Node.js global variables and Node.js scoping
				browser: true, // Enables browser global variables (window, document, etc.)
				es6: true, // Enables ES6 global variables and syntax
        mocha: true, // Enables Mocha testing global variables (describe, it, etc.)
			},
      globals: {
        m: "readonly",
      }
		}
	],
};
