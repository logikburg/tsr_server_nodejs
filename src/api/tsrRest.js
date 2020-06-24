var express = require('express')
var mongoskin = require('mongoskin')
var ObjectID = require('mongodb').ObjectID
var patch2m = require('jsonpatch-to-mongodb')
var query2m = require('query-to-mongo')
var bodyParser = require('body-parser')
var inflector = require('inflection')
var normalizedPath = require("path").join(__dirname, "routes");
var controller = require("../routes");
var querystring = require('querystring');
var http = require('http');

module.exports = function tsrRest(db, options) {
  var router

  if (!db) throw new TypeError('db required')
  //if (typeof db === 'string') db = mongoskin.db(db, { safe: true })
  if (typeof db === 'string') db = mongoskin.db(db)
  options = options || {}

  router = express.Router()
  router.db = db

  router.use(bodyParser.json())
  router.use(function (req, res, next) {
    req.db = router.db
    res.envelope = options.envelope
    next()
  })

  if (options.validator) router.use(options.validator)

  addRestMethods(router, options.singularize || inflector.singularize)
  router.use('/:action', convertId)
  router.use('/:action', envelope)
  router.use('/:action', sendJson)
  return router
}

function isEmpty(obj) {
  if (obj == null || obj.length === 0) return true
  if (obj.length > 0) return false
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) return false
  }
  return true
}

function fullUrl(req) {
  return req.protocol + '://' + req.get('host') + req.originalUrl
}

function normalizeId(id) {
  if (ObjectID.isValid(id)) return new ObjectID(id)
  return id;
}

function addRestMethods(router, singularize) {
  var action = "";
  router.param('type', function collectionParam(req, res, next, type) {
    res.locals.type = type
    next()
  })

  router.param('action', function collectionParam(req, res, next, action) {
    res.locals.action = action
    next()
  })
  router.param('id', function collectionParam(req, res, next, id) {
    res.locals.id = id
    next()
  })

  router.get('/:type', function (req, res, next) {

    switch (res.locals.type) {
      case "requests":
        req.data = req.body;
        var dispatcher = new controller.RequestController(req, res);

        dispatcher['getAllPendingServices'](req.headers, req.body,
          (result, err) => {
            res.locals.json = result;
            next();
          }
        );
        break;

    }

  })

  router.get('/:type/:action', function (req, res, next) {

    switch (res.locals.type) {
      case "package":
        req.data = query2m(req.query, { ignore: 'envelope' });
        var dispatcher = new controller.PackageController(req, res);
        res.locals.json = dispatcher[res.locals.action](
          (result) => {
            res.locals.json = result;
            next();

          }
        );
        break;
      case "approval":
        //console.log("approve")
        console.log(req.body)
        req.data = query2m(req.query, { ignore: 'envelope' });
        //console.log(res.locals.action)
        //console.log(req.id)
        var dispatcher = new controller.WorkflowController(req, res);
        dispatcher[res.locals.action](req.data, req.body,
          (result) => {
            res.locals.json = result;
            //console.log("result");
            //console.log(result);
            next();

          }
        );
        break;
      case "bundle":

        break;
      case "workflow":
        var dispatcher = new controller.WorkflowTranslateController(req, res);
        res.locals.json = dispatcher[res.locals.action](
          (result) => {
            res.locals.json = result;
            console.log("result");
            console.log(result);
            next();

          }
        );
        break;
      case "user":
        req.data = {

        }
        var dispatcher = new controller.UserController(req, res);
        res.locals.json = dispatcher[res.locals.action](req.query.userid,
          (result) => {
            res.locals.json = result;
            next();
          }
        );
        break;
    }

  })


  router.get('/:type/:action/:id', function (req, res, next) {

    switch (res.locals.type) {
      case "workflows":
        req.data = req.body;
        var dispatcher = new controller.WorkflowController(req, res);
        req.headers.source_sr = res.locals.id;

        if (res.locals.action === 'human') {
          dispatcher['getHumanflowsBySr'](req.headers, req.body,
            (result, err) => {
              res.locals.json = result;
              next();
            }
          );
        } else if (res.locals.action === 'machine') {
          dispatcher['getMachineflowsBySr'](req.headers, req.body,
            (result, err) => {
              res.locals.json = result;
              next();
            }
          );
        }


        break;

      case "user":
        req.data = {

        }
        var dispatcher = new controller.UserController(req, res);
        res.locals.json = dispatcher[res.locals.action](res.locals.id,
          (result) => {
            res.locals.json = result;
            next();
          }
        );
        break;
    }

  })

  router.post('/:type', function (req, res, next) {

    switch (res.locals.type) {
      case "requests":
        req.data = req.body;
        var dispatcher = new controller.RequestController(req, res);

        dispatcher['newRequest'](req.headers, req.body,
          (result, err) => {
            res.locals.json = result;
            next();
          }
        );
        break;
      case "comments":
        req.data = req.body;
        var dispatcher = new controller.RequestController(req, res);

        dispatcher['newUserComment'](req.headers, req.body,
          (result, err) => {
            res.locals.json = result;
            next();
          }
        );
        break;
    }

  })

  router.put('/:type/:action/:id', function (req, res, next) {

    switch (res.locals.type) {
      case "requests":
        req.data = req.body;
        var dispatcher = new controller.RequestController(req, res);
        req.headers.sr_id = res.locals.id;

        if (res.locals.action === 'approval') {
          dispatcher['approvePendingService'](req.headers, req.body,
            (result, err) => {
              res.locals.json = result;
              next();
            }
          );

        } else {
          dispatcher[res.locals.action](req.headers, req.body,
            (result, err) => {
              res.locals.json = result;
              next();
            }
          );
        }

        break;

      case "package":
        req.data = req.body;
        var dispatcher = new controller.PackageController(req, res);
        res.locals.json = dispatcher[res.locals.action](
          (result) => {
            res.locals.json = result;
            next();

          }
        );
        break;
      case "approval":
        //console.log(req.body)
        //console.log(res.locals.id)
        //console.log(req.body)
        //console.log(req.headers)
        //console.log(req.data)
        //req.data = query2m(req.query, { ignore: 'envelope' });
        var dispatcher = new controller.WorkflowController(req, res);
        dispatcher[res.locals.action](res.locals.id, req.headers, req.body,
          (result) => {
            res.locals.json = result;
            //console.log("result" + result);
            next();

          }
        );
        break;
      case "workflow":
        req.data = req.body;
        var dispatcher = new controller.WorkflowController(req, res);

        dispatcher[res.locals.action](req.headers, req.body,
          (result, err) => {
            res.locals.json = result;
            next();
          }
        );
        break;

      case "user":
        req.data = {

        }
        var dispatcher = new controller.UserController(req, res);
        res.locals.json = dispatcher[res.locals.action](req.query.userid,
          (result) => {
            res.locals.json = result;
            next();
          }
        );
        break;
    }

  })
  return router
}

function convertId(req, res, next) {
  if (res.locals.json instanceof Array) {
    res.locals.json.forEach(renameIdKey)
  } else if (res.locals.json) {
    renameIdKey(res.locals.json)
  }
  next()
}

function renameIdKey(obj) {
  if (obj) {
    obj.id = obj._id
    delete obj._id
  }
  return obj
}

function isToggled(value, override) {
  return (override && override === String(!value))
}

function envelope(req, res, next) {
  var useEnvelope = res.envelope
  if (isToggled(useEnvelope, req.query['envelope'])) useEnvelope = !useEnvelope

  if (useEnvelope && res.locals.json) {
    var envelope = {}
    var type = res.locals.singular
    if (res.locals.json instanceof Array) type = res.locals.plural
    envelope[type] = res.locals.json
    res.locals.json = envelope
  }
  next()
}

function sendJson(req, res, next) {
  if (res.locals.json) res.send(res.locals.json)
  else next()
}
