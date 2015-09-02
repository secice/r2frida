#!/usr/bin/env node
/*
** Commandline entrypoint for `ratafia` (r2 + Frida)
** --pancake 2015
*/

var spawnSync = require('child_process').spawnSync;
var colors = require('colors');
var frida = require('frida');
var fs = require('fs');
var getRemoteDevice = frida.getRemoteDevice;

/* actions */

const helpmsg = 'Usage: r2frida [-h|-v] [-UR] [-f adb|ip:port] [-a,-k app] [-n|-s] [-l|-L|procname|pid]';

function alignColumn(arr, col) {
  var str = arr[0];
  for (var i = 1; i < arr.length; i++) {
    var word = '' + (arr[i - 1] || '');
    var curlen = word.length;
    var curcol = (col * i) + curlen;
    var curnex = col * (i + 1);
    var left = (curnex > curcol) ? curnex - curcol : 1;
    str += new Array(left).join(' ');
    str += arr[i];
  }
  return str;
}

const Option = {
  useRemote: function() {
    getRemoteDevice = frida.getRemoteDevice;
    return false;
  },
  useUsb: function() {
    getRemoteDevice = frida.getUsbDevice;
    return false;
  },
  showLongHelp: function() {
    die([helpmsg,
      ' -a [app|pid]  attach (default if no flags)',
      ' -f [adb|ip:p] forward port to frida-server',
      ' -k [app|pid]  remote kill application',
      ' -l            list processes',
      ' -L            list applications',
      ' -n            batch mode no prompt',
      ' -s            enter the r2node shell',
      ' -R            remote via TCP',
      ' -U            remote via USB',
      ' -S [appname]  spawn new app',
      ' -v            show version information'
    ].join('\n'));
  },
  showHelp: function() {
    die(helpmsg, 0);
  },
  showVersion: function() {
    const package_json = '' + fs.readFileSync('../package.json');
    const version = JSON.parse(package_json).version;
    die(version, 0);
  },
  enterShell: function(target) {
    target && exec(process.execPath, ['main.js', target]);
    die('Missing target', 1);
  },
  enterBatchShell: function(target) {
    target && exec(process.execPath, ['main.js', '-n', target]);
    die('Missing target', 1);
  },
  forwardPort: function(target) {
    target || die('Missing target', 1);
    if (target == 'adb') {
      exec('adb', ['forward', 'tcp:27042', 'tcp:27042']);
    } else {
      var hostport = target.split(':');
      if (hostport.length != 1) {
        var host = hostport[0];
        var port = hostport[1];
        exec('ssh', ['-p' + port, '-L', '27042:localhost:27042', 'root@' + host]);
      } else {
        exec('ssh', ['-L', '27042:localhost:27042', 'root@' + target]);
      }
    }
    exec('r2', ['r2pipe://node r2io-frida.js ' + target]);
  },
  startR2: function(target) {
    exec('r2', ['r2pipe://node r2io-frida.js ' + target]);
  },
  killProcess: function(pid) {
    getRemoteDevice().then(function(device) {
      device.kill(pid);
    });
  },
  spawnAndAttach: function(app) {
    getRemoteDevice().then(function(device) {
      var lala = device.spawn(["/bin/ls"]); //Applications/Calculator.app/Calculator"]);
      startR2(lala);
    });
  },
  listProcesses: function() {
    getRemoteDevice().then(function(device) {
      device.enumerateProcesses().then(function(procs) {
        for (var i in procs.reverse()) {
          var p = procs[i];
          console.log(alignColumn([p.pid, p.name], 16));
        }
      })
    });
  },
  listApplications: function() {
    getRemoteDevice().then(function(device) {
      device.enumerateApplications().then(function(procs) {
        for (var i in procs.reverse()) {
          var p = procs[i];
          console.log(alignColumn([p.pid, p.name, p.identifier], 16));
        }
      })
    });
  }
}

/* main */

Main(process.argv.slice(2), {
  '-h': Option.showLongHelp,
  '-a': Option.startR2,
  '-S': Option.spawnAndAttach,
  '-v': Option.showVersion,
  '-s': Option.enterShell,
  '-n': Option.enterBatchShell,
  '-f': Option.forwardPort,
  '-k': Option.killProcess,
  '-l': Option.listProcesses,
  '-L': Option.listApplications,
  '-R': Option.useRemote,
  '-U': Option.useUsb
});

function Main(argv, options) {
  var target = undefined;
  process.chdir(__dirname + '/../src');
  for (var i in argv) {
    var opt = options [argv[+i]];
    if (opt) {
      if (opt(argv[1+i]) !== false) {
        return;
      }
    }
    if (target) {
      die("Invalid parameter: '" + argv[+i] + "'", 1);
    }
    if (argv[i][0] != '-')
      target = argv[+i];
  }
  target && Option.startR2(target);
  Option.showHelp();
}

/* utils */

function die(msg, ret) {
  var println = ret ? console.error : console.log;
  var color = ret ? colors.red : colors.yellow;
  println(color(msg));
  process.exit(ret);
}

function exec(cmd, args) {
  var res = spawnSync(cmd, args, {
    stdio: [0, 1, 2]
  });
  process.exit(res.status);
}
