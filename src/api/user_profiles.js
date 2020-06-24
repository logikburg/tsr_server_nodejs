'use strict';
const Userprofile = require('../model/USER_PROFILE');
const express = require('express');
const router = express.Router();

router.get('/:corpid', async (req, res) => {
  Userprofile.findOne({ userid: req.params.corpid },
    function (err, user) {
      if (err) { res.status(417).send({ status: false, msg: err }); };
      if (!user) { user = {} }
      //console.log('UI result ui.services=========>', ui.services);
      res.status(200).send(user);
    });
});

module.exports = router;