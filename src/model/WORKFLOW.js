"use strict"
var mongoose = require('mongoose');
console.log("in Workflow.js")
let moment = require('moment');
const dateFormat = 'DD-MMM-YYYY HH:mm';

let Schema = new mongoose.Schema({
  service_id: {
    type: mongoose.Types.ObjectId,
    required: true
  },
  bundle_id: {
    type: String,
    required: true
  },
  bundle_name: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: false
  },
  stage_name: {
    type: String,
    required: true
  },
  approvers: [{
    group_id: String,
    group_name: String
  }],
  approvedBy: {
    type: String,
    required: false
  },
  status: {
    type: String,
    required: true
  },
  man_hours: {
    type: Number,
    required: false
  },
  assign_to_support: {
    type: String,
    required: false
  },
  assign_to_supervisor: {
    type: String,
    required: false
  },
  stage_id: {
    type: Number,
    required: false
  },
  // approvalDate: {
  //   type: String,
  //   required: false
  // },
  service_name: {
    type: String
  },
  service_type: {
    type: String
  },
  submittedBy: {
    type: String,
    required: true
  },
  approvalDate: {
    type: Date,
    required: false
    // default: () => {
    //   return moment(new Date()).format(dateFormat);
    // }
  },
});

module.exports = mongoose.model('workflow', Schema);