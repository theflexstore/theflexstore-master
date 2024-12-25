var webdriver = require('selenium-webdriver'),
    By = require('selenium-webdriver').By,
    until = require('selenium-webdriver').until,
    browsers = {
      firefox: require('selenium-webdriver/firefox'),
      chrome: require('selenium-webdriver/chrome'),
      phantomjs: require('selenium-webdriver/phantomjs')
    };

var driver;
if (process.env.CI && process.env.BROWSER) {
  var browser = process.env.BROWSER.split(':');
  var server = 'http://localhost:4445/wd/hub';
  var caps = new webdriver.Capabilities();
  caps.set('browserName', browser[0]);
  if (browser[1]) caps.set('version', browser[1]);
  if (browser[2]) caps.set('platform', browser[2]);
  caps.set('tunnel-identifier', process.env.TRAVIS_JOB_NUMBER);
  caps.set('name', 'Travis #' + process.env.TRAVIS_JOB_NUMBER);
  caps.set('build', process.env.TRAVIS_BUILD_NUMBER);
  driver = new webdriver.Builder().usingServer(server).withCapabilities({
    username: process.env.SAUCE_USERNAME,
    accessKey: process.env.SAUCE_ACCESS_KEY,
    browserName: browser[0],
    version: browser[1] || null,
    platform: browser[2] || null,
    build: process.env.TRAVIS_BUILD_NUMBER,
    name: 'Travis #' + process.env.TRAVIS_JOB_NUMBER,
    'tunnel-identifier': process.env.TRAVIS_JOB_NUMBER,
  }).build();

  // launch local server
  var connect = require('connect');
  var serveStatic = require('serve-static');
  connect().use(serveStatic(__dirname)).listen(9095, '127.0.0.1', function() {
    begin('http://localhost:9095/runner.html');
  });
} else {
  driver = new browsers[process.env.BROWSER || 'phantomjs'].Driver();
  begin('file://' + __dirname + '/runner.html');
}

var index = 0, failed = 0;
function poll() {
  var script = 'return typeof jsApiReporter === "object" ? ' +
    '[jsApiReporter.finished, jsApiReporter.specs()] : [false, []]';
  driver.executeScript(script).then(function(result) {
    var isDone = result[0], items = result[1];
    for (; index < items.length; index++) {
      if (items[index] === 'pending') break;
      var item = '';
      switch (items[index].status) {
        case 'skipped': item = 'S'; break;
        case 'passed':  item = '.'; break;
        case 'failed':  failed++; item = 'X'; break;
      }
      process.stdout.write(item);
    }
    if (isDone) {
      console.log('\n\n' + index + ' specs, ' + failed + ' failures');
      if (failed > 0) printErrors(items);
      driver.quit().then(function() { process.exit(failed); });
    } else {
      setTimeout(poll, 10);
    }
  });
}

function printErrors(items) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.status === 'failed') {
      for (var f = 0; f < item.failedExpectations.length; f++) {
        var fail = item.failedExpectations[f];
        console.log('\n' + (i+1) + '.' + (f+1) + ') ' + item.fullName + '\n');
        console.log(fail.message);

        if (fail.stack && fail.stack !== '') {
          console.log('');
          var stack = fail.stack.split('\n');
          for (var x = 0; x < 6 && x < stack.length; x++) {
            console.log('    ' + stack[x].trim());
          }
          if (stack.length > 6) {
            console.log('    ...');
          }
        }
      }
    }
  }
  console.log('');
}

function begin(url) {
  driver.get(url).then(poll);
}
