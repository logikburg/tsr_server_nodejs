var mongoskin = require('mongoskin')
var ObjectID = require('mongodb').ObjectID
var patch2m = require('jsonpatch-to-mongodb')
var query2m = require('query-to-mongo')
var bodyParser = require('body-parser')
var inflector = require('inflection')
const GroupController = require("./group_controller")
const PromiseWrapper = require("./PromiseWrapper")

class workflowTranslateController {
  constructor(req, res) {
    if (!req.db) throw new TypeError('db required')
    if (typeof req.db === 'string') this._db = mongoskin.db(req.db, { safe: true })
    else this._db = req.db;
    if (req.data) this._data = req.data;
    this._result = {};
		/*this._req =req;
		this._res =res;
		this._next =next;*/
    this.__completed = 0;
    this.promiseNum = 0;
  }
  __getDataByArrayKeys(fieldKeys) {
    var fieldValue;
    fieldKeys.forEach((key) => {
      fieldValue = (fieldValue && fieldValue[key]) || this._data[key];
    })
    return fieldValue ?
      Array.isArray(fieldValue) ?
        fieldValue : fieldValue.split(",")
      : fieldValue;
  }
  __complete(callback, result) {
    this.__completed++;
    if (this.__completed == this.promiseNum) {
      callback(result);
    }
  }
  getWorkflowStages(callback) {
    var workflowCollection = this._db.collection("workflow-defination");
    this._result = {};
    var me = this;
    var query = {
      criteria: {
        "type": this._data.type
      },
      options: {
        offset: 1,
        limit: 1
      }
    };
    //promiseNum++;
    var promiseWrapper = new PromiseWrapper();
    promiseWrapper.add(function (resolve, reject) {
      workflowCollection.find(query.criteria, query.options).toArray(function (e, results) {
        if (e) {
          return reject(e);
        }
        var finalResult = {};
        finalResult.type = results[0].type;
        finalResult.stages = [];
        var firstStageName = me.getFirstStageName(results[0]["start_stage"]);
        resolve({
          data: {
            firstStageName: firstStageName,
            result: results[0]["stages"]
          }
        });
      })
    }, (err) => {
      console.log("err:" + err);
    });
    promiseWrapper.complete(
      (results) => {
        var result = results[0].data;
        me.determineWholeStages(result.firstStageName, result.result, callback);
      },
      (err) => {
        console.log(err);//callback(err);
      }
    );
  }

  //Determine the first stage from a condition list and input data
  getFirstStageName(conditionList) {
    var test, firstStage;
    conditionList.map((conditions) => {
      if (!test) {
        conditions.condition.map(conditionItem => {
          conditionItem.map(item => {
            test = test != undefined ?
              test && this._data["fields"][item.type][item.field] == item.value :
              this._data["fields"][item.type][item.field] == item.value;
          });
        });
        if (test) firstStage = conditions.starting_from;
      }
    })
    return firstStage;
  }

  //Determine the whole stage from the first stage name, input data and the all stage defination
  determineWholeStages(startStageName, workflowStagesList, callback, index, stageNameList) {
    index = index || 0;
    stageNameList = stageNameList || [];
    var stages = [], returnStages = [];
    for (var i = index; i < workflowStagesList.length; i++ , index++) {
      if (workflowStagesList[i].stage_name == startStageName) {
        if (stageNameList.indexOf(workflowStagesList[i].stage_name) == -1) {
          stageNameList[stageNameList.length] = workflowStagesList[i].stage_name
          stages[stages.length] = workflowStagesList[i];
        }
        break;
      }
    }
    returnStages = returnStages.concat(stages);
    for (var i = 0; stages.length > 0 && stages[stages.length - 1].next_stage && i < stages[stages.length - 1].next_stage.length; i++) {
      returnStages = returnStages.concat(this.determineWholeStages(stages[stages.length - 1].next_stage[i]["to_stage"], workflowStagesList, callback, index, stageNameList))
    }
    if (index == 0) {
      this.defineAllActions(returnStages, callback);
    }
    return returnStages;
  }
  defineAllActions(stages, callback) {
    var me = this;
    function defineActionGroup(actions, actionIdx, new_group) {
      actions[actionIdx].action_groups.push(new_group);
      return actions[actionIdx].action_groups
    }
    function determineGroupByDynamicFieldKey(fieldValue, groupType, _callback) {
      var groupController = new GroupController(me._db);
      groupController.getGroup(groupType, fieldValue, function (result) {
        _callback(result);
      });
    }
    try {
      var arrPromiseWrapper = [];
      var masterPw = new PromiseWrapper();
      var finalStages = JSON.parse(JSON.stringify(stages)); //Copy template
      stages.forEach((stage, stageIdx) => {
        finalStages[stageIdx].actions = []; //clear template actions for filling in defined actions
        stage.actions.forEach((action, actionIdx) => {
          // Get run time value
          var dynamicActionByField = action.action_by ? (/\[(.*?)\]/gi).exec(action.action_by) || action.action_by : null;
          if (dynamicActionByField) {
            var dynamicActionByValues = Array.isArray(dynamicActionByField) ? me.__getDataByArrayKeys(dynamicActionByField[1].split(":")) : [dynamicActionByField];
            //Determine the action groups 
            dynamicActionByValues.forEach((team) => {
              var pw = new PromiseWrapper();
              arrPromiseWrapper[arrPromiseWrapper.length] = pw;
              action.action_groups.forEach((action_group) => {
                var regex = new RegExp(/\[(.*?)\]/);
                pw.add(function (resolve, reject) {
                  determineGroupByDynamicFieldKey(
                    team,
                    action_group.group_type,
                    (result) => {
                      if (!result) {
                        return reject(new Error("No result"));
                      }
                      resolve({
                        data: result
                      });
                    }
                  );
                }, (err) => {
                  console.log(err);
                  console.log("data:" + JSON.stringify({ team: team, action_group: action_group }));
                  //throw new Error("action.action_groups.forEach "+err);
                });
              });
              masterPw.add( //Ensure all query completed.
                function (resolve, reject) {
                  pw.complete(
                    function (result) {
                      var newAction = JSON.parse(JSON.stringify(action));
                      delete newAction.action_by;
                      newAction.action_groups = [];
                      result.forEach((item) => {
                        newAction.action_groups = newAction.action_groups.concat(item.data);
                      });
                      finalStages[stageIdx].actions.push(newAction);
                      resolve({
                        data: finalStages
                      });
                    }, (err) => {
                      return reject(new Error("promise rejected"));
                    }
                  );
                },
                (err) => {
                  console.log(err);
                }

              );
            });
          } else {
            finalStages[stageIdx].actions.push(action);
          }
        });
      });
    } catch (e) { console.log(e) };
    masterPw.complete(function (result) {
      callback(result[result.length - 1].data);
    });
  }
}

module.exports = workflowTranslateController;