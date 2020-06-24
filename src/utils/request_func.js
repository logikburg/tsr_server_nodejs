exports.find_request = function (request_id, requests) {
  //console.log(requests)
  for (let i in requests) {
    if (requests[i]._id == request_id) {
      return requests[i]
    }
  }
}

exports.find_stage = function (stage_name, stages) {
  for (let i in stages) {
    if (stages[i].name == stage_name) {
      return stages[i]
    }
  }
}

exports.containsObject = (obj, list) => {
  var x;
  for (x in list) {
    if (list.hasOwnProperty(x) && list[x] === obj) {
      return true;
    }
  }

  return false;
}