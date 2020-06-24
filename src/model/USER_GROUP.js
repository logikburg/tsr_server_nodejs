"use strict"
var mongoose = require('mongoose');
console.log("in USER_GROUP.js")

var Schema = new mongoose.Schema({
  groupid: {
    type: String,
    required: true
  },
  init_name: {
    type: String,
    required: true
  },
  is_enabled: {
    type: String,
    required: true
  },
  updated_by: {
    type: String,
    required: true
  },
  bundle_id: {
    type: String,
    required: true
  },

  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('user_groups', Schema);