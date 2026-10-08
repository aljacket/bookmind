/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
    root: true,
    // Native shells and generated/spec folders are not linted. `npx cap sync` copies the web bundle into
    // android/ and ios/ (their own .gitignore files are not read by `--ignore-path .gitignore`).
    // Root .gitignore entries (dist/, coverage/, node_modules/, .claude/worktrees/, ...) still apply via the scripts.
    ignorePatterns: ['android/', 'ios/', 'openspec/'],
    extends: [
        'plugin:vue/vue3-recommended',
        'eslint:recommended',
        '@vue/eslint-config-typescript',
        '@vue/eslint-config-prettier'
    ],
    parserOptions: {
        ecmaVersion: 'latest'
    },
    rules: {
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        'vue/multi-word-component-names': 'off'
    }
}
