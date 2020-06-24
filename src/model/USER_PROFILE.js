"use strict"
var mongoose = require('mongoose');
console.log("in USER_PROFILE.js")

var Schema = new mongoose.Schema({
  userid: {
    type: String,
    required: true
  },
  fullname: {
    type: String,
    required: true
  },
  displayname: {
    type: String,
    required: true
  },
  approvers: [{
    group_id: String,
    group_name: String
  }],
  member_of: [{
    group_id: String,
    group_name: String
  }],
  team: {
    type: String,
    required: true
  },
  phone_number: {
    type: String,
    required: false
  },
  avatar: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  bundle_id: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('user_profiles', Schema);