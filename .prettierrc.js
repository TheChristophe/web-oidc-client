/** @type {import("prettier").Config} */
const config = {
  $schema: 'https://json.schemastore.org/prettierrc',
  tabWidth: 2,
  singleQuote: true,
  printWidth: 100,
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrder: ['<THIRD_PARTY_MODULES>', '^@', '^(assets|components|lib|pages)/.*', '^[./]'],
  overrides: [
    {
      files: ['*.js', '*.ts', '*.mjs'],
      options: {
        parser: 'babel-ts',
      },
    },
  ],
};

export default config;
