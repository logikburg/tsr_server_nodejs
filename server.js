#!/usr/bin/env node
require('dotenv-flow').config();
const path = require('path');
var express = require('express')
var compress = require('compression')
var methodOverride = require('method-override')
//var expressMongodbRest = require('./src/raw')
var tsrRest = require('./src/api/tsrRest')
//var login = require('./login')
var http = require('http')
var https = require('https')
var pem = require('pem')
var fs = require('fs')
// var dotenv = require('dotenv')
var bodyParser = require('body-parser');
//var env = require('.env')

// dotenv.load()

var port = normalizePort(process.env.PORT || '3000')
var db = process.env.DB
if (process.env.MONGODB_TEMP_PORT_27017_TCP_ADDR && process.env.MONGODB_TEMP_SERVICE_PORT && process.env.PASS)
  db = 'mongodb://admin:' + process.env.PASS + "@" + process.env.MONGODB_TEMP_PORT_27017_TCP_ADDR + ":" + process.env.MONGODB_TEMP_SERVICE_PORT + "/simpledb1?authSource=admin"
console.info(db)

// recommended to mitigate against BEAST attack (see https://community.qualys.com/blogs/securitylabs/2011/10/17/mitigating-the-beast-attack-on-tls)
var ciphers = 'ECDHE-RSA-AES128-SHA256:AES128-GCM-SHA256:RC4:HIGH:!MD5:!aNULL:!EDH'

try {
  if (process.env.PFX) {
    var options = {
      pfx: fs.readFileSync(process.env.PFX),
      passphrase: process.env.PASSPHRASE,
      ciphers: ciphers,
      honorCipherOrder: true
    }
    createServer(options, port, db)
  } else if (process.env.KEY || process.env.CERT) {
    if (!process.env.KEY) throw 'CERT defined, but KEY is not'
    if (!process.env.CERT) throw 'KEY defined, but CERT is not'
    var options = {
      key: fs.readFileSync(process.env.KEY),
      cert: fs.readFileSync(process.env.CERT),
      passphrase: process.env.PASSPHRASE,
      ciphers: ciphers,
      honorCipherOrder: true
    }
    createServer(options, port, db)
  } else {
    pem.createCertificate({ days: 9999, selfSigned: true }, function (certificate, csr, clientKey, serviceKey) {
      var options = {
        key: serviceKey,
        cert: certificate,
        ciphers: ciphers,
        honorCipherOrder: true
      }
      createServer(options, port, db)
    })
  }
} catch (err) {
  console.error(err.message || err)
}

function createServer(options, port, db) {
  var app, server

  app = express()
  app.use(compress())
  app.use(methodOverride())
  app.use(function (req, res, next) {
    //res.header('Access-Control-Allow-Origin', '*');
    //res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "POST, PUT, GET, OPTIONS, DELETE");
    res.header("Access-Control-Max-Age", "3600");

    res.header("Access-Control-Allow-Headers", "Content-Type, Accept, X-Requested-With, TSRAuth, pragma ");
    //res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, TSRAuth');
    check(req.header("TSRAuth"));
    next();
  });
  //app.use(cookieParser()); // to support cookie
  app.use(bodyParser({ limit: '50mb' }));
  app.use('/healthCheck', require('./src/api/sysCheck'));

  app.use('/api/v1/tsr', tsrRest(db))
  //app.use('/api/logon', login())
  //app.use('/api/v1/ui', require('./src/api/package_ui'));
  app.use(express.static(path.resolve('./', 'build')));
  app.use('/api/v1/request', require('./src/api/request'));
  app.use('/api/v1/user_profiles', require('./src/api/user_profiles'))
  app.use('/api/v1/login', require('./src/api/login'));
  app.use('/api/v1/upload', require('./src/api/uploadfile'))

  app.set('port', port)
  app.set('json spaces', 2)
  app.set('query parser', 'simple')



  server = http.createServer(app)
  server.listen(port, function () {
    var addr = server.address()
    var bind = (typeof addr === 'string') ? 'pipe ' + addr : 'port ' + addr.port
    console.info('Listening on ' + bind)
  })
  console.log("ENV:", process.env.NODE_ENV)
  console.log("DB:", process.env.DB)
  console.log("UPLOAD_API", process.env.UPLOAD_API)
  server.on('error', onError)
}
function check(tsrauth) {
  //console.log("TSR Auth");
  //console.log(tsrauth);
}
function normalizePort(val) {
  var port = parseInt(val, 10);
  if (isNaN(port)) return val
  return (port >= 0) ? port : false
}

function onError(err) {
  if (err.syscall !== 'listen') throw err

  var bind = (typeof port === 'string') ? 'pipe ' + port : 'port ' + port

  switch (err.code) {
    case 'EACCES':
      console.error('EACCESS, ' + bind + ' requires elevated privileges')
      break;
    case 'EADDRINUSE':
      console.error('EADDRINUSE, ' + bind + ' is already in use')
      break;
    default:
      throw err
  }
}
