'use strict';
module.exports = {
  dev: {
    dist: 'src',
    port: 3000,
    //db: 'mongodb://tsrvmc1a:27017/vendor',
    db: process.env.DB,
    //db: 'mongodb://tsrdbroot:tsrmongoroot~A123@160.200.132.126:27017,160.200.132.127:27017,160.200.132.153:27017/pilot-db?replicaSet=rs-a'
    //db: 'mongodb://tsrdbusr:tsrusr~A123@160.200.132.126:27017,160.200.132.127:27017,160.200.132.153:27017/pilot-db?replicaSet=rs-a'
  },
  env: 'dev',
}