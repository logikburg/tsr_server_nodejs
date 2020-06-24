'use strict';
//let mongoose = require('../mongoose');
let express = require('express');
//var app = express();
let router = express.Router();
var querystring = require('querystring');
var http = require('http');
var jwt = require('jsonwebtoken');
//var controller = require("../routes");
const ActiveDirectory = require('activedirectory2');

//const session = require('express-session')
//const MongoStore = require('connect-mongo')(session)
//const bodyParser = require('body-parser')
/*
var db = mongoose.connection;
var UserSessionSchema = mongoose.Schema({
    loginid: String,
    fullname: String,
    email: String,
    displayname: String,
    authenticated: Boolean,
    token: String,
    timestamp: Date
});
var UserSession = mongoose.model('UserSession', UserSessionSchema, 'v1-dat-usersessions');
db.on('error', console.error.bind(console, 'connection error:'));
*/
/*
db.once('open', function () {
    console.log("Connection Successful!");

   
});
*/
/*
const config = require('../config');
let env = config.env || 'dev';
var sessionSecret = config[env].sessionSecret;
console.log('sessionSecret:', sessionSecret)

var sessionMiddleWare = session({
    secret: sessionSecret,
    store: new MongoStore({ mongooseConnection: mongoose.connection }),
    resave: true,
    saveUninitialized: true,
    unset: 'destroy',
    cookie: {
        httpOnly: false,
        maxAge: 1000 * 3600 * 24,
        secure: false, // this need to be false if https is not used. Otherwise, cookie will not be sent.
    }
})
app.use(bodyParser.json())
app.use(sessionMiddleWare);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
*/

router.post('/login', function (req, response) {
  //console.log('Logging IN...req: ', req);
  var user_name = req.body.user;
  /*
    if (!user_name) {
      return;
    }
  */

  //console.log('Name: ' + user_name);

  // Access the session as req.session
  var post_data = querystring.stringify({
    'userName': req.body.user,
    'domain': 'corp',
    'password': req.body.password
  });
  // An object of options to indicate where to post to
  var post_options = {
    //host: 'o1-itsm-app1',
    //host: 'o1-pc-chrischin',
    //host: 't1-itsm-app1',
    host: 'itsm-app1',
    port: '80',
    path: '/dbsAccess/dbUser.asmx/CheckUserToString',
    //path: '/apiServer/dbUser.asmx/CheckUserToString',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(post_data)
    }
  };
  // Set up the request
  var result
  var delString1 = '<?xml version="1.0" encoding="utf-8"?>';
  var delString2 = '<string xmlns="http://tempuri.org/">';
  var delString3 = '</string>';
  var delString4 = '"u0026';
  var displayName;
  var post_req = http.request(post_options, function (res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      //console.log('result chunk: ' + chunk);
      if (chunk.indexOf("xml") >= 0) {
        result = chunk;

        if (chunk.indexOf("</string>") < 0) {
          return true;
        }
      } else {
        result = result + chunk;
        if (chunk.indexOf("</string>") < 0) {
          return true;
        }

      }

      //console.log('** result joined: ' + result);

      result = result.replace(delString1, '');
      result = result.replace(delString2, '');
      result = result.replace(delString3, '');
      result = result.replace(/"/g, '');
      result = result.replace(/\\/g, '"');
      result = result.replace(delString4, '&');

      console.log('result: ' + result); //tsting
      //console.log('user_raw: ' + req.body.user); //tsting

      const json = JSON.parse(result);
      displayName = json.displayname;
      console.log('displayName: ' + displayName);

      var sessData = req.session;
      console.log('session: ' + sessData);

      if (!displayName) {
        /*
        sessData.authenticated = false;

        sessData.userid = '';
        sessData.displayname = '';
        sessData.email = '';
        sessData.fullname = '';
        delete req.session;
*/
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.status(403).send('Wrong username or password!');
        //response.send('Login Failed!');
        //response.end("yes");
        //response.redirect('/login');

        console.log('Unauthorised! ');

      } else {
        /*
                        sessData.authenticated = true;
        
                        sessData.userid = json.loginid;
                        sessData.displayname = json.displayname;
                        sessData.email = json.email;
                        sessData.fullname = json.fullname;
        
        */

        //Making JWT (JSON Web Token)
        /*
        var header = '{"typ": "JWT","alg": "HS256"}';
        var payload = JSON.stringify(json);
        var data = header.toString('base64') + '.' + payload.toString('base64');
        var signature = Hash( data, 'My secret' );
        json.token = data + '.' + signature;
        */
        var token = jwt.sign({
          loginid: json.loginid,
          fullname: json.fullname,
          email: json.email,
          displayname: json.displayname,
          authenticated: true, timestamp: Date()
        }, 'My secret');
        json.token = token;

        //sessData.token = json.token;

        /*
                        // a document instance
                        var user1 = new UserSession({
                            loginid: json.loginid,
                            fullname: json.fullname,
                            email: json.email,
                            displayname: json.displayname,
                            authenticated: true, token: json.token, timestamp: Date()
                        });
        */
        /*
        // save model to database
        user1.save(function (err, book) {
          if (err) return console.error(err);
          console.log(user1.displayname + " saved to user session.");
        });
*/



        //response.sendStatus(200);
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Access-Control-Allow-Origin', '*');

        var strUserDetails = JSON.stringify(json);
        response.status(200).send(strUserDetails);
        response.end();
        //response.end("yes");

        //response.send(result);
        //response.end("yes");
        //response.redirect('/logout');

        //res.redirect('/tsr');
        //console.log('Del1: ' + delString1);
        console.log('Response: ' + strUserDetails);
        //console.log('Name: ' + displayName);
      }



    });
  });

  // post the data
  post_req.write(post_data);
  /*
      // you might like to do a database look-up or something more scalable here
      if (req.body.username && req.body.username === 'user' && req.body.password && req.body.password === 'pass') {
        req.session.authenticated = true;
        res.redirect('/secure');
      } else {
        req.flash('error', 'Username and password are incorrect');
        res.redirect('/login');
      }
  */
});


router.post('/loginLDAP', function (req, response) {
  //console.log('Logging IN...req: ', req);
  var user_nameEN = req.body.eqi;
  /*
    if (!user_name) {
      return;
    }
  */
  // Nodejs encryption with CTR
  const crypto = require('crypto');
  const algorithm = 'aes-256-cbc';
  const keyStr = 'THR8Yrrc4IyFE1iyefy0rpZjHgwnNolcqiSuv1MjUPY=';  //crypto.randomBytes(32);
  let buff = new Buffer(keyStr, 'base64');
  //let key = buff.toString('ascii');
  //let key = crypto.randomBytes(32);
  //let enKey = key.toString('hex');
  let key = Buffer.from('43d819b013319fa2f64f67128392b22bca09bbb1e0e73d87459f784e1ec6ff65', 'hex')

  //const ivStr = 'ttkL/DfsleX6 hNyb6285nQ=='; //const iv = crypto.randomBytes(16);
  //let ivBuff = new Buffer(ivStr, 'base64');
  //let iv = ivBuff.toString('ascii');
  //let iv = crypto.randomBytes(16);
  //let enIV = iv.toString('hex');
  let iv = Buffer.from('fd96ceb33b90a1b8b4d3bc26b93ad265', 'hex')

  function encrypt(text) {
    let cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    //return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
    return encrypted.toString('hex');
  }

  function decrypt(text) {
    //let iv = Buffer.from(text.iv, 'hex');
    //let encryptedText = Buffer.from(text.encryptedData, 'hex');
    let encryptedText = Buffer.from(text, 'hex');
    let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }


  //var hw = encrypt(password);
  //let hwBuff = new Buffer(hw.toString());
  //var strHw = hwBuff.toString('base64');
  //Back
  //let buffBack = new Buffer(strHw, 'base64');
  //let textBack = buffBack.toString('ascii');

  //var decryPW = decrypt(hw);
  //var hw = encrypt(password);
  //var strHw = hw.toString('base64');
  //console.log('user_name: ' + user_name)
  //console.log('encryPW: ' + req.body.password)
  const encPW = req.body.equ;  //crypto.randomBytes(32);
  //let decryBuff = new Buffer(decryStr, 'base64');
  let decryPW = decrypt(encPW);
  decryPW = decryPW.substring(0, decryPW.length - 6)
  //console.log('decryPW: ' + decryPW)
  let user_name = decrypt(user_nameEN);
  user_name = user_name.substring(0, user_name.length - 6)
  //var hw = decrypt(req.body.password);
  //console.log('decryPW: ' + decryPW)
  //console.log('encry: ' + req.body.password)
  //console.log('org: ' + hw)



  var config = {
    url: process.env.LDAP_URL,
    baseDN: 'dc=corp,dc=ha,dc=org,dc=hk',
    username: user_name + '@corp.ha.org.hk',
    password: decryPW,
    tlsOptions: { 'rejectUnauthorized': false }
  }
  var ad = new ActiveDirectory(config);

  var sAMAccountName = user_name;  //'wky405';
  // Find user by a sAMAccountName
  var ad = new ActiveDirectory(config);
  ad.findUser(sAMAccountName, function (err, user) {
    console.log('Start: ' + JSON.stringify(user));

    if (err) {
      console.log('ERROR: ' + JSON.stringify(err));
      return;
    }

    var displayName = "";

    if (!user) console.log('User: ' + sAMAccountName + ' not found.');
    else {
      //console.log(JSON.stringify(user));
      //const json = JSON.parse(user);
      displayName = user.displayName;
    }
    //----
    console.log('displayName: ' + displayName);


    //====
    if (!displayName) {
      /*
      sessData.authenticated = false;

      sessData.userid = '';
      sessData.displayname = '';
      sessData.email = '';
      sessData.fullname = '';
      delete req.session;
*/
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.status(403).send('Wrong username or password!');
      //response.send('Login Failed!');
      //response.end("yes");
      //response.redirect('/login');

      console.log('Unauthorised! ');

    } else {
      /*
                      sessData.authenticated = true;
      
                      sessData.userid = json.loginid;
                      sessData.displayname = json.displayname;
                      sessData.email = json.email;
                      sessData.fullname = json.fullname;
      
      */

      //Making JWT (JSON Web Token)
      /*
      var header = '{"typ": "JWT","alg": "HS256"}';
      var payload = JSON.stringify(json);
      var data = header.toString('base64') + '.' + payload.toString('base64');
      var signature = Hash( data, 'My secret' );
      json.token = data + '.' + signature;
      */
      var token = jwt.sign({
        loginid: user.sAMAccountName,
        fullname: user.sn + ' ' + user.givenName,
        email: user.mail,
        displayname: user.displayName,
        equ: encPW,
        authenticated: true, timestamp: Date()
      }, 'My secret');
      user.token = token;

      //sessData.token = json.token;

      /*
                      // a document instance
                      var user1 = new UserSession({
                          loginid: json.loginid,
                          fullname: json.fullname,
                          email: json.email,
                          displayname: json.displayname,
                          authenticated: true, token: json.token, timestamp: Date()
                      });
      */
      /*
      // save model to database
      user1.save(function (err, book) {
        if (err) return console.error(err);
        console.log(user1.displayname + " saved to user session.");
      });
*/



      //response.sendStatus(200);
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Access-Control-Allow-Origin', '*');

      var strUserDetails = JSON.stringify(user);
      response.status(200).send(strUserDetails);
      response.end();
      //response.end("yes");

      //response.send(result);
      //response.end("yes");
      //response.redirect('/logout');

      //res.redirect('/tsr');
      //console.log('Del1: ' + delString1);
      console.log('Response: ' + strUserDetails);
      //console.log('Name: ' + displayName);
    }

  });


  //console.log('Name: ' + user_name);

});

module.exports = router;