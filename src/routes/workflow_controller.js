var mongoskin = require('mongoskin')
var ObjectID = require('mongodb').ObjectID
var patch2m = require('jsonpatch-to-mongodb')
var query2m = require('query-to-mongo')
var bodyParser = require('body-parser')
var inflector = require('inflection')
const Controller = require("./Controller")
const PromiseWrapper = require("./PromiseWrapper")
var axios = require('axios')
const util = require('../utils/request_func')

class WorkflowController extends Controller {

  constructor(req, res) {
    super(req, res);
  }

  getHumanflowsBySr(headers, body, callback) {
    var humanFlowCollection = this._db.collection("workflows-human");
    var is_fulfilled = (headers.is_fulfilled === 'true');
    var query = {
      criteria: {
        'source.sr_id': headers.source_sr,
        'contents.is_fulfilled': is_fulfilled
      }
    }
    //console.log('query.criteria: ' + JSON.stringify(query.criteria));
    humanFlowCollection.find(query.criteria, (function (e, results) {
      if (e) {
        console.log("error:");
        console.log(e);
      }

      results.toArray().then((data) => {
        //console.log('length: ' + data.length);
        //console.log('Result: ' + data);
        callback(data);
      });

    })
    )
  }

  getMachineflowsBySr(headers, body, callback) {
    var humanFlowCollection = this._db.collection("workflows-machine");
    var is_fulfilled = (headers.is_fulfilled === 'true');
    var query = {
      criteria: {
        'source.sr_id': headers.source_sr,
        'contents.is_fulfilled': is_fulfilled
      }
    }
    //console.log('query.criteria: ' + JSON.stringify(query.criteria));
    humanFlowCollection.find(query.criteria, (function (e, results) {
      if (e) {
        console.log("error:");
        console.log(e);
      }

      results.toArray().then((data) => {
        //console.log('length: ' + data.length);
        //console.log('Result: ' + data);
        callback(data);
      });

    })
    )
  }



  approve(request_id, headers, data, callback) {

    //console.log("data")
    //console.log(id);
    //console.log(bundle.criteria.bundle)
    //console.log(util)
    //check role
    if (headers.role !== 'manager') {

    }

    if (headers.bundle) {
      var type = 'bundle-requests'
      var service_id = headers.bundle
    } else {
      var service_id = request_id
    }

    var approval_field
    var stage_name
    switch (headers.team) {
      case 'requester':
        approval_field = 'requester_manager_approval'
        stage_name = 'requester_manager_approved'
        break
      case 'support':
        approval_field = 'support_manager_approval'
        stage_name = 'support_manager_approved'
        break
    }


    if (data._id == service_id) {
      //console.log("check bundle id")
      //console.log(data.requests)
      var requests = data.requests
      var request = util.find_request(request_id, data.requests)
      //console.log(request)
      request.fields[approval_field].value = 'approve'
      request.fields[approval_field].is_fulfilled = true
      var stage = util.find_stage(stage_name, request.stages)
      stage.is_fulfilled = true
      stage.updated_datetime = Date()
      //console.log(request)
      /*
      for (var i in requests) {
        //console.log(request)
        if (requests[i]._id == request_id) {
          //console.log("push")
          requests[i].fields[approval_field].value = 'approve'
          requests[i].fields[approval_field].is_fulfilled = true
          for (var j in requests[i].stages) {
            if (requests[i].stages[j].name == stage_name) {
              requests[i].stages[j].is_fulfilled = true
              requests[i].stages[j].updated_datetime = Date()
            }
          }
        }
        break
      }*/
    }
    //console.log(JSON.stringify(data))
    var bundleid = { _id: `${service_id}` }
    var bundleRequestCollection = this._db.collection("bundle-requests")
    //console.log(bundleRequestCollection)
    bundleRequestCollection.update(bundleid, data, function (e, result) {
      if (e) return next(e)

      // mongodb's update with $set/$unset doesn't error if there's no match
      // and doesn't return a result upon success; but a findOne after will
      bundleRequestCollection.findOne(bundleid, function (e, result) {
        if (e) return next(e)
        callback(result)
      })
    })

  }

  checkPickupCriteria(callback) {
    let data = this._data.formData;
    console.log(data);
    const checkOrCriteria = (rules) => {
      var isPass = false;
      for (var rule in rules) {
        if (Array.isArray(rules[rule])) {
          if (rule == "or") isPass = isPass || checkOrCriteria(rules[rule]);
          else if (rule == "and") isPass = isPass || checkAndCriteria(rules[rule]);
        } else {
          rule = rules[rule];
          if (rule["validate-method"] == "regex") {
            var regex = new RegExp(rule["test"], 'gi');
            console.log(regex.test(data[rule["field"]]));
          }
        }
      }
    }
    const checkAndCriteria = (rules) => {
      var isPass = true;
      for (var i = 0; i < data.length; i++) {
        var item = data[i];
        for (var rule in rules) {
          if (Array.isArray(rules[rule])) {
            if (rule == "or") isPass = isPass && checkOrCriteria(rules[rule]);
            else if (rule == "and") isPass = isPass && checkAndCriteria(rules[rule]);
          } else {
            rule = rules[rule];
            if (rule["validate-method"] == "regex") {
              var regex = new RegExp(rule["test"], 'gi');
              if (Array.isArray(item[rule["field"]])) {
                var oneOfPassed = false;
                item[rule["field"]].map(value => {
                  console.log(regex.test(value));
                  oneOfPassed = oneOfPassed || regex.test(value);
                });
                isPass = isPass && oneOfPassed;
              }
              else {
                var fieldName = rule["field"];
                isPass = isPass && regex.test(item[rule["field"]]);
              }
            } else if (rule["validate-method"] == "string") {
              if (Array.isArray(item[rule["field"]])) {
                var oneOfPassed = false;
                item[rule["field"]].map(value => {
                  console.log(regex.test(value));
                  oneOfPassed = oneOfPassed || value == rule["test"];
                });
                isPass = isPass && oneOfPassed;
              }
              else {
                isPass = isPass && item[rule["field"]] == rule["test"];
              }
            }
          }
        }
      }
      console.log(isPass);
      return isPass;
    }

    var stageCnfCollection = this._db.collection("v1-workflow-stage-configuration");
    this._result = {};
    var me = this;
    var query = {
      criteria: {
        name: this._data.workflowname
      }
    };

    stageCnfCollection.find(query.criteria, query.options).toArray(function (e, results) {
      var isPass = false;
      if (results.length > 0) {
        var requirement = results[0]["pickup_requirement"];
        console.log(requirement);
        isPass = true;
        for (var key in requirement) {
          if (key == "and")
            isPass = isPass && checkAndCriteria(requirement[key])
          else if (key == "or")
            isPass = isPass && checkOrCriteria(requirement[key])
        }
      }
      var newStageConfig = results[0];
      newStageConfig && delete newStageConfig["_id"];
      callback({ result: isPass, obj: newStageConfig });
    });
  }
  _askStageToPickup(data, workflowname, callback) {
    this._data = { formData: data.data, workflowname: workflowname };
    var me = this;
    this.checkPickupCriteria((data) => {
      if (data.result == true) {
        var stageDfCollection = me._db.collection("v1-workflow-stage-defination");
        stageDfCollection.insert(data.obj, function (e, result) {
          console.log("stageDfCollection.insert");
          console.log(result);
          callback(result.ops[0]);
        })
      }
    })
  }
}

module.exports = WorkflowController;