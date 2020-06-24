'use strict';
let mongoose = require('../mongoose');
let Services = require('../model/SERVICES');
let Bundles = require('../model/BUNDLES');
let Workflow = require('../model/WORKFLOW');
let ReqHistory = require('../model/SERVICE_HISTORY');
let Userprofile = require('../model/USER_PROFILE');
let ConfigBundle = require('../model/CONFIG_BUNDLE');
let ConfigRequest = require('../model/CONFIG_REQUEST');
let ConfigOther = require('../model/CONFIG_OTHER');
let express = require('express');
let router = express.Router();
let moment = require('moment');
const dateFormat = 'DD-MMM-YYYY HH:mm';
let userProfiles = new Object();
let ups = null;

mongoose.connection.on('connected', function () {
  //cache the profile users for response
  getUserDataById();
});

//cache the profile users for response.
function getUserDataById(userid) {
  if (userProfiles && userProfiles[userid]) {
    return userProfiles[userid];
  }
  //else if data is stale because of lately user added
  else {
    console.log('userProfiles userid', userid);
    Userprofile.find({}).exec(function (err, ups) {
      ups.forEach(item => {
        userProfiles[item.userid] = item;
      });
    });
    if (userProfiles[userid] !== undefined) {
      return userProfiles[userid]
    }
    else {
      userProfiles[userid] = {};
      return userProfiles[userid];
    }
  }
}

async function updatePhoneNumber(user_id, phone_number) {
  if (user_id && phone_number) {
    let lclUp = userProfiles[user_id];
    console.log("userProfiles[user_id]", lclUp);
    let upd = await Userprofile.updateOne(
      { "userid": user_id },
      {
        $set: {
          "phone_number": phone_number
        }
      });
    lclUp.phone_number = phone_number;
    console.log("userProfiles[user_id]", lclUp);
    console.log("service_data.phone_number ", upd);
  }
}

router.get('/ui', async (req, res) => {
  try {
    let bundles = await ConfigBundle.find({});
    let requests = await ConfigRequest.find({});
    let others = await ConfigOther.find({});
    res.status(200).send({
      status: true,
      configBundleUI: bundles,
      configRequestUI: requests,
      others: others,
    });
  } catch (err) {
    res.status(500).send({ status: false, err: err });
  }
});

router.post('/service/history', function (req, res) {
  let data = req.body;
  let newComment = new ReqHistory(data);
  newComment.save(function (err, comment) {
    if (err) { res.status(417).send({ status: false, msg: err }); };
    res.status(200).send({ status: true });
  });
});

router.put('/service', function (req, res) {
  console.log("======put(/service)======>", req.body.data._id, req.body.data);
  let service_data = req.body.data;
  console.log('service_data phone_number', service_data.phone_number);
  const userid = req.body.user;
  console.log('user', req.body.user);

  if (service_data.phone_number) {
    updatePhoneNumber(userid, service_data.phone_number);
  }

  Services.updateOne(
    { _id: req.body.data._id },
    { service_data: service_data },
    //{ upsert: true }
  ).then(
    () => {
      //console.log("55555555")
      res.status(200).send({ status: true })
    }
  ).catch(err => {
    res.status(417).send({ status: false, msg: err });
  })

});

router.delete('/service/', function (req, res) {
  console.log("req.body============>", req.body.data._id, req.body.data);
  Services.deleteOne({ _id: req.body.data._id })
    .then(() => { return ReqHistory.deleteMany({ service_id: req.body.data._id }) })
    .then(() => { return Workflow.deleteMany({ service_id: req.body.data._id }) })
    .then(() => res.status(200).send({ status: true }))
    .catch(err => { res.status(417).send({ status: false, msg: err }); });

});

router.post('/service/save/', async function (req, res) {
  let data = req.body.data;
  console.log("/service/save/ ", data);
  const bn = req.body.data.bundle_name;
  const user = req.body.data.submittedBy;
  const stageArr = req.body.stages;
  try {
    const userProfile = await Userprofile.findOne({ userid: user });
    let curBundle = await Bundles.findOne({ bundle_name: bn });
    data.bundle_id = curBundle._id;
    data.bundle_type = curBundle.bundle_type;
    data.displayname = userProfile.displayname;
    let newServices = new Services(data);
    let curService = await newServices.save();
    data = { ...data, ...curService._doc };
    let tmp = setApprovalGroups("saved", data, stageArr, userProfile);
    if (tmp.length > 0) {
      await Workflow.insertMany(tmp);
    }
    let wfRes = await Workflow.find({ service_id: data._id });
    res.status(200).send({ status: true, data: data, wf: wfRes });
  } catch (e) {
    res.status(417).send({ status: false, msg: e });
  }
});

router.post('/service/submit/', async function (req, res) {
  let data = req.body;
  console.log("datadatadatadatadata===>", data);

  try {
    let first = await Workflow.findOneAndUpdate({ stage_id: 0, service_id: data.rowValues._id },
      { status: "approved", approvedBy: data.user }, { new: true });
    let second = await Workflow.findOneAndUpdate({ stage_id: 1, service_id: data.rowValues._id },
      { status: "pending" }, { new: true });
    let serviceUpd = await Services.updateOne({ _id: data.rowValues._id },
      { service_data: data.rowValues });
    if (first && second) {
      let tmp = { service_id: data.rowValues._id, action: "submit", user: data.user, comment: "Submit Request" };
      let newReqHistory = new ReqHistory(tmp);
      let histRes = await newReqHistory.save();
      if (histRes) {
        res.status(200).send({ status: true, data: { history: histRes, wf: second } });
      }
    } else {
      res.status(417).send({ status: false, msg: e });
    }
  } catch (e) {
    res.status(417).send({ status: false, msg: e });
  }
});

router.post('/update/stage/support', async function (req, res) {
  console.log('req.body', req.body);
  const stage_name = req.body.stage_name;
  const service_id = req.body.service_id;
  const assign_to_supervisor = req.body.assign_to_supervisor;
  const assign_to_support = req.body.assign_to_support;
  const status = "pending";
  const user = req.body.assigned_by;
  let comment = "";
  let setQury = {};
  let resObj = { status: false };

  if (!((assign_to_supervisor !== undefined || assign_to_support !== undefined) && stage_name && service_id)) {
    res.status(400).send({ status: false, msg: "parameters are missing" });
  }

  // let assignee
  // if (assign_to_supervisor !== undefined) {
  //   comment = "Assign Supervisor: ";
  //   assignee = assign_to_supervisor
  // }
  // else if (assign_to_support !== undefined) {
  //   comment = "Assign Support: ";
  //   assignee = assign_to_support
  // }

  // assignee = getUserDataById(assignee)

  // let assignee_email = ""
  // let clear_assign = true
  // if (Object.entries(assignee).length !== 0) { //if not empty object, it means assigned to someone. So set email for notification
  //   comment += assignee.displayname
  //   assignee_email = assignee.email
  //   clear_assign = false
  // }

  setQury = { ...req.body };


  let wf_fu = null;
  try {
    wf_fu = await Workflow.findOneAndUpdate({
      service_id: service_id,
      stage_name: stage_name,
      status: status,
    }, { $set: setQury });
  }
  catch (err) {
    res.status(417).send({ status: false, msg: err });
  }

  // if (wf_fu) {
  //   resObj.status = true;
  //   //add comment
  //   addCommentToHistory({
  //     service_id: service_id,
  //     action: "assign",
  //     user: user,
  //     comment: comment,
  //     support_group: req.body.support_group,
  //     assignee_email: assignee_email,
  //     clear_assign: clear_assign
  //   });
  // }
  resObj.data = wf_fu;

  res.status(200).send(resObj);

});

function getServiceData(data) {
  let newService = new Services(data);
  return newService;//.save();
}

async function saveServiceData(promiseServices) {
  for (const model of promiseServices)
    await model.save();
}

router.post('/new', async function (req, res) {
  const user = req.body.user;
  try {
    const up = await Userprofile.findOne({ userid: user });
    console.log('userprofile found in new may have phone_number', up.phone_number);
    let bundleData = req.body;
    let newBundle = new Bundles(bundleData);
    let curBundle = await newBundle.save();
    let serviceData = req.body.data.services;
    let tmpServices = [];
    let service_type = Object.keys(serviceData);
    service_type.forEach((key) => {
      serviceData[key]["data"].forEach(data => {
        let obj = {
          bundle_id: curBundle._id,
          bundle_name: curBundle.bundle_name,
          service_type: key,
          service_data: data,
          submittedBy: user
        }
        tmpServices.push(getServiceData(obj));
      });
    });
    await saveServiceData(tmpServices);
    let services = await Services.find({ bundle_id: curBundle._id });
    if (services.length > 0) {
      for (let i = 0; i < services.length; i++) {
        if (curBundle.status === "inprogress") {
          //let tmpHistory = {};
          let tmpCmt = [];
          // if (!tmpHistory[services[i]._id]) {
          //   tmpHistory[services[i]._id] = {};
          tmpCmt.push({
            service_id: services[i]._id,
            action: "submit",
            user: user,
            comment: "Submit Request"
          });
          // }
          await ReqHistory.insertMany(tmpCmt, { ordered: true });
        }
        let curService = services[i];
        let stageArr = serviceData[curService.service_type]["stage"][0];
        let tmp = setApprovalGroups(curBundle.status, curService, stageArr, up);
        if (tmp.length > 0) {
          await Workflow.insertMany(tmp);
        }
      }
    }
    res.status(200).send({ status: true });
  } catch (e) {
    //console.log("error", e)
  }
});

function setApprovalGroups(status, curService, stageArr, userProfile) {
  console.log("tttt", stageArr)
  let tmp = [];
  let sorted = stageArr.sort(function (a, b) {
    if (a.stage_id > b.stage_id) return 1;
    else if (a.stage_id < b.stage_id) return -1;
    else return 0;
  });
  let template = {
    "bundle_id": curService.bundle_id,
    "bundle_name": curService.bundle_name,
    "submittedBy": curService.submittedBy,
    "service_type": curService.service_type,
    "service_id": curService._id,
    "service_name": curService.service_name,
  }
  console.log("template", template, "sorted", sorted)
  for (let j = 0; j < sorted.length; j++) {
    let stage = sorted[j];
    let obj = {};
    obj.stage_name = stage.stage_name ? stage.stage_name : "xxx";
    obj.name = stage.name;
    obj.stage_id = stage.stage_id;
    obj.status = (j === 0 && status === "inprogress") ? "pending" : "waiting";
    if (stage.stage_name === "reqManager") {
      obj.approvers = userProfile.approvers ? userProfile.approvers : [{
        group_id: "000",
        group_name: "ooo"
      }];
    } else {
      obj.approvers = stage.approvers ? stage.approvers : [{
        group_id: "000",
        group_name: "ooo"
      }];
    }
    tmp.push({ ...obj, ...template });
  }
  tmp.splice(0, 0, {
    ...template,
    "stage_id": 0,
    "stage_name": "submit",
    "name": "Request Submitted",
    "status": (status === "inprogress") ? "approved" : "waiting"
  });
  tmp.push({
    ...template,
    "stage_id": sorted[sorted.length - 1].stage_id + 100,//tmp.length,
    "stage_name": "completed",
    "name": "Request Completed",
    "status": "waiting"
  });
  //console.log("setApprovalGroups tmp", tmp);
  return tmp;
}

router.post('/bundle/status', async function (req, res) {
  try {
    const user = req.body.user;
    let status = req.body.newStatus.substring(0, 2) === "to" ?
      req.body.newStatus.substring(2) : req.body.newStatus;
    await Bundles.updateOne(
      { "bundle_name": req.body.id },
      {
        $set: {
          "status": status
        }
      },
      { new: true });
    if (req.body.newStatus === "withdrawn" || req.body.newStatus === "inprogress") {
      if (req.body.newStatus === "inprogress") {
        await Workflow.bulkWrite([{
          updateMany: {
            filter: { stage_id: 1, "bundle_name": req.body.id },
            update: { status: "pending" }
          }
        },
        ]);
      }

      if (req.body.newStatus === "withdrawn") {
        await Workflow.bulkWrite([{
          updateMany: {
            filter: { $or: [{ status: "pending" }, { status: "waiting" }], "bundle_name": req.body.id },
            update: { status: "all_withdrawn" }
          }
        },
        ]);
      }
      let action = "";
      let wf_arr = [];
      if (req.body.newStatus === "withdrawn") {
        let filter = { status: "all_withdrawn", stage_name: "completed", bundle_name: req.body.id };
        wf_arr = await Workflow.find(filter);
        await Workflow.updateMany(
          { status: "all_withdrawn", bundle_name: req.body.id },
          { $set: { status: "withdrawn" } });
        action = "withdrawn";
      }
      if (req.body.newStatus === "inprogress") {
        let filter = { status: "pending", "bundle_name": req.body.id };
        wf_arr = await Workflow.find(filter);
        action = "submit";
      }
      let tmpCmt = []
      for (let j = 0; j < wf_arr.length; j++) {
        tmpCmt.push({
          service_id: wf_arr[j].service_id,
          action: action,
          user: user,
          comment: action + " Request"
        });
      }
      await ReqHistory.insertMany(tmpCmt, { ordered: true });
    }
    res.status(200).send({ status: true });
  } catch (e) {
    res.status(417).send({ status: false, msg: 'there is no bundle with specified id' });
  }
});

function addCommentToHistory(comment) {
  let newComment = new ReqHistory(comment);
  return newComment.save().then(true).catch(false)
}

async function getApproversByUserId(group_name) {
  return await Userprofile
    .aggregate([{ $match: { "member_of.group_name": group_name } }])
    .group({ _id: "$member_of.group_name", members: { $addToSet: { userid: "$userid", displayname: "$displayname" } }, count: { $sum: 1 } })
    .sort("-count");
}

router.get('/approvers/:group_name', function (req, res) {
  let group_name = req.params.group_name;
  getApproversByUserId(group_name).then(result => {
    if (result) {
      return res.status(200).send({ status: true, approvers: result });
    } else {
      return res.status(417).send({ status: false });
    }
  })
});

router.post('/approve', function (req, res) {
  let approved_id = req.body.approved_id;
  let pending_id = req.body.pending_id;
  let other_id = req.body.other_id;
  console.log('pending_id', pending_id);
  console.log('approved_id', approved_id);
  let approvalDate = moment(new Date()).format(dateFormat);
  let man_hours = req.body.man_hours;
  let approvedBy = req.body.approvedBy;
  let comment = {
    ...req.body.comment,
    service_id: req.body.service_id,
    user: approvedBy, date: approvalDate
  };
  if (approved_id || pending_id) {
    Workflow.bulkWrite([{
      updateOne:
      {
        "filter": { "_id": approved_id },
        "update": {
          $set:
          {
            "status": "approved",
            "comments": comment,
            "approvedBy": approvedBy,
            "approvalDate": approvalDate
          }
        }
      }
    },
    {
      updateOne:
      {
        "filter": {
          "_id": pending_id
        },
        "update": {
          $set: {
            "status": "pending",
            "comments": comment,
            "approvedBy": approvedBy,
            "approvalDate": approvalDate
          }
        }
      }
    },
    {
      updateOne:
      {
        "filter": {
          "_id": other_id
        },
        "update": {
          $set: {
            "status": approved_id ? "approved" : "pending"
          }
        }
      }
    },
    {
      updateOne:
      {
        "filter": {
          "_id": pending_id,
          "service_id": mongoose.Types.ObjectId(req.body.service_id),
          "stage_name": "completed"
        },
        "update": {
          $set: {
            "status": "completed",
            "man_hours": man_hours,
            "approvedBy": approvedBy,
            "approvalDate": approvalDate
          }
        },
      }
    }])
      .then(() => {
        if (comment.action === "complete") {
          let tmp = { ...comment, action: "handle" }
          return addCommentToHistory(tmp);
        } else {
          return addCommentToHistory(comment);
        }
      })
      .then(() => {
        return isServiceCompleted(pending_id);
      })
      .then(status => {
        if (status && status.bundle_status === true) {
          return addCommentToHistory(comment);
        } else {
          return false;
        }
      })
      .then(result => {
        if (result) {
          res.status(200).send({ bundle_status: true });
        } else {
          res.status(200).send({ bundle_status: false });
        }
      })
      .catch(err => { res.status(417).send({ status: false, msg: err }); })
  } else {
    if (comment.action === "assign") {
      const assignee = getUserDataById(req.body.assignee)
      let clear_assign = true
      if (Object.entries(assignee).length !== 0) { //if not empty object, it means assigned to someone. So set email for notification
        comment.assignee_email = assignee.email
        clear_assign = false
      }
      comment.clear_assign = clear_assign
    }
    addCommentToHistory(comment)
      .then(result => {
        if (result) {
          return res.status(200).send({ status: true });
        } else {
          return res.status(417).send({ status: false });
        }
      })
      .catch(err => { res.status(417).send({ status: false, msg: err }); })
  }
});

async function isServiceCompleted(pending_id) {
  try {
    const curWF = await Workflow.findOne({ _id: pending_id });
    console.log("curWF:", curWF);
    const result = await Workflow.find({ bundle_id: curWF.bundle_id, stage_name: "completed" });
    console.log("allWF:", result);
    let is_bundle_completed = {};
    if (result.length > 0) {
      for (let j = 0; j < result.length; j++) {
        if (is_bundle_completed[result[j]["status"]]) {
          is_bundle_completed[result[j]["status"]] = is_bundle_completed[result[j]["status"]] + 1;
        } else {
          is_bundle_completed[result[j]["status"]] = 1;
        }
      }
    }
    let res_req = { service_status: curWF["stage_name"] === "completed", bundle_status: false }
    console.log("is_bundle_completed:", is_bundle_completed, " result.length", result.length, "res_req.bundle_status", res_req.bundle_status);
    if (is_bundle_completed.withdrawn === result.length) {
      await Bundles.updateOne({ _id: result[0].bundle_id }, { $set: { status: "withdrawn" } });
      res_req.bundle_status = true;
    } else if (is_bundle_completed.completed === result.length) {
      await Bundles.updateOne({ _id: result[0].bundle_id }, { $set: { status: "completed" } });
      res_req.bundle_status = true;
    }
    return res_req;
  } catch (e) {
    console.log("error", e)
  }

}
router.post('/withdrawn', function (req, res) {
  let withdrawn_id = req.body.withdrawn_id;
  let approvalDate = moment(new Date()).format(dateFormat); //req.body.approvalDate;
  let approvedBy = req.body.approvedBy;
  let comment = {
    ...req.body.comment,
    service_id: req.body.service_id,
    user: approvedBy,
    date: approvalDate
  };
  Workflow.bulkWrite([{
    updateOne: {
      "filter": { "_id": withdrawn_id },
      "update": {
        $set:
        {
          "status": req.body.comment.action,
          "comments": comment,
          "approvedBy": approvedBy,
          "approvalDate": approvalDate
        }
      }
    }
  }, {
    updateOne:
    {
      "filter": { "service_id": mongoose.Types.ObjectId(req.body.service_id), "stage_name": "completed" },
      "update": { $set: { "status": req.body.comment.action } }
    }
  }])
    .then(result => {
      return addCommentToHistory(comment);
    })
    .then(result => {
      return isServiceCompleted(withdrawn_id);
    })
    .then(result => {
      console.log("!!!!result", result.bundle_status)
      res.status(200).send({ bundle_status: result.bundle_status });
    })
    .catch(err => { res.status(417).send({ status: false, msg: err }); })
});
function getUnique(arr, comp) {
  const unique = arr
    .map(e => e[comp])
    .map((e, i, final) => final.indexOf(e) === i && i)
    .filter(e => arr[e]).map(e => arr[e]);
  return unique;
}

function findItemsByCond(model, cond, res, extra) {
  let tmp_cond = cond;
  if (cond["$and"] && cond["$and"][1] && cond["$and"][1].status === "inprogress") {
    Services.aggregate([
      { $match: cond["$and"][0] },
      {
        $lookup: {
          from: "bundles",
          localField: "bundle_name",
          foreignField: "bundle_name",
          as: "bundles"
        }
      },
      { $unwind: "$bundles" },
      {
        $project: {
          bundles: 1
        }
      },
    ]).then(bundles => {
      let result = []
      bundles.forEach(bndl => {
        let item = bndl["bundles"];
        if (item.status === "inprogress") {
          if (item.displayname == undefined) {
            let userData = getUserDataById(item.user);
            item.displayname = userData.displayname;
            item.phoneNumber = userData.phoneNumber;
          }
          result.push(item);
        }
      });
      let new_result = getUnique(result, 'bundle_name');
      return res.status(200).send({ bundles: new_result, status: true });
    })
  } else {
    model.find(tmp_cond, { "__v": 0 }, function (err, bundles) {
      if (err) { return res.status(417).send({ status: false, msg: err }); };
      let result = { bundles: bundles, status: true };

      bundles.forEach(item => {
        if (item.displayname == undefined) {
          let userData = getUserDataById(item.user);
          item.displayname = userData.displayname;
          item.phoneNumber = userData.phoneNumber;
        }
      })

      if (extra) {
        result = { ...result, pendingServices: extra }
      }
      return res.status(200).send(result);
    });
  }
}

router.get('/list/:status/:user', function (req, res) {
  let status = req.params.status;
  let user = req.params.user;
  let cond = {};
  //console.log("status ====>", status);
  switch (status) {
    case "withdrawn":
      cond = {
        $and: [
          { user: user },
          { status: "withdrawn" }
        ]
      }
      return findItemsByCond(Bundles, cond, res);
    case "inprogress":
      //console.log("here we are ====>inprogress");
      cond = {
        $and: [
          { submittedBy: user },
          { status: "inprogress" }
          //{ $or: [{ status: "inprogress" }, { status: "withdrawn" }] }
        ]
      }
      return findItemsByCond(Bundles, cond, res);
    case "worklist":
      //console.log("here we are ====> worklist");
      return Userprofile.findOne({ userid: user }).exec(function (err, userProfile) {
        if (err) { return res.status(417).send({ status: false, msg: err }); };
        if (!userProfile) {
          return res.status(417).send({ status: false, msg: 'no user with such a name' });
        } else {
          let groups = userProfile.member_of;
          if (!groups || groups.length === 0) {
            return res.status(200).send({ bundles: [], status: true });
          } else {
            let condition = {};
            if (groups.length > 1) {
              let cond = [];
              groups.forEach(group => {
                cond.push({
                  "approvers": {
                    $elemMatch: group
                  }
                })
              })
              condition = { $or: cond }
            } else {
              condition = {
                "approvers": {
                  $elemMatch: groups[0]
                }
              }
            }
            console.log("")
            return Workflow.find({
              $and: [
                condition,
                { "status": "pending" }
              ]
            }, {
                bundle_id: 1,
                service_id: 1
              })
              // .distinct("bundle_id")
              .exec(function (err, wf) {
                if (err) { return res.status(417).send({ status: false, msg: err }); };
                //console.log("wf length", wf.length, "wf", wf);
                let wfArr = { bundle_id: [], service_id: [] };
                // del dublicates
                wf.forEach(item => {
                  if (wfArr["bundle_id"].indexOf(item["bundle_id"]) === -1) {
                    wfArr["bundle_id"].push(item["bundle_id"]);
                  }
                  if (wfArr["service_id"].indexOf(item["service_id"]) === -1) {
                    wfArr["service_id"].push(item["service_id"]);
                  }
                })
                if (wfArr["bundle_id"].length === 0) {
                  return res.status(200).send({ bundles: [], status: true });
                } else {
                  return findItemsByCond(Bundles, { _id: { $in: wfArr["bundle_id"] }, status: "inprogress" }, res, wfArr["service_id"]);
                }
              });
          }
        }
      });
    case "saved":
    case "completed":
      console.log("here we are ====> completed || saved");
      cond = { user: user, status: status }
      return findItemsByCond(Bundles, cond, res);
    case "handled":
      console.log("here we are ====> handled");
      cond = { approvedBy: user, status: "approved" }
      return Workflow.find(cond).distinct("bundle_id").exec(function (err, wf) {
        if (err) { res.status(417).send({ status: false, msg: err }); };
        console.log("wf", wf, wf.length);
        if (!wf || wf.length === 0) {
          res.status(200).send({ bundles: [], status: true });
        } else {
          return findItemsByCond(Bundles, { _id: { $in: wf } }, res);
        }
      });
    default:
      return res.status(417).send({ status: false, msg: "status undefined" });
  }
});

router.get('/bundle/services/:id', async function (req, res) {
  try {
    let bndlId = req.params.id;
    let services = await Bundles.aggregate([
      { $match: { bundle_name: bndlId } },
      {
        $lookup: {
          from: "services",
          localField: "bundle_name",
          foreignField: "bundle_name",
          as: "service"
        }
      },
      {
        $unwind: "$service"
      },
      {
        $lookup: {
          from: "workflows",
          localField: "bundle_name",
          foreignField: "bundle_name",
          as: "workflow"
        }
      }
    ]);
    let dataSource = {};
    let srvHistory = {};
    let tmpSrvIds = [];
    let checkPopulate = [];
    dataSource[services[0].bundle_type] = {};
    if (services) {
      services.forEach(item => {
        //console.log("item=====", item);
        tmpSrvIds.push(item.service._id);
        if (!dataSource[services[0].bundle_type][item.service.service_type]) {
          dataSource[services[0].bundle_type][item.service.service_type] = { data: [], stage: [] }
        }
        let wf = item.workflow.filter(wf => wf.service_name == item.service.service_name);

        console.log("_wf.forEach > end");

        let st = "saved";
        let isApproved = item.workflow.some(function (wf) {
          return (wf.service_name == item.service.service_name && wf.status === "approved");
        });
        if (isApproved === true) { st = "complete" };
        let isInProgress = item.workflow.some(function (wf) {
          return (wf.service_name == item.service.service_name && wf.status === "pending");
        });
        if (isInProgress === true) { st = "inprogress" };
        let isWithdrawn = item.workflow.some(function (wf) {
          return (wf.service_name == item.service.service_name && wf.status === "withdrawn");
        });
        if (isWithdrawn === true) { st = "withdrawn" };
        let isRejected = item.workflow.some(function (wf) {
          return (wf.service_name == item.service.service_name && wf.status === "rejected");
        });
        if (isRejected === true) { st = "rejected" };

        let userData = getUserDataById(item.service.submittedBy);
        const displayname = userData.displayname;
        const phoneno = userData.phone_number;

        dataSource[services[0].bundle_type][item.service.service_type]["data"].push(
          {
            ...item.service["service_data"],
            _id: item.service._id,
            service_name: item.service.service_name,
            status: st,
            date: item.service.date,
            submittedBy: item.service.submittedBy,
            phone_number: phoneno,
            displayname: (item.service.displayname !== undefined ? item.service.displayname : displayname),
          }
        );

        wf.map((_wf) => {
          _wf.approverName = getUserDataById(_wf.approvedBy).displayname;
          _wf.displayname = getUserDataById(_wf.submittedBy).displayname;
          _wf.updated_date = moment(_wf.approvalDate).format(dateFormat);
          _wf.approvers.map((_apr) => {
            try {
              let result = getApproversByUserId(_apr.group_name);
              checkPopulate.push(result);
              result.then((re) => {
                _apr['members'] = re[0].members;
              });
            }
            catch (e) {
              console.debug(e);
            }
          });
        });

        dataSource[services[0].bundle_type][item.service.service_type]["stage"].push(wf);

        // let history = ReqHistory.find({ service_id: item.service._id });
        // console.log("history=====", history());
        // for (let j = 0; j < history.length; j++) {
        //   let tmp = JSON.parse(JSON.stringify(history[j]));
        //   tmp.date = moment(tmp.date).format(dateFormat);
        //   console.log("tmp=====", tmp);
        //   if (!srvHistory[item.service._id]) {
        //     srvHistory[item.service._id] = [];
        //     srvHistory[item.service._id].push(tmp);
        //   }
        // }
      });
    }
    let reqHistory;
    if (tmpSrvIds.length > 0) {
      reqHistory = await ReqHistory.find({ service_id: { $in: tmpSrvIds } }, { "__v": 0 }, function (err, history) {
        for (let j = 0; j < history.length; j++) {
          let tmp = JSON.parse(JSON.stringify(history[j]));
          let userData = getUserDataById(tmp.user)
          tmp.displayname = userData.displayname;
          //tmp.date = moment(tmp.date).format(dateFormat);
          if (srvHistory[tmp.service_id] == undefined)
            srvHistory[tmp.service_id] = [];
          srvHistory[tmp.service_id].push(tmp);
        }
        if (err) { return res.status(417).send({ status: false, msg: err }); };
        console.log("ReqHistory result");
      })
    }

    Promise.all(checkPopulate.concat(reqHistory)).then(function (values) {
      res.status(200).send({ status: true, dataServices: dataSource, history: srvHistory });
      //console.log("Promise", values);
    });

    //res.status(200).send({ status: true, dataServices: dataSource, history: srvHistory });
    console.log("response end status 200 ");


  } catch (e) {
    console.log("error at getting Bundle: ", e);
    res.status(417).send({ status: false, msg: "Error at getting bundle" });
  }
});



router.get('/bundle/services/:id1', function (req, res) {
  let bndlId = req.params.id;
  Services.aggregate([
    { $match: { bundle_name: bndlId } },
    {
      $lookup: {
        from: "workflows",
        localField: "_id",
        foreignField: "service_id",
        as: "service_wf"
      }
    },
    {
      $project: {
        _id: 1,
        submittedBy: 1,
        status: 1,
        service_name: 1,
        date: 1,
        service_id: 1,
        service_type: 1,
        service_data: 1,
        service_wf: 1
      }
    }
  ]).then(services => {
    console.log("services", services)
    if (services) {
      let tmp = {};
      let tmpstg = {};
      let tmpSrvIds = [];
      let srvHistory = {};
      services.forEach(item => {
        tmpSrvIds.push(item._id);
        if (!srvHistory[item._id]) {
          srvHistory[item._id] = [];
        }
        let st = "saved";
        let isApproved = item.service_wf.some(function (item) {
          return item.status === "approved";
        });
        if (isApproved === true) { st = "complete" };

        let isInProgress = item.service_wf.some(function (item) {
          return item.status === "pending";
        });
        if (isInProgress === true) { st = "inprogress" };

        let isWithdrawn = item.service_wf.some(function (item) {
          return item.status === "withdrawn";
        });

        if (isWithdrawn === true) { st = "withdrawn" };

        let isRejected = item.service_wf.some(function (item) {
          return item.status === "rejected";
        });

        if (isRejected === true) { st = "rejected" };
        //console.log(" st", st)
        if (!tmp[item.service_type]) {
          tmp[item.service_type] = [];
          tmpstg[item.service_type] = [];
        }
        tmp[item.service_type].push({ ...item.service_data, _id: item._id, service_name: item.service_name, status: st, date: item.date, submittedBy: item.submittedBy });
        tmpstg[item.service_type].push(item.service_wf);
      });
      if (tmpSrvIds.length > 0) {
        ReqHistory.find({ service_id: { $in: tmpSrvIds } }, { "__v": 0 }, function (err, history) {
          for (let j = 0; j < history.length; j++) {
            let tmp = JSON.parse(JSON.stringify(history[j]));
            tmp.date = moment(tmp.date).format(dateFormat);
            srvHistory[tmp.service_id].push(tmp);
          }
          if (err) { return res.status(417).send({ status: false, msg: err }); };
          res.status(200).send({ "services": tmp, "stages": tmpstg, status: true, "history": srvHistory });
        })
      } else {
        res.status(200).send({ "services": tmp, "stages": tmpstg, status: true });
      }
    } else {
      res.status(417).send({ status: false, msg: err });
    };
  })
});

router.delete('/bundle/:id', function (req, res) {
  Bundles.deleteOne(req.body)
    .then(() => { return Services.find({ bundle_id: req.body._id }, { _id: 1 }) })
    .then(result => {
      let locs = result.map(function (x) { return x.id });
      return ReqHistory.deleteMany({ service_id: { $in: locs } })
    })
    .then(() => { return Workflow.deleteMany({ bundle_id: req.body._id }) })
    .then(() => { return Services.deleteMany({ bundle_id: req.body._id }) })
    .then(() => res.status(200).send({ status: true }))
    .catch(err => { res.status(417).send({ status: false, msg: err }); });
})

module.exports = router;
