var mongoskin = require('mongoskin')
const Controller = require("./Controller")

var ObjectID = require('mongodb').ObjectID
var patch2m = require('jsonpatch-to-mongodb')
var query2m = require('query-to-mongo')
var bodyParser = require('body-parser')
var inflector = require('inflection')
var timeFunc = require('../utils/time_func')

class RequestController extends Controller {
	/*
	constructor(req, res) {
		if (!req.db) throw new TypeError('db required')
		if (typeof req.db === 'string') this._db = mongoskin.db(req.db, { safe: true })
		else this._db = req.db;
		if (req.data) this._data = req.data;
		this._result = {};
	//	this._req =req;
	//	this._res =res;
	//	this._next =next;
		this.__completed = 0;
		this.promiseNum = 0;
		this.requestCollection = this._db.collection("request");
	}
*/
  constructor(req, res) {
    super(req, res);
  }



  static _newBundleID(newObjectID) {
    var newD;
    var today = new Date();
    var date = today.getDate();
    var month = today.getMonth();
    var year = today.getYear();
    //var hour = today.getHours();
    //var minute = today.getMinutes(); 

    newD = year.toString().slice(-2) + timeFunc.pad(month + 1, 2) + timeFunc.pad(date, 2);

    return ("BS" + newD + newObjectID.toString().slice(-4).toUpperCase());
  }

  static _newServiceID(newObjectID, seqNo) {
    var newD;
    var today = new Date();
    var date = today.getDate();
    var month = today.getMonth();
    var year = today.getYear();
    //var hour = today.getHours();
    //var minute = today.getMinutes(); 

    newD = year.toString().slice(-2) + timeFunc.pad(month + 1, 2) + timeFunc.pad(date, 2);

    return ("SR" + newD + newObjectID.toString().slice(-4).toUpperCase() + "-" + timeFunc.pad(seqNo, 4));
  }

  static _getStagePosByField(stages, criteria_field) {
    var countStage = 0;
    for (var stage of stages) {
      if (stage.field === criteria_field) {
        return (countStage);
      }
      countStage++;
    }
    return (-1);
  }
  static _getStagePosByID(stages, stage_id) {
    var countStage = 0;
    for (var stage of stages) {
      if (stage.stage_id === stage_id) {
        return (countStage);
      }
      countStage++;
    }
    return (-1);
  }

  static _removeLocalQueueItem(sourceStage, subscribers, stages, thisDB) {
    //console.log('Source: ' + sourceStage.sr_id);
    //console.log('Stage ID: ' + sourceStage.stage_id);
    subscribers.forEach((subscriber) => {
      console.log('Target to remove: ' + subscriber.sr_id);
      console.log('Target stage_id: ' + subscriber.stage_id);
      var stagePos = RequestController._getStagePosByID(stages, subscriber.stage_id);
      var target_queue = stages[stagePos].criteria_queue;
      //console.log('target_queue: ' + JSON.stringify(target_queue));
      var arrQueueResult = [];
      target_queue.forEach((thisItem) => {
        if (thisItem.stage_id === sourceStage.stage_id) {
          //Remove this item from queue
        } else {
          arrQueueResult.push(thisItem);
        }
      })
      stages[stagePos].criteria_queue = arrQueueResult;

      //console.log('target_queue: ' + JSON.stringify(stages[stagePos]));
      if (arrQueueResult.length === 0) {
        //if "human" workflow, Notify responding User Group
        //if "machine", start the flow
        if (stages[stagePos].workflow_type === 'human') {
          console.log('Should Notify corresponding User Group for action!!!');
          var bundleHumanFlow = thisDB.collection("workflows-human");
          bundleHumanFlow.insert({ source: sourceStage, target: subscriber, workflow_ref: stages[stagePos].workflow_ref, timestamp: Date(), contents: stages[stagePos] }, function (e, result) {
            if (e) return next(e);
          });

        } else if (stages[stagePos].workflow_type === 'machine') {
          console.log('Start Machine Workflow!');
          var bundleMachineFlow = thisDB.collection("workflows-machine");
          bundleMachineFlow.insert({ source: sourceStage, target: subscriber, workflow_ref: stages[stagePos].workflow_ref, timestamp: Date(), contents: stages[stagePos] }, function (e, result) {
            if (e) return next(e);
          });
        } else {
          console.log('Unknown workflow Type!!!');
          var bundleUnknownFlow = thisDB.collection("workflows-unknown");
          bundleUnknownFlow.insert({ source: sourceStage, target: subscriber, workflow_ref: stages[stagePos].workflow_ref, timestamp: Date(), contents: stages[stagePos] }, function (e, result) {
            if (e) return next(e);
          });
        }

      }
    })

    return (stages);
  }

  static _removeServiceQueueItem(pendingQueue, stage_id) {
    var arrQueueResult = [];
    console.log('service Queue: ' + JSON.stringify(pendingQueue));
		/*
		pendingQueue.forEach((thisItem)=>{
			console.log('thisItem: ' + JSON.stringify(thisItem));
			console.log('stage_id: ' + stage_id);
			if (thisItem.stage_id === stage_id) {
				//Remove this item from queue
			} else {
				arrQueueResult.push(thisItem);
			}
		})
		*/
    for (var pendingItem in pendingQueue) {
      console.log('thisItem: ' + JSON.stringify(pendingQueue[pendingItem].stage_id));
      console.log('stage_id: ' + stage_id);
      if ((pendingQueue[pendingItem].stage_id) === stage_id) {
        //Remove this item from queue
      } else {
        arrQueueResult.push({ stage_id: pendingQueue[pendingItem].stage_id });
      }
    }

    console.log('arrQueueResult: ' + JSON.stringify(arrQueueResult));
    return (arrQueueResult);
  }

  newRequest(headers, body, callback) {

    var bundleRequestCollection = this._db.collection("bundle-requests");
    var serviceRequestCollection = this._db.collection("service-requests");

    var newObjectID;
    var curRequestBundle = {
      bundle_type: body.bundle_type,
      bundle_id: "",
      timestamp: Date(),
      services: "",
      //pending_queue: body.pending_queue,
      requester: body.requester
    };

    bundleRequestCollection.insert(curRequestBundle, function (e, result) {
      if (e) return next(e);

      newObjectID = result.insertedIds;

      //to Update the Bundle ID
      var currentBundleID = { _id: ObjectID(`${newObjectID}`) }
      var newBundleID = RequestController._newBundleID(result.insertedIds);
      curRequestBundle.bundle_id = newBundleID;

      //1. Insert a New record to "service-requests" 
      //2. Update the SRID as Ref. to "bundle-requests"
      var servicesArray = [];
      //var pendingQueue =[];
      var statusHistory = [{
        service_status: 'open',
        updated_datetime: Date(),
        updated_by: body.requester
      }];
      var srCount = 0;
      body.services.forEach(function (service) {
        srCount++;
        var newSRID = RequestController._newServiceID(newBundleID, srCount);
        servicesArray.push({
          contents: service,
          service_type: service.service_type,
          service_ref: newSRID,
          service_status: 'open',
          updated_datetime: Date()
        });
        //pendingQueue.push({service_ref:newSRID});


        //-------------------------------------------------------------------------
        //Update the SR_ID to all related Reference
        //... in prototype, we just replace "local" to current "sr_id"
        var stages = service.stages;
        var countStage = 0;
        for (var stage of stages) {
          var countQueueItem = 0;
          for (var queueItem of stages[countStage].criteria_queue) {
            //console.log('queue: '+ stages[countStage].criteria_queue);

            var sr_id = stages[countStage].criteria_queue[countQueueItem].sr_id;
            if (sr_id === "local") {
              stages[countStage].criteria_queue[countQueueItem].sr_id = newSRID;
            }
            countQueueItem++;
          }

          var countSubscriber = 0;
          //console.log('subscribers: '+ stages[countStage].subscribers);
          for (var subscriber of stages[countStage].subscribers) {
            var sr_id = stages[countStage].subscribers[countSubscriber].sr_id;
            if (sr_id === "local") {
              stages[countStage].subscribers[countSubscriber].sr_id = newSRID;
            }
            countSubscriber++;
          }

          countStage++;
        }
        service.stages = stages;
        //-------------------------------------------------------------------------


        //Create each Sevice Request in this Bundle
        var curRequestService = {
          sr_id: newSRID,
          bundle_ref: newBundleID,
          timestamp: Date(),
          requester: body.requester,
          contents: service,
          status_history: statusHistory,
          status_done: 'open',
          status_datetime: Date()
        };

        serviceRequestCollection.insert(curRequestService, function (e, result) {
          if (e) return next(e);
        })
      })

      //Step 2.
      curRequestBundle.services = servicesArray;
      //curRequestBundle.pending_queue = pendingQueue;
      bundleRequestCollection.update(currentBundleID, curRequestBundle, function (e, result) {
        if (e) return next(e);

        callback(result);

      })


    })

  }


  newUserComment(headers, body, callback) {

    var userCommentCollection = this._db.collection("v1-dat-usercomments");

    var newObjectID;
    var currentDate = new Date();
    var curRequestBundle = {
      user_profile: body.user_profile,
      timestamp: new Date(currentDate.toISOString()),
      comments: body.user_comments,
    };

    userCommentCollection.insert(curRequestBundle, function (e, result) {
      if (e) return next(e);
      callback(result);
    })

  }
	/*	//Contains "fulfill_criteria"
		getAllPendingServices(headers,body,callback){
			var serviceRequestCollection = this._db.collection("service-requests");
			// ** 3 criteria are required to fulfill:
			//1. ALL pre_criteria fulfulled
			//2. self "is_fulfilled" is FALSE
			//3. User Group in ANY fields of fulfill_criteria matched & "by_ref" is FALSE
			// --> Input from headers => User Group
	
			//console.log('UserGroup: ' + headers.user_group);
			//ForEach Member Group of this staff
			var UserGroups = JSON.parse(headers.user_group);
			var resultsArray=[];
			var countUserGroup = 0;
			UserGroups.forEach((membergroup)=>{
				//console.log('MemberGroup: ' + membergroup);
				var query = {
					criteria: {"contents.stages": {
							$elemMatch:{$and:[{"criteria_queue":{$size:0}},
										{"is_fulfilled":false},
										{"workflow_type":'human'},
										{"fulfill_criteria":{
											$elemMatch:{"by_ref":false,
														"user_group":{$in: [membergroup]}
											}
										}
										}]//AND
							}
						}}
					}
	
				serviceRequestCollection.find(query.criteria, (function (e, results) {
					if (e) {
						console.log("error:");
						console.log(e);
					}
	
					//If no error, move on
					results.toArray().then((data) => {
						if (data.length>0) {
							resultsArray.push({role:membergroup , pending_requests:data});
						}
						countUserGroup++;
						if(countUserGroup === UserGroups.length) {
							//Final - Looped all possible Groups of this staff
							//var strResult = JSON.stringify(resultsArray);
							callback(resultsArray);
						}
					})
				}));
			});
		}
	*/
  //Without "fulfill_criteria"
  getAllPendingServices(headers, body, callback) {
    var serviceRequestCollection = this._db.collection("service-requests");
    // ** 3 criteria are required to fulfill:
    //1. ALL pre_criteria fulfulled
    //2. self "is_fulfilled" is FALSE
    //3. User Group in ANY fields of fulfill_criteria matched & "by_ref" is FALSE
    // --> Input from headers => User Group

    //console.log('UserGroup: ' + headers.user_group);
    //ForEach Member Group of this staff
    var UserGroups = JSON.parse(headers.user_group);
    var resultsArray = [];
    var countUserGroup = 0;
    UserGroups.forEach((membergroup) => {
      //console.log('MemberGroup: ' + membergroup);
      var query = {
        criteria: {
          "contents.stages": {
            $elemMatch: {
              $and: [{ "criteria_queue": { $size: 0 } },
              { "is_fulfilled": false },
              { "workflow_type": 'human' },
              { "by_ref": false },
              {
                "user_group": { $in: [membergroup] }
              }]//AND
            }
          }
        }
      }

      serviceRequestCollection.find(query.criteria, (function (e, results) {
        if (e) {
          console.log("error:");
          console.log(e);
        }

        //If no error, move on
        results.toArray().then((data) => {
          if (data.length > 0) {
            resultsArray.push({ role: membergroup, pending_requests: data });
          }
          countUserGroup++;
          if (countUserGroup === UserGroups.length) {
            //Final - Looped all possible Groups of this staff
            //var strResult = JSON.stringify(resultsArray);
            callback(resultsArray);
          }
        })
      }));
    });
  }


  getAllPendingBundles(headers, data, callback) {

  }

  getRequest(requestid, callback) {
    var me = this;
    var query = {
      criteria: {
        "sr_id": requestid
      }
    };
    me.requestCollection.findOne(query.criteria, (function (e, results) {
      if (e) {
        console.log("error:");
        console.log(e);
      }
      //console.log(results);
      callback(results);
    }))
  }

  approvePendingService(headers, body, callback) {
    // ** 3 criteria are required to fulfill:
    //1. sr_id matched
    //2. role matched in User Group required
    //3. Required Field matched		
    var sr_id = headers.sr_id;
    var role = headers.user_role;
    var criteria_field = headers.criteria_field;
    var user = headers.user_logon;
		/*
		console.log('sr_id:' + sr_id)
		console.log('role:' + role)
		console.log('criteria_field:' + criteria_field)
		*/
    var thisDB = this._db;
    var bundleRequestCollection = this._db.collection("bundle-requests");
    var serviceRequestCollection = this._db.collection("service-requests");
    var query = {
      criteria: {
        $and: [{ "sr_id": sr_id },
        {
          "contents.stages": {
            $elemMatch: {
              $and: [{ "criteria_queue": { $size: 0 } },
              { "by_ref": false },
              { "user_group": { $in: [role] } },
              { "field": criteria_field }
              ]
            }
          }
        }
        ]
      }
    }
    console.log('query: ' + JSON.stringify(query.criteria));

    serviceRequestCollection.find(query.criteria, (function (e, results) {
      if (e) {
        console.log("error:");
        console.log(e);
      }
      //If no error, move on
      results.toArray().then((data) => {
        //1. Updata the Contents Value, is_fulfilled => true
        //2. Update the corresponding Stage, is_fulfilled => true
        //3. Clear the "criteria_queue" of its Subscribers
        //4. Clear pending queue
        var countRecord = data.length;
        if (countRecord === 0) {
          callback({ record_updated: 0, description: 'No record to update!' })
          //return next("No record to update!");
        } else if (countRecord > 1) {
          callback({ record_updated: 0, description: 'More than one record to update!' })
          //return next("More than one record to update!");
        };
        //Should ONLY ONE record to be updated
        //console.log('data: ' + JSON.stringify(data[0]));
        var currentSRID = { sr_id: sr_id };
        //1. Updata the Contents Value, is_fulfilled => true
        data[0].contents.values[criteria_field] = {
          status: true,
          timestamp: Date(),
          approved_by: user
        };

        //2. Update the corresponding Stage.fulfill_criteria, is_fulfilled => true
        var stages = data[0].contents.stages;
        var thisStagePos = RequestController._getStagePosByField(stages, criteria_field);
        var thisStage;
        if (thisStagePos >= 0) {
          thisStage = data[0].contents.stages[thisStagePos];
          //console.log(JSON.stringify(thisStage.stage_id))					
          thisStage.is_fulfilled = true;
          thisStage.updated_datetime = Date();
          thisStage.updated_by = user;
          data[0].contents.stages[thisStagePos] = thisStage;

          //3. Clear the "criteria_queue" of its Local Subscribers
          if (thisStage.subscribers.length > 0) {
            var updatedStages = RequestController._removeLocalQueueItem({ sr_id: sr_id, stage_id: thisStage.stage_id },
              thisStage.subscribers,
              data[0].contents.stages,
              thisDB
            );
            data[0].contents.stages = updatedStages;
          }

          //4.
          console.log('Data Contents: ' + JSON.stringify(data[0].contents));
          data[0].contents.pending_queue = RequestController._removeServiceQueueItem(data[0].contents.pending_queue, thisStage.stage_id);
          var statusHistroy = [];
          statusHistroy = data[0].status_history;

          //5. Mark "Completed" to the current Service Item if "pending_queue" is empty
          data[0].status_done = criteria_field;
          data[0].status_datetime = Date();

          statusHistroy.push({
            service_status: criteria_field,
            updated_datetime: Date(),
            updated_by: {
              loginid: user,
              name: headers.user_name,
              team: headers.user_team,
              title: headers.user_title,
              email: headers.user_email
            }
          });

          //Pending Queue is clear
          var bundleStatus = criteria_field;
          if (data[0].contents.pending_queue.length == 0) {
            bundleStatus = 'completed';

            data[0].status_done = "completed";
            data[0].status_datetime = Date();

            statusHistroy.push({
              service_status: 'completed',
              updated_datetime: Date(),
              updated_by: {
                loginid: user,
                name: headers.user_name,
                team: headers.user_team,
                title: headers.user_title,
                email: headers.user_email
              }
            });
          }

          //6. Mark also the Bundle corresponding
          var bundle_query = {
            criteria: { "bundle_id": 'BS' + sr_id.toString().slice(2, 12) }
          }

          console.log('query: ' + JSON.stringify(bundle_query.criteria));
          bundleRequestCollection.find(bundle_query.criteria, function (e, bundle_results) {
            if (e) {
              console.log("error:");
              console.log(e);
            }
            //If no error, move on
            //var bundleObjectID = {bundle_id:bundle_results._id};
            bundle_results.toArray().then((bundule_data) => {
              //console.log('DATA: ' + JSON.stringify(bundule_data))
              var arrBundleServices = bundule_data[0].services;
              var arrServerItems = [];
              var boolBundleCompleted = true;
              arrBundleServices.forEach((serviceItem) => {
                if (serviceItem.service_ref === sr_id) {
                  //console.log('SR_Ref: ' + JSON.stringify(serviceItem.service_ref))
                  serviceItem.service_status = bundleStatus
                  serviceItem.updated_datetime = Date();
                }
                arrServerItems.push(serviceItem);

                //Check if all Services "Completed"
                if (serviceItem.service_status !== 'completed') {
                  boolBundleCompleted = false
                }
              })//forEach
              bundule_data[0].services = arrServerItems;
              bundule_data[0].is_completed = boolBundleCompleted;
              //console.log('Bundle Updated: ' + JSON.stringify(arrServerItems));

              //Update
              bundleRequestCollection.update(bundle_query.criteria, bundule_data[0], function (e, result) {
                if (e) {
                  console.log("error:");
                  console.log(e);
                }
                //console.log(results);
                //callback(results);					
              })

            })//toArray

          })
          //

        }



        serviceRequestCollection.update(currentSRID, data[0], function (e, result) {
          if (e) return next(e);


          callback({ record_updated: countRecord, description: 'Approved OK', result: result });

        })

      });
    }));
  }
}

module.exports = RequestController;