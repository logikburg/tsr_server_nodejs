"use strict"
var mongoose = require('mongoose');
console.log("in package_ui.js")

var Schema = new mongoose.Schema({

  bundle_ref: {
    type: String,
    required: true
  },
  bundle_name: {
    type: String,

    required: true
  },
  services: [{
    type: Map,
    of: String,
    required: true
  }]
});

module.exports = mongoose.model('package_ui', Schema);