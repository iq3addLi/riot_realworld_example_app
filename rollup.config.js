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
    riot({
        parserOptions:{
            js: {
                module: 5, //commonjs
                babelrc: false,
                presets: ["es2015-riot", ["latest-node6", { "es2015": false }]],
                plugins: ["add-module-exports", "transform-runtime"],
            }
        }
    }),
    nodeResolve({ jsnext: true }),
    typescript(),
    commonjs()
  ]
}
