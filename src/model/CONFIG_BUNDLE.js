"use strict"
const mongoose = require('mongoose');
const autoincremental = require('./auto-incremental');
let moment = require('moment');
const dateFormat = 'DD-MMM-YYYY HH:mm';

let Schema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  "bundle_ref": {
    type: String,
    required: true
  },
  "bundle_name": {
    type: String,
    required: true
  },
  "services": [{
    type: Map,
    of: String,
    required: true
  }],
  "enable": {
    type: Boolean,
    required: true
  },
  "variant": {
    type: String,
    required: true
  }
}, { collection: 'config_bundle' });

const model = mongoose.model('config_bundle', Schema);
module.exports = model;