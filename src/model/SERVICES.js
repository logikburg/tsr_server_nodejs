"use strict"
const mongoose = require('mongoose');
const autoincremental = require('./auto-incremental');
let moment = require('moment');
const dateFormat = 'DD-MMM-YYYY HH:mm';

let schema = new mongoose.Schema({
  service_name: {
    type: String,
    default: () => {
      let date = moment(Date.now()).format('YYYYMMDD');
      return "RID" + date + "-";
    }
  },
  service_type: {
    type: String,
    required: true
  },
  service_data: {
    type: Map,
    of: Object,
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
  submittedBy: {
    type: String,
    required: false
  },
  displayname: {
    type: String,
    required: false
  },
  seq: { type: Number, default: 0 },
  date: {
    type: String, default: () => {
      return moment(new Date()).format(dateFormat)
    }
  },
});

schema.pre('save', function (next) {
  autoincremental("service_name", model, this, next);
  try {
    //target_date 'Date'|'String' type
    let _td1 = new Date(this.service_data.get('target_date'));
    if (!isNaN(_td1.getTime()))
      this._doc.service_data.target_date = !isNaN(_td1.getTime()) ? _td1 : this.service_data.get('target_date');
  } catch (error) {
    console.error(error);
  }
});

schema.pre("updateOne", function () {
  try {
    //target_date 'Date'|'String' type
    let _td2 = new Date(this._update.service_data.target_date);
    console.log('_td2', _td2.getTime());
    if (!isNaN(_td2.getTime()))
      this._update.service_data.target_date = !isNaN(_td2.getTime()) ? _td2 : this._update.service_data.target_date;
  } catch (error) {
    console.error(error);
  }

});

const model = mongoose.model('services', schema);
module.exports = model;
