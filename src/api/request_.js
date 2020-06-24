'use strict';
let mongoose = require('../mongoose');
let Services = require('../model/SERVICES');
let Bundles = require('../model/BUNDLES');
let Workflow = require('../model/WORKFLOW');
let ReqHistory = require('../model/SERVICE_HISTORY');
let Userprofile = require('../model/USER_PROFILE');
let ConfigBundle = require('../model/CONFIG_BUNDLE');
let ConfigRequest = require('../model/CONFIG_REQUEST');
let express = require('express');
let router = express.Router();
let moment = require('moment');
const dateFormat = 'DD-MMM-YYYY HH:mm';

router.get('/ui', async (req, res) => {
  try {
    let bundles = await ConfigBundle.find({});
    let requests = await ConfigRequest.find({});
    res.status(200).send({
      status: true,
      configBundleUI: bundles,
      configRequestUI: requests
    });
  } catch (err) {
    res.status(500).send({ status: false, err: err });
  }
});

module.exports = router;