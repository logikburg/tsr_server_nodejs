"use strict"
const mongoose = require('mongoose');

let Schema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  "project-code": {
    type: Map,
    of: String,
    required: true
  },
  "comment-template": {
    type: Map,
    of: String,
    required: true
  },
}, { collection: 'config_other' });

const model = mongoose.model('config_other', Schema);
module.exports = model;