"use strict"
const mongoose = require('mongoose');
const autoincremental = require('./auto-incremental');
let moment = require('moment');
const dateFormat = 'DD-MMM-YYYY HH:mm';

let Schema = new mongoose.Schema({
  bundle_name: {
    type: String,
    default: () => {
      let date = moment(Date.now()).format('YYYYMMDD');
      return "BID" + date + "-";
    }
  },
  // bundle_ref: {
  //   type: String,
  //   required: true
  // },
  // bundle_description: {
  //   type: String,
  //   required: true
  // },
  bundle_type: {
    type: String,
    required: true
  },
  user: {
    type: String,
    required: true
  },
  displayname: {
    type: String,
    required: false
  },
  status: {
    type: String,
    required: true
  },
  seq: { type: Number, default: 0 },
  date: {
    type: String, default: () => {
      return moment(new Date()).format(dateFormat);
    }
  },
});

Schema.pre('save', function (next) {
  autoincremental("bundle_name", model, this, next);
});

const model = mongoose.model('bundles', Schema);
module.exports = model;
