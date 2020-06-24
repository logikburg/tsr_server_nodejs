var mongoskin = require('mongoskin')
var ObjectID = require('mongodb').ObjectID
var patch2m = require('jsonpatch-to-mongodb')
var query2m = require('query-to-mongo')
var bodyParser = require('body-parser')
var inflector = require('inflection')
class UserController {
  constructor(req, res) {
    if (!req.db) throw new TypeError('db required')
    if (typeof req.db === 'string') this._db = mongoskin.db(req.db, { safe: true })
    else this._db = req.db;
    if (req.data) this._data = req.data;
    this._result = {};
		/*this._req =req;
		this._res =res;
		this._next =next;*/
    this.__completed = 0;
    this.promiseNum = 0;
    this.userCollection = this._db.collection("userprofile");
    //this.userCollection_v1 = this._db.collection("v1-dat-userprofile");
    this.userCollection_v1 = this._db.collection("user_profiles");
  }

  getUser(userid, callback) {
    var me = this;
    var query = {
      criteria: {
        "userid": userid
      }
    };
    //console.log(userid);
    me.userCollection.find(query.criteria).toArray(function (e, results) {
      if (e) {
        console.log("error:");
        console.log(e);
      }
      //console.log(results);
      me.getMemberOf(results[0]._id, (subResult) => {
        console.log(subResult);
        results[0].member_of = subResult.length ? subResult[0].member_of : results[0].member_of;
        callback(results);
      });
    })
  }
  getUserV1(userid, callback) {
    var me = this;
    var l_user = userid.toLowerCase();
    var query = {
      criteria: {
        "userid": l_user
      }
    };
    //console.log(userid);
    me.userCollection_v1.find(query.criteria).toArray(function (e, results) {
      if (e) {
        console.log("error:");
        console.log(e);
      }
      //console.log(results);
      callback(results);

    })
  }
  delegatedTo(ownid, delegatedToUserid, groupid, isEnable) {
    var me = this;
    if (isEnable) {
      me.addDelegateUser(ownid, delegatedToUserid, groupid);
    }
    else {
      me.removeDelegatedUser(ownid, delegatedToUserid, groupid);
    }
  }
  addDelegateUser(ownid, delegatedToUserid, groupid) {
    var query = {
      criteria: [
        { "userid": ownid }
      ]
    }
  }
  removeDelegatedUser(ownid, delegatedToUserid, groupid) {
    var query = {
      criteria: [
        { "userid": ownid }
      ]
    }
  }

  getMemberOf(id, callback) {
    var me = this;
    var query = {
      criteria: [
        { $match: { _id: id } }, //Search user
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
            as: "belongs_to"
          }
        },                           //nested-search delegated by who
        {
          $graphLookup:
          {
            from: "userprofile",
            startWith: "$userid",
            connectFromField: "userid",
            connectToField: "delegated_to.userid",
            as: "delegated_group"
          }
        }, { "$unwind": "$delegated_group" }, { "$unwind": "$delegated_group.member_of" }, //Extract delegated which group
        {
          $group: {                                                                      //join delegated group
            "_id": "$_id",

            "belongs_to": { "$addToSet": "$delegated_group.member_of" }
          }
        }, {                                                                            //return whole object group
          $project: {
            "member_of": {
              $concatArrays: [{ $ifNull: ["$member_of", []] }, "$belongs_to"]
            }

          }
        }
      ]
    }
    this.userCollection.aggregate(query.criteria, function (e, results) {
      if (e) {
        console.log("error:");
        console.log(e);
      }
      callback(results);
    })
  }

}

module.exports = UserController;