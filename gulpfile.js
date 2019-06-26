"use strict"

var gulp   = require("gulp")

// ━━━━━━━━━━━━━━━━━━━━━━
// Linting for TypeScript
// ━━━━━━━━━━━━━━━━━━━━━━
var tslint   = require("gulp-tslint")
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
// Build JS/TS
// ━━━━━━━━━━━━━━━━━━━━━━
var exec = require('child_process').exec

gulp.task('buildjs', function (cb) {
  exec('npm run rollup', function (err, stdout, stderr) {
    console.log(stdout)
    console.log(stderr)
    cb(err)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━
// Transepile Sassy CSS
// ━━━━━━━━━━━━━━━━━━━━━━
function exceptionLog (error) {
  console.log(error.toString())
  this.emit('end')
}

var sass = require('gulp-sass')
gulp.task('styles', function () {
  return gulp.src('./styles/styles.scss')
    .pipe(sass.sync({
            outputStyle: 'expanded'
        }).on('error', sass.logError))
    .pipe(gulp.dest('./docs/assets/styles/'))
    .on('error', exceptionLog)
})

// ━━━━━━━━━━━━━━━━━━━━━━
// Convert settings
// ━━━━━━━━━━━━━━━━━━━━━━
var Hjson = require('gulp-hjson')
 
gulp.task('convert-hjson-to-json', function() {
  return gulp.src(['./hjson/**/*'])
    .pipe(Hjson({ to: 'json' }))
    .pipe(gulp.dest('./docs/assets/json/'))
})

// ━━━━━━━━━━━━━━━━━━━━━━
// Make settings with env
// ━━━━━━━━━━━━━━━━━━━━━━
var replace = require('gulp-replace')
var env = require('node-env-file')
env('.env')

gulp.task('make-settings', function() {
  return gulp
          .src(['./settings.hjson'])
          // .pipe(replace('%%GOOGLE_MAP_API_KEY%%', process.env.GOOGLE_MAP_API_KEY))
          // .pipe(replace('%%GOOGLE_ANALYTICS_ID%%', process.env.GOOGLE_ANALYTICS_ID))
          .pipe(gulp.dest('./hjson/'))
})

// ━━━━━━━━━━━━━━━━━━━━━━
// Copy font from node_module to docs
// ━━━━━━━━━━━━━━━━━━━━━━
gulp.task('copy-font', function() {
  var paths = [
    {
      src: './node_modules/open-sans-fonts/open-sans/**/OpenSans-*.*',
      dest: './docs/assets/fonts/open-sans/'
    },
    {
      src: './node_modules/@fortawesome/fontawesome-free/webfonts/*',
      dest: './docs/assets/fonts/fontawesome-free/'
    }
  ]
  var stream
  for(var path of paths){
    stream = gulp.src(path.src)
        .pipe(gulp.dest(path.dest))
  }
  return stream
})

// ━━━━━━━━━━━━━━━━━━━━━━
// Default
// ━━━━━━━━━━━━━━━━━━━━━━
gulp.task("default",
  gulp.series(
    'make-settings',
    "convert-hjson-to-json",
    "tslint",
//    "copy-font",
    gulp.parallel("buildjs", "styles")
  )
)

// ━━━━━━━━━━━━━━━━━━━━━━
// Launch test server
// ━━━━━━━━━━━━━━━━━━━━━━
var connect = require('gulp-connect')
gulp.task('connect', function() {
  connect.server({
    root: './docs',
    livereload: true
  })
})
