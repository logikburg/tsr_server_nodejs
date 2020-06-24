class PromiseWrapper {
	constructor() {
		this.promises = [];
	}
	add(fnCall) {
		this.promises[this.promises.length] = new Promise(function(resolve, reject) {
			fnCall(resolve,reject);
		})
		return this;
	};
	
	complete(callback) {
		Promise.all(this.promises).then((value)=> {
			value.forEach((v) => {
				if(v.callback) {
					v.callback(v.data);
				}
			});
			if(callback) {
				callback(value);
			}
		}).catch((err) => {
			console.log(err.message);
		})
		return this;
	};
}
module.exports = PromiseWrapper;