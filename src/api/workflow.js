'use strict';
let mongoose = require('../mongoose');
let Request = require('../model/REQUEST');
let Services = require('../model/SERVICES');
let Bundles = require('../model/BUNDLES');
let Workflow = require('../model/WORKFLOW');
let Usergroup = require('../model/USER_GROUP');
let Userprofile = require('../model/USER_PROFILE');
let Package_UI = require('../model/PACKAGE_UI');
let express = require('express');
let router = express.Router();

router.post('/new', function (req, res) {
  console.log("here we are")
});

module.exports = router;