'use strict';
let express = require('express');
let router = express.Router();


router.get('/', async (req, res) => {
    try {
        res.status(200).send(process.env.SYS_STATUS);
    } catch (err) {
        res.status(500).send({ status: false, err: err });
    }
});

module.exports = router;