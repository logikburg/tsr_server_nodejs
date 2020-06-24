process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
'use strict';
var assert = require('chai').assert
//var expressMongoRest = require('../src/raw')
var express = require('express')
var mongoskin = require('mongoskin')
var ObjectID = require('mongodb').ObjectID
var http = require('http')
var superTest = require('supertest')
var apiTest = superTest('http://localhost:8080')
//var apiTest = superTest('https://tsr-api-test-tsr-development.dc7-openshift2.server.ha.org.hk')

//var server = require('../src/raw')
var chai = require("chai");
expect = chai.expect;

var input = require('./fullinput.json');
var new_request = require('./new-request.json')
const app = express();

var util = require('../src/utils/request_func')
//

const config = require('./config');
let env = config.env || 'dev';
let mongoose = require('mongoose');
let gracefulShutdown;
console.log(config[env].db)
let dbURI = config[env].db;

mongoose.connect(dbURI, { useNewUrlParser: true });
mongoose.set('debug', true);
// CONNECTION EVENTS
mongoose.connection.on('connected', function () {
  console.log('Mongoose connected to ' + dbURI);
});
mongoose.connection.on('error', function (err) {
  console.log('Mongoose connection error: ' + err);
});
mongoose.connection.on('disconnected', function () {
  console.log('Mongoose disconnected');
});
//var request_id = '111111'

describe('Scenerio 1 : Workflow of "Launch Web Application (Windows)"', function () {

  before(function (done) {
    //Reset the Testing Database
    /*
    request.del('/api/v1/bundle-requests')
            .then (request.del('/api/v1/pending-requests')
              .then (request.del('/api/v1/service-requests').expect(204,done)));
              */
    // apiTest.del('/api/v1/raw/bundle-requests')
    //   .then(apiTest.del('/api/v1/raw/workflows-human')
    //     .then(apiTest.del('/api/v1/raw/workflows-machine')
    //       .then(apiTest.del('/api/v1/raw/service-requests').expect(204, done)
    //       )));
    request.del('/api/v1/service-requests').expect(204, done)
  })

  describe('To submit the application form', function () {

    //Requester submitting a new service bundle
    it('should create a service bundle template with all requests');
    it('should check the required fields in each request');

    describe('Add an ad-hoc request into the bundle', function () {
      it('check if any conflicts');
      it('should update related dependencies');

    });

    describe('To submit the application form (By Requester from T1 team)', function () {
      /* 
       it('should store the TESTING RECORD in DB', function (done) {
       request.post('/api/v1/bundle-requests')
           .send({name:'Carl', email:'carl@example.com'})
           .expect(201, done)
       });
     */

      it('should create a service bundle template with all requests');
      it('should check the required fields in each request');

      describe('Add an ad-hoc request into the bundle', function () {
        it('check if any conflicts');
        it('should update related dependencies');
      });

      describe('Remote a request from the bundle', function () {
        it('check if any conflicts');
        it('should update related dependencies');
      });

      //Requester submitting a new service bundle   
      it('should create a new Bundle and the corresponding service items', (done) => {
        apiTest.post('/api/v1/tsr/requests')
          .send(new_request)
          .expect(200, done);
      });

      /*
                  it('should store the input in DB', function (done) {
                    // !!! Use TSR API instead of directly to DB
                    request.post('/api/v1/bundle-requests')
                      .send(input)
                      .expect(201, done)
                  });
      */
    });

    //Request Manager Approval Stage
    describe('Approver handles pending services (Test Case: T1 manager)', function () {

      var pendingRequests;
      it('should retrieve all pending services', (done) => {
        apiTest.get(`/api/v1/tsr/requests`)
          .set('Content-Type', 'application/json')
          .set('Accept', 'application/json')
          .set('user_logon', 't1smlogon')
          .set('user_group', '["special_project_member","t1sm"]')
          .send(input)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function (err, res) {
            if (err) return done(err);

            pendingRequests = res.body
            expect(pendingRequests).to.be.an('array');

            var countPending = 0;
            pendingRequests.forEach((target_role) => {
              //console.log('role: '+ target_role.role);
              target_role.pending_requests.forEach((target_request) => {
                //console.log('target_request: '+ JSON.stringify(target_request));
                expect(target_request).to.contain.keys('contents', 'requester', 'sr_id');
                expect(target_request.contents).to.contain.keys('service_name', 'service_type', 'values');

                var stages = target_request.contents.stages;
                stages.forEach((stage) => {
                  expect(stage).to.contain.keys('criteria_queue', 'is_fulfilled');
                  expect(stage).to.not.contain.key('test');
                  expect(stage.criteria_queue).to.be.an('array');
                  //expect(stage.fulfill_criteria).to.be.an('array');
                  expect(stage.is_fulfilled).not.to.be.an('array');
                  expect(stage.workflow_type).to.be.a('string');


                  var targetGroup = stage.user_group;
                  //console.log('targetGroup: ' + targetGroup);
                  if ((stage.by_ref === false)
                    && (util.containsObject(target_role.role, targetGroup))
                    && (stage.is_fulfilled === false)
                    && (stage.workflow_type === "human")
                  ) {

                    //To check if all "criteria_queue" are fulfilled also
                    //console.log('Queue remain: ' + stage.criteria_queue.length);
                    if (stage.criteria_queue.length === 0) {
                      countPending++;
                      /*                     
                      console.log('service: ' + target_request.contents.service_name);
                      console.log('stage: ' + stage.name);
                      console.log('ActionGroup: ' + criteria.user_group);
                      console.log('countPending:' + countPending);  
                      */
                    }
                  }//if any Pending Requests Exist

                })//forEach Stage
              })//forEach Role
            })//forEach pendingRequests
            expect(countPending).to.be.gte(1);

            done();
          });//end Post       
      });


      it('should approve as Requester Team Manager', (done) => {
        //console.log('Testing:' + JSON.stringify(pendingRequests) );
        //console.log('Testing:' + pendingRequests[0].role );
        var thisRequest = pendingRequests[0].pending_requests[0];
        var thisRole = "t1sm";
        var thisStageField = "requester_manager_approval";
        //console.log('Testing:' + request.sr_id );
        /*
                      {"field":"requester_manager_approval",
                "by_ref":false,
                "user_group":["t1sm"]}
                */
        apiTest.put(`/api/v1/tsr/requests/approval/` + thisRequest.sr_id)
          .set('Content-Type', 'application/json')
          .set('Accept', 'application/json')
          //.set('sr_id', thisRequest.sr_id)
          .set('criteria_field', thisStageField)
          .set('user_logon', 't1smlogon')
          .set('user_Role', thisRole)
          .set('user_name', 'Tony Chan')
          .set('user_team', 'T1')
          .set('user_title', 'T1 Manager')
          .set('user_email', 'abc@ha.org.hk')
          .send(input)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function (err, res) {
            if (err) return done(err);
            //console.log('result:' + res.text);
            var result = JSON.parse(res.text);
            expect(result.record_updated).to.equal(1);
            done();
          }
          );//end Post
      });


      it('should have some depending Human workflows started by last approval', (done) => {
        var thisRequest = pendingRequests[0].pending_requests[0];
        //console.log(thisRequest);
        //apiTest.post(`/api/tsr/workflow/getHumanflowsBySr/0`)
        apiTest.get(`/api/v1/tsr/workflows/human/` + thisRequest.sr_id)
          .set('Content-Type', 'application/json')
          .set('Accept', 'application/json')
          //.set('source_sr', thisRequest.sr_id)
          .set('is_fulfilled', false)
          .send(input)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function (err, res) {
            if (err) return done(err);

            var result = JSON.parse(res.text);
            //console.log('length:' + result.length);
            //console.log('result:' + JSON.stringify(result));
            expect(result.length).to.gte(1);

            done();
          });
      });

      it('should have some depending Machine workflows started by last approval', (done) => {
        var thisRequest = pendingRequests[0].pending_requests[0];
        //console.log(thisRequest);
        //apiTest.post(`/api/tsr/workflow/getMachineflowsBySr/0`)
        apiTest.get(`/api/v1/tsr/workflows/machine/` + thisRequest.sr_id)
          .set('Content-Type', 'application/json')
          .set('Accept', 'application/json')
          //.set('source_sr', thisRequest.sr_id)
          .set('is_fulfilled', false)
          .send(input)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function (err, res) {
            if (err) return done(err);

            var result = JSON.parse(res.text);
            //console.log('length:' + result.length);
            //console.log('result:' + JSON.stringify(result));
            expect(result.length).to.gte(1);

            done();
          });
      });

      describe('To reject a service bundle', function () {
        it('should check the bundle if any conflicts');
        it('should update the bundle');
      });
    });

    //Support Team Manager Approval Stage
    describe('Support Team Manager handles pending service (Test Case: T3 Support Team Manager)', function () {

      var pendingRequests;
      it('should retrieve all pending services', (done) => {
        apiTest.get(`/api/v1/tsr/requests`)
          .set('Content-Type', 'application/json')
          .set('Accept', 'application/json')
          .set('user_logon', 't3smlogon')
          .set('user_group', '["t3sm"]')
          .send(input)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function (err, res) {
            if (err) return done(err);

            pendingRequests = res.body
            expect(pendingRequests).to.be.an('array');

            var countPending = 0;
            pendingRequests.forEach((target_role) => {
              //console.log('role: '+ target_role.role);
              target_role.pending_requests.forEach((target_request) => {
                //console.log('target_request: '+ JSON.stringify(target_request));
                expect(target_request).to.contain.keys('contents', 'requester', 'sr_id');
                expect(target_request.contents).to.contain.keys('service_name', 'service_type', 'values');

                var stages = target_request.contents.stages;
                stages.forEach((stage) => {
                  expect(stage).to.contain.keys('criteria_queue', 'is_fulfilled');
                  expect(stage).to.not.contain.key('test');
                  expect(stage.criteria_queue).to.be.an('array');
                  //expect(stage.fulfill_criteria).to.be.an('array');
                  expect(stage.is_fulfilled).not.to.be.an('array');
                  expect(stage.workflow_type).to.be.a('string');


                  var targetGroup = stage.user_group;
                  //console.log('targetGroup: ' + targetGroup);
                  if ((stage.by_ref === false)
                    && (util.containsObject(target_role.role, targetGroup))
                    && (stage.is_fulfilled === false)
                    && (stage.workflow_type === "human")
                  ) {

                    //To check if all "criteria_queue" are fulfilled also
                    //console.log('Queue remain: ' + stage.criteria_queue.length);
                    if (stage.criteria_queue.length === 0) {
                      countPending++;
                      /*                     
                      console.log('service: ' + target_request.contents.service_name);
                      console.log('stage: ' + stage.name);
                      console.log('ActionGroup: ' + criteria.user_group);
                      console.log('countPending:' + countPending);  
                      */
                    }
                  }//if any Pending Requests Exist

                })//forEach Stage
              })//forEach Role
            })//forEach pendingRequests
            expect(countPending).to.be.gte(1);

            done();
          });//end Post       
      });

      it('should approve as Support Team Manager (T3)', (done) => {
        //console.log('Testing:' + JSON.stringify(pendingRequests) );
        //console.log('Testing:' + pendingRequests[0].role );
        var thisRequest = pendingRequests[0].pending_requests[0];
        var thisLogon = "t3smlogon";
        var thisRole = "t3sm";
        var thisStageField = "support_manager_approval";
        //console.log('Testing:' + request.sr_id );
        /*
                      {"field":"requester_manager_approval",
                "by_ref":false,
                "user_group":["t1sm"]}
                */
        //apiTest.post(`/api/tsr/request/approvePendingService/0`)
        apiTest.put(`/api/v1/tsr/requests/approval/` + thisRequest.sr_id)
          .set('Content-Type', 'application/json')
          .set('Accept', 'application/json')
          .set('sr_id', thisRequest.sr_id)
          .set('criteria_field', thisStageField)
          .set('user_logon', thisLogon)
          .set('user_Role', thisRole)
          .set('user_name', 'CC Lam')
          .set('user_team', 'T3')
          .set('user_title', 'T3 Manager')
          .set('user_email', 'abc@ha.org.hk')
          .send(input)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function (err, res) {
            if (err) return done(err);
            //console.log('result:' + res.text);
            var result = JSON.parse(res.text);
            expect(result.record_updated).to.equal(1);
            done();
          }
          );//end Post
      });

      it('should startup some depending Human workflows', (done) => {
        var thisRequest = pendingRequests[0].pending_requests[0];
        //console.log(thisRequest);
        //apiTest.post(`/api/tsr/workflow/getHumanflowsBySr/0`)
        apiTest.get(`/api/v1/tsr/workflows/human/` + thisRequest.sr_id)
          .set('Content-Type', 'application/json')
          .set('Accept', 'application/json')
          //.set('source_sr', thisRequest.sr_id)
          .set('is_fulfilled', false)
          .send(input)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function (err, res) {
            if (err) return done(err);

            var result = JSON.parse(res.text);
            //console.log('length:' + result.length);
            //console.log('result:' + JSON.stringify(result));
            expect(result.length).to.gte(1);

            done();
          });
      });

      it('should NOT have any depending Machine workflows started by last approval', (done) => {
        var thisRequest = pendingRequests[0].pending_requests[0];
        //console.log(thisRequest);
        //apiTest.post(`/api/tsr/workflow/getMachineflowsBySr/0`)
        apiTest.get(`/api/v1/tsr/workflows/machine/` + thisRequest.sr_id)
          .set('Content-Type', 'application/json')
          .set('Accept', 'application/json')
          //.set('source_sr', thisRequest.sr_id)
          .set('is_fulfilled', false)
          .send(input)
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function (err, res) {
            if (err) return done(err);

            var result = JSON.parse(res.text);
            //console.log('length:' + result.length);
            //console.log('result:' + JSON.stringify(result));
            expect(result.length).to.equal(0);

            done();
          });
      });


      describe('To reject a service bundle', function () {
        it('should check the bundle if any conflicts');
        it('should update the bundle');
      });
    });

    //Support Team Handling Stage
    describe('Support Team handles handles pending services', function () {

      describe('To complete a New Windows Server Request (T3 Support)', function () {

        var pendingRequests;
        it('should retrieve all pending services', (done) => {
          //apiTest.post(`/api/tsr/request/getAllPendingServices/0`)
          apiTest.get(`/api/v1/tsr/requests`)
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json')
            .set('user_logon', 't3supportlogon')
            .set('user_group', '["t3support"]')
            .send(input)
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function (err, res) {
              if (err) return done(err);

              pendingRequests = res.body
              expect(pendingRequests).to.be.an('array');

              var countPending = 0;
              pendingRequests.forEach((target_role) => {
                //console.log('role: '+ target_role.role);
                target_role.pending_requests.forEach((target_request) => {
                  //console.log('target_request: '+ JSON.stringify(target_request));
                  expect(target_request).to.contain.keys('contents', 'requester', 'sr_id');
                  expect(target_request.contents).to.contain.keys('service_name', 'service_type', 'values');

                  var stages = target_request.contents.stages;
                  stages.forEach((stage) => {
                    expect(stage).to.contain.keys('criteria_queue', 'is_fulfilled');
                    expect(stage).to.not.contain.key('test');
                    expect(stage.criteria_queue).to.be.an('array');
                    //expect(stage.fulfill_criteria).to.be.an('array');
                    expect(stage.is_fulfilled).not.to.be.an('array');
                    expect(stage.workflow_type).to.be.a('string');


                    var targetGroup = stage.user_group;
                    //console.log('targetGroup: ' + targetGroup);
                    if ((stage.by_ref === false)
                      && (util.containsObject(target_role.role, targetGroup))
                      && (stage.is_fulfilled === false)
                      && (stage.workflow_type === "human")
                    ) {

                      //To check if all "criteria_queue" are fulfilled also
                      //console.log('Queue remain: ' + stage.criteria_queue.length);
                      if (stage.criteria_queue.length === 0) {
                        countPending++;
                        /*                     
                        console.log('service: ' + target_request.contents.service_name);
                        console.log('stage: ' + stage.name);
                        console.log('ActionGroup: ' + criteria.user_group);
                        console.log('countPending:' + countPending);  
                        */
                      }
                    }//if any Pending Requests Exist

                  })//forEach Stage
                })//forEach Role
              })//forEach pendingRequests
              expect(countPending).to.be.gte(1);

              done();
            });//end Post       
        });


        it('should complete the service by Support Staff (T3 Support)', (done) => {
          //console.log('Testing:' + JSON.stringify(pendingRequests) );
          //console.log('Testing:' + pendingRequests[0].role );          
          var thisRequest = pendingRequests[0].pending_requests[0];
          //console.log(thisRequest);
          var thisLogon = "t3supportlogon";
          var thisRole = "t3support";
          var thisStageField = "support_handling";
          //console.log('Testing:' + request.sr_id );

          //apiTest.post(`/api/tsr/request/approvePendingService/0`)
          apiTest.put(`/api/v1/tsr/requests/approval/` + thisRequest.sr_id)
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json')
            //.set('sr_id', thisRequest.sr_id)
            .set('criteria_field', thisStageField)
            .set('user_logon', thisLogon)
            .set('user_Role', thisRole)
            .set('user_name', 'T3 Support Staff')
            .set('user_team', 'T3')
            .set('user_title', 'T3 AP')
            .set('user_email', 'abc@ha.org.hk')
            .send(input)
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function (err, res) {
              if (err) return done(err);
              //console.log('result:' + res.text);
              var result = JSON.parse(res.text);
              expect(result.record_updated).to.equal(1);

            }

            );//end Post
          done();
        });


        //=>
        it('should have marked the service item "Completed" in the main Bundle');
        it('should check the whole bundle is still pending with other services');

      });



      //Next Service Request
      describe('To complete a New SQL Server Request', function () {

        var pendingRequests;
        it('should retrieve all pending services', (done) => {
          apiTest.get(`/api/v1/tsr/requests`)
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json')
            .set('user_logon', 'sc3smlogon')
            .set('user_group', '["sc3sm"]')
            .send(input)
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function (err, res) {
              if (err) return done(err);

              pendingRequests = res.body
              expect(pendingRequests).to.be.an('array');

              var countPending = 0;
              pendingRequests.forEach((target_role) => {
                //console.log('role: '+ target_role.role);
                target_role.pending_requests.forEach((target_request) => {
                  //console.log('target_request: '+ JSON.stringify(target_request));
                  expect(target_request).to.contain.keys('contents', 'requester', 'sr_id');
                  expect(target_request.contents).to.contain.keys('service_name', 'service_type', 'values');

                  var stages = target_request.contents.stages;
                  stages.forEach((stage) => {
                    expect(stage).to.contain.keys('criteria_queue', 'is_fulfilled');
                    expect(stage).to.not.contain.key('test');
                    expect(stage.criteria_queue).to.be.an('array');
                    //expect(stage.fulfill_criteria).to.be.an('array');
                    expect(stage.is_fulfilled).not.to.be.an('array');
                    expect(stage.workflow_type).to.be.a('string');


                    var targetGroup = stage.user_group;
                    //console.log('targetGroup: ' + targetGroup);
                    if ((stage.by_ref === false)
                      && (util.containsObject(target_role.role, targetGroup))
                      && (stage.is_fulfilled === false)
                      && (stage.workflow_type === "human")
                    ) {

                      //To check if all "criteria_queue" are fulfilled also
                      //console.log('Queue remain: ' + stage.criteria_queue.length);
                      if (stage.criteria_queue.length === 0) {
                        countPending++;
                        /*                   
                       console.log('service: ' + target_request.contents.service_name);
                       console.log('stage: ' + stage.name);
                       //console.log('ActionGroup: ' + criteria.user_group);
                       console.log('countPending:' + countPending);  
                       */
                      }
                    }//if any Pending Requests Exist

                  })//forEach Stage
                })//forEach Role
              })//forEach pendingRequests
              expect(countPending).to.be.gte(1);

              done();
            });//end Post       
        });

        it('should approve as Support Team Manager (T3)', (done) => {
          //console.log('Testing:' + JSON.stringify(pendingRequests) );
          //console.log('Testing:' + pendingRequests[0].role );
          var thisRequest = pendingRequests[0].pending_requests[0];
          var thisLogon = "sc3smlogon";
          var thisRole = "sc3sm";
          var thisStageField = "support_manager_approval";
          //console.log('Testing:' + request.sr_id );
          /*
                        {"field":"requester_manager_approval",
                  "by_ref":false,
                  "user_group":["t1sm"]}
                  */
          apiTest.put(`/api/v1/tsr/requests/approval/` + thisRequest.sr_id)
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json')
            //.set('sr_id', thisRequest.sr_id)
            .set('criteria_field', thisStageField)
            .set('user_logon', thisLogon)
            .set('user_Role', thisRole)
            .set('user_name', 'Chris Wong')
            .set('user_team', 'SC3')
            .set('user_title', 'SC3 Manager')
            .set('user_email', 'abc@ha.org.hk')
            .send(input)
            .expect(200)
            .expect('Content-Type', /json/)
            .end(function (err, res) {
              if (err) return done(err);
              //console.log('result:' + res.text);
              var result = JSON.parse(res.text);
              expect(result.record_updated).to.equal(1);
              done();
            }
            );//end Post
        });



        //=>
        describe('To startup depended requests: "Data Backup Service"', function () {
          it('should autofeed depended fields');
          it('should notify responding parties to fill remaining required fields');
          it('should fill remaining required fields');
        });
        describe('To startup depended requests: "File Server Service"', function () {
          it('should autofeed depended fields');
        });
        describe('To startup depended requests: "Firewall Change Service"', function () {
          it('should autofeed depended fields');
        });
        describe('To startup depended requests: "Email Relay Service"', function () {
          it('should autofeed depended fields');
        });
        describe('To startup depended requests: "DNS Service"', function () {
          it('should autofeed depended fields');
        });
        describe('To startup depended requests: "E-Cert Service"', function () {
          it('should autofeed depended fields');
        });
        describe('To startup depended requests: "IBRA Service"', function () {
          it('should autofeed depended fields');
        });
      });

      //Next Service Request
      describe('To complete a Data Backup Request', function () {
        it('should check the bundle if any conflicts');
        it('should update the bundle');
        it('should startup some depended requests in the bundle');
      });

    });

    describe('To reject a service bundle', function () {
      it('should check the bundle if any conflicts');
      it('should update the bundle');
    });
  });


  describe('Background process:', function () {
    it('should pick one Human workflow to notify the corresponding User Groups');
    it('should pick one Machine workflow to process');
  })
  /*
  //Test Next Service Bundle
  describe('"Launch Web Application (Linux)" is selected', function () {
    describe('To submit the application form', function () {
      it('should create a service bundle template with all requests');
      it('should check the required fields in each request');
  
      describe('Add an ad-hoc request into the bundle', function () {
        it('check if any conflicts');
        it('should update related dependencies');
      });
  
      describe('Remote a request from the bundle', function () {
        it('check if any conflicts');
        it('should update related dependencies');
      });
  
    })
  */
});
