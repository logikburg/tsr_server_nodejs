exports.pad = function (inStr, digit) {
  var finStr = "0000000000" + inStr;
  return finStr.toString().slice(-1 * digit);
}
