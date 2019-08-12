import riot         from "rollup-plugin-riot"
import nodeResolve  from "rollup-plugin-node-resolve"
import commonjs     from "rollup-plugin-commonjs"
import typescript   from "rollup-plugin-typescript"

export default {
  input: "src/main.ts",
  output: {
    file: "docs/assets/js/bundle.js",
    format: "iife"
  },
  plugins: [
    riot(),
    nodeResolve({ mainFields: ['module', 'main'] }),
    typescript(),
    commonjs()
  ]
}
