'use strict';
let Package_UI = require('../model/PACKAGE_UI');
let express = require('express');
let router = express.Router();

router.get('/:package_type', function (req, res) {
  //console.log('UI=========>', req.params);
  Package_UI.findOne({ bundle_ref: req.params.package_type },
    function (err, ui) {
      if (err) { res.status(417).send({ status: false, msg: err }); };
      //console.log('UI result ui.services=========>', ui.services);
      res.status(200).send({ status: true, uiServices: ui.services });
    });
});

module.exports = router;