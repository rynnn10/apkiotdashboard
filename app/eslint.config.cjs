module.exports = {
    env: { browser: true, es2021: true },
    extends: "eslint:recommended",
    parserOptions: { ecmaVersion: 'latest' },
    rules: { "no-unused-vars": "off", "no-undef": "off", "no-constant-condition": "off" }
};
