"use strict"
let mongoose = require('mongoose');
console.log("in SERVICE_HISTORY.js")
let moment = require('moment');
const dateFormat = 'DD-MMM-YYYY HH:mm';

var Schema = new mongoose.Schema({
  service_id: {
    type: String,
    required: true
  },
  user: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  comment: {
    type: String,
    required: false
  },
  date: {
    type: String, default: () => {
      return moment(new Date()).format(dateFormat);
    }
  },
  support_group: Array,
  assignee_email: String,
  clear_assign: Boolean,
  send_to_requester: Boolean
});

module.exports = mongoose.model('history', Schema);