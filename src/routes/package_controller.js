var mongoskin = require('mongoskin')
var ObjectID = require('mongodb').ObjectID
var patch2m = require('jsonpatch-to-mongodb')
var query2m = require('query-to-mongo')
var bodyParser = require('body-parser')
var inflector = require('inflection')
var WorkflowController = require("./workflow_controller");
var Controller = require("./Controller");
const PromiseWrapper = require("./PromiseWrapper")

class PackageController extends Controller {
  constructor(req, res) {
    super(req, res);
  }

  _getDataByArrayKeys(fieldKeys) {
    var fieldValue;
    fieldKeys.forEach((key) => {
      fieldValue = (fieldValue && fieldValue[key]) || this._data[key];
    })
    return fieldValue ?
      Array.isArray(fieldValue) ?
        fieldValue : fieldValue.split(",")
      : fieldValue;
  }
  _complete(callback, result) {
    this.__completed++;
    if (this.__completed == this.promiseNum) {
      callback(result);
    }
  }
  updateMyPicker(myDoc, callback) {
    console.log("-------------------------");
    console.log(myDoc)
    console.log("-------------------------");
    var packageReqDfCollection = this._db.collection("v1-package-request-defination");
    let _id = { _id: this.normalizeId(myDoc._id) };
    myDoc._id = this.normalizeId(myDoc._id);
    packageReqDfCollection.update(_id, myDoc, { upsert: true }, function (e, result) {
      if (e) throw e;
      // mongodb's update with $set/$unset doesn't error if there's no match
      // and doesn't return a result upon success; but a findOne after will
      packageReqDfCollection.findOne(_id, function (e, result) {
        if (e) throw e;
        callback(result);
      })
    })
  }
  addNewSeviceFormConfig(config, callback) {
    var packageReqFmDfCollection = this._db.collection("v1-package-request-form-defination");
    console.log("here");
    console.log(config);
    packageReqFmDfCollection.insert(config, function (e, result) {
      console.log(e);
      callback(result);
    })
  }
  createNewService(callback) {
    var packageReqDfCollection = this._db.collection("v1-package-request-defination");
    var me = this;
    var data = this._data.data;
    var config = this._data.cf;
    var packageName = this._data.pkn;
    packageReqDfCollection.insert({ data: data, name: packageName }, function (e, result) {
      let myRecord = result.ops[0];
      let wc = new WorkflowController(me.props.req, me.props.res);

      var promiseWrapper = new PromiseWrapper();
      data.map((item, idx) => {
        if (idx > 0) {
          promiseWrapper.add(function (resolve1, reject) {
            me.addNewSeviceFormConfig(config[idx - 1], (result) => {
              var d = result;
              var obj = { formCfId: ObjectID(d._id) };
              console.log("addNewSeviceFormConfig /call2");
              wc._askStageToPickup(item, item.title + " - Start", (id) => {
                resolve1({
                  data: id,
                  callback: (_d) => {
                    console.log("_askStageToPickup");
                    console.log(_d);
                    console.log("_askStageToPickup-end");
                    obj["Path"] = [{ stageId: ObjectID(_d._id), status: "Picked", pickupDate: Date.now() }];
                    myRecord["request"] = myRecord["request"] ? myRecord["request"] : [];
                    myRecord["request"].push(obj);
                  }
                })
              })
            });
          });
        }
      });

      promiseWrapper.complete(
        (results) => {
          me.updateMyPicker(myRecord, (data) => {
            console.log("completed");
            console.log(data);
            callback(data);
          })
        },
        (err) => {
          console.log(err);//callback(err);
        }
      );
    })
  }
  getPackageInstance(id, serviceTitle, callback) {
    var packageCollection = this._db.collection("package-instance");
    this._result = {};
    var me = this;
    var query = {
      criteria: [
        {
          $match: { requestid: id }
        },
        {
          $unwind: "$package"
        },
        {
          $lookup: {
            from: "request-instance",
            localField: "package.request_instance",
            foreignField: "_id",
            as: "request_doc"
          }
        },
        {
          $unwind: "$request_doc"
        },
        {
          $lookup: {
            from: "workflow-instance",
            localField: "request_doc.workflow_instance",
            foreignField: "_id",
            as: "workflow_doc"
          }
        }
      ]
    };
    if (serviceTitle != null && serviceTitle != undefined) {
      if (Array.isArray(serviceTitle)) {
        var match = {
          $match: {
            "$or": []
          }
        }
        serviceTitle.forEach((elem) => {
          match["$match"]["$or"].push({
            "package.title": elem
          })
        })
        query.criteria.push(match);
      }
      else {
        query.criteria.push({
          $match: { "package.title": serviceTitle }
        })
      }
    }
    packageCollection.aggregate(query.criteria, function (e, results) {
      if (e) {
        console.log("error:");
        console.log(e);
      }
      callback(results);
    })
  }
  getPackage(callback) {
    var packageCollection = this._db.collection("package-defination");
    this._result = {};
    var me = this;
    var query = {
      criteria: {
        "name": this._data.type
      }
    };
    //promiseNum++;
    var promiseWrapper = new PromiseWrapper();
    promiseWrapper.add(function (resolve, reject) {
      packageCollection.find(query.criteria, query.options).toArray(function (e, results) {
        if (e) {
          return reject(e);
        }
        resolve({
          data: {
            result: results
          }
        });
      })
    }, (err) => {
      console.log("err:" + err);
    });
    promiseWrapper.complete(
      (results) => {
        var result = results[0].data;
      },
      (err) => {
        console.log(err);//callback(err);
      }
    );
  }
}

module.exports = PackageController;