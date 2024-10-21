module.exports = {
    root: true,
    env: {
        es2020: true,
    },
    ignorePatterns: ["/*.js", "/*.cjs", "public/*", "node_modules"],
    parser: "@typescript-eslint/parser",
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:sonarjs/recommended-legacy",
        "plugin:jsx-a11y/recommended",
        "plugin:unicorn/recommended",
        "plugin:import/recommended",
        "plugin:import/typescript",
        "plugin:prettier/recommended",
    ],
    plugins: ["import", "@typescript-eslint", "simple-import-sort", "unicorn", "sonarjs"],
    rules: {
        // Common
        "no-implicit-coercion": "error",
        "no-console": "warn",
        "no-param-reassign": [
            "error",
            {
                props: false,
            },
        ],
        "no-restricted-syntax": ["error", "ForInStatement", "LabeledStatement", "WithStatement"],

        // complexity
        complexity: ["error", 10],
        "max-depth": "error",
        "max-nested-callbacks": "error",

        // Sorting and order
        "sort-keys": [
            "error",
            "asc",
            { caseSensitive: true, natural: true, minKeys: 2, allowLineSeparatedGroups: true },
        ],
        "@typescript-eslint/member-ordering": [
            "error",
            {
                default: {
                    order: "natural",
                },
            },
        ],

        // Typescript
        "@typescript-eslint/no-unused-vars": [
            "error",
            {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            },
        ],
        "@typescript-eslint/naming-convention": [
            "error",
            {
                selector: "typeLike",
                format: ["StrictPascalCase"],
            },
            {
                selector: "interface",
                format: ["StrictPascalCase"],
                custom: {
                    regex: "^I[A-Z]",
                    match: false,
                },
            },
            {
                selector: "typeParameter",
                format: ["PascalCase"],
            },
        ],
        "@typescript-eslint/consistent-type-definitions": ["error", "type"],

        // Import
        "import/order": "off",
        "import/no-named-as-default-member": "off",
        "import/namespace": "off",
        "import/no-cycle": "error",
        "import/prefer-default-export": ["error", { target: "single" }],
        "import/exports-last": "error",

        // Simple import
        "simple-import-sort/imports": [
            "error",
            {
                groups: [["^test", "^ignition", "^@?\\w", "^\\u0000", "^."]],
            },
        ],
        "simple-import-sort/exports": "error",

        // Unicorn
        "unicorn/no-useless-undefined": "off",
        "unicorn/no-array-reduce": "off",
        "unicorn/prefer-top-level-await": "off",
        "unicorn/prefer-module": "off",
        "unicorn/no-array-callback-reference": "off",
        "unicorn/no-null": "off",
        "unicorn/filename-case": [
            "error",
            {
                cases: {
                    pascalCase: true,
                    camelCase: true,
                },
            },
        ],
        "unicorn/prevent-abbreviations": [
            "error",
            {
                replacements: {
                    args: false,
                },
            },
        ],
    },
    settings: {
        "import/resolver": {
            typescript: {
                project: ["./tsconfig.json", "./applications/*/tsconfig.json"],
            },
        },
    },
};
