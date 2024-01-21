import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

// @ts-expect-error types are out of date
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

/** @typedef { import('rollup').RollupOptions } RollupOptions */

/**
 * @type RollupOptions
 */
const rollupOptions = {
  input: 'src/index.ts',
  output: [
    {
      dir: 'dist',
      format: 'es',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
    },
  ],
  plugins: [peerDepsExternal(), resolve(), typescript({ tsconfig: './tsconfig.json' }), terser()],
  // can't use /node_modules/ because tslib will break, but the difference is 1kb so we're fine
  external: ['tslib'],
};

export default rollupOptions;
