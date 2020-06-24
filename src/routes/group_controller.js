var mongoskin = require('mongoskin')
var ObjectID = require('mongodb').ObjectID
var patch2m = require('jsonpatch-to-mongodb')
var query2m = require('query-to-mongo')
var bodyParser = require('body-parser')
var inflector = require('inflection')
class GroupController {
  constructor(db) {
    if (!db) throw new TypeError('db required')
    if (typeof db === 'string') this._db = mongoskin.db(db, { safe: true })
    else this._db = db;
    this._result = {};
		/*this._req =req;
		this._res =res;
		this._next =next;*/
  }

  getGroup(groupType, team, callback) {
    var groupMappingCollection = this._db.collection("group-mapping");
    this._result = {};
    var thisObj = this;
    var query = {
      criteria: {
        "type": groupType,
      },
      options: {
      }
    };

    query.criteria["team"] = {
      $elemMatch: { $eq: team }
    };

    groupMappingCollection.find(query.criteria, query.options).toArray(function (e, results) {
      if (e) {
        console.log("error:");
        console.log(e);
      }
      callback(results);
    })
  }
  isGroupMember(groupname, userid, callback) {
    var criteria = [
      { $match: { userid: userid } }, //Search user
      {                             //Extract user's member
        $unwind: {
          path: "$member_of",
          preserveNullAndEmptyArrays: true
        }
      }, {                         //searching group to get groups info
        $lookup:
        {
          from: "group-mapping",
          localField: "member_of.group",
          foreignField: "_id",
          as: "member_of"
        }
      },
      { $match: { "member_of.name": groupname } }
    ];
    groupMappingCollection.aggregate(query.criteria, function (e, results) {
      if (e) {
        console.log("error:");
        console.log(e);
      }
      if (results.length == 0) callback(false);
      else callback(true);
    });
  }
}

module.exports = GroupController;