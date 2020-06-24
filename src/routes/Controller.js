var mongoskin = require('mongoskin')
var ObjectID = require('mongodb').ObjectID
var patch2m = require('jsonpatch-to-mongodb')
var query2m = require('query-to-mongo')
var bodyParser = require('body-parser')
class Controller {
  constructor(req, res) {
    if (!req.db) throw new TypeError('db required')
    if (typeof req.db === 'string') this._db = mongoskin.db(req.db, { safe: true })
    else this._db = req.db;
    if (req.data) this._data = req.data;
    this._result = {};
    this.__completed = 0;
    this.promiseNum = 0;
    this.props = {};
    this.props.req = req;
    this.props.res = res;
  }
  normalizeId(id) {
    if (ObjectID.isValid(id)) return new ObjectID(id)
    return id;
  }
}

module.exports = Controller;