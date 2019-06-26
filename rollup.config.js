import riot         from 'rollup-plugin-riot'
import nodeResolve  from 'rollup-plugin-node-resolve'
import commonjs     from 'rollup-plugin-commonjs'
import typescript   from 'rollup-plugin-typescript'
import sass         from 'node-sass'
//import uglify       from 'rollup-plugin-uglify'

export default {
  input: 'src/main.ts',
  output: {
    file: 'docs/assets/js/bundle.js',
    format: 'iife'
  },
  plugins: [
    riot({
        parsers:{
            css:{
                scss: function(tagName, css) {
                    var result = sass.renderSync({ data: css })
                    return result.css.toString()
                },
            }
        },
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
    commonjs(),
    //uglify()
  ]
}
