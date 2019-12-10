"use strict"

var gulp = require("gulp")

// ━━━━━━━━━━━━━━━━━━━━━━
// Linting for TypeScript
// ━━━━━━━━━━━━━━━━━━━━━━
var tslint = require("gulp-tslint")
gulp.task("tslint", function() {
  return gulp.src([
      "./src/**/*.ts",
      "./test/**/*.ts"
  ])
  .pipe(
    tslint({
      configuration: "./tslint.json",
      fix: true
    })
  )
  .pipe(tslint.report())
})

// ━━━━━━━━━━━━━━━━━━━━━━
// Minify
// ━━━━━━━━━━━━━━━━━━━━━━
// var uglifyes = require("uglify-es")
// var composer = require("gulp-uglify/composer")
// var pump = require("pump")
// var minify = composer(uglifyes, console)
// gulp.task("compress", function (cb) {
//   var options = {}
//   pump([
//       gulp.src("./docs/assets/js/bundle.js"),
//       minify(options),
//       gulp.dest("./docs/assets/js/")
//     ],
//     cb
//   )
// })

// ━━━━━━━━━━━━━━━━━━━━━━
// Build JS/TS
// ━━━━━━━━━━━━━━━━━━━━━━
var exec = require("child_process").exec

gulp.task("buildjs", function (cb) {
  exec("npm run rollup", function (err, stdout, stderr) {
    console.log(stdout)
    console.log(stderr)
    cb(err)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━
// Convert settings
// ━━━━━━━━━━━━━━━━━━━━━━
var Hjson = require("gulp-hjson")
 
gulp.task("convert-hjson-to-json", function() {
  return gulp.src(["./hjson/**/*"])
    .pipe(Hjson({ to: "json" }))
    .pipe(gulp.dest("./docs/assets/json/"))
})


// ━━━━━━━━━━━━━━━━━━━━━━
// Default
// ━━━━━━━━━━━━━━━━━━━━━━
gulp.task("default",
  gulp.series(
    "convert-hjson-to-json",
    "tslint",
    "buildjs"
    //,"compress"
    )
)

// ━━━━━━━━━━━━━━━━━━━━━━
// Launch local server
// ━━━━━━━━━━━━━━━━━━━━━━
var connect = require("gulp-connect")
gulp.task("connect", function() {
  connect.server({
    port: 8000,
    root: "./docs",
    livereload: true,
  })
})
