class PromiseWrapper {
  constructor() {
    this.promises = [];
    this.promisesErrCall = [];
  }
  add(fnCall, errCall) {
    this.promises[this.promises.length] = new Promise(fnCall);
    this.promisesErrCall[this.promisesErrCall.length] = errCall;
    console.log(this.promises.length);
    return this;
  };

  complete(callback, errCallback) {
    Promise.all(this.promises).then((value) => {
      //console.log(this.value);
      value.forEach((v) => {

        if (v.callback) {
          v.callback(v.data);
        }
      });
      if (callback) {
        callback(value);
      }
    }).catch((err) => {
      this.promises.forEach((promise, promiseIdx) => {
        promise.catch((err) => {
          this.promisesErrCall[promiseIdx] && this.promisesErrCall[promiseIdx](err);
        })
      });
      if (errCallback) errCallback(err);
    });
    return this;
  };
}
module.exports = PromiseWrapper;