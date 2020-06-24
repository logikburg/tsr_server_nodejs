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
  "name": {
    type: String,
    required: true
  },
  "title": {
    type: String,
    required: true
  },
  "logo": {
    type: String,
    required: true
  },
  "watchers": [
    {
      type: Map,
      of: String,
      required: true
    }
  ],
  "style": {
    type: Map,
    of: String,
    required: true
  },
  "details": [
    {
      type: Map,
      of: String,
      required: true
    }
  ],
  "workflows": [
    {
      type: Map,
      of: String,
      required: true
    }
  ],
  "enable": {
    type: Boolean,
    required: true
  },
}, { collection: 'config_request' });

const model = mongoose.model('config_request', Schema);
module.exports = model;