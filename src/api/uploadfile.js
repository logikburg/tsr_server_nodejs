var express = require('express');
var multer = require('multer')
const fs = require('fs')
var router = express.Router();
const request = require("request")

const filepath = './files'

const api = process.env.UPLOAD_API

const storage = multer.diskStorage({
  destination: filepath,
  filename(req, file, cb) {
    cb(null, `${new Date().getTime()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.post('/', upload.single('filepond'), async (req, res) => {
  const file = req.file; // file passed from client
  // const meta = req.body; // all other values passed from the client, like name, etc..
  const buff = fs.readFileSync(`${filepath}/${file.filename}`)
  const base64data = buff.toString('base64');

  let options = {
    method: 'POST',
    url: api,
    headers:
    {
      Connection: 'keep-alive',
      'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW'
    },
    formData: { docname: file.filename, docbinaryarray: base64data }
  };



  request(options, function (error, response, body) {
    if (error) res.sendStatus(500);
    // console.log(response)
    res.send({ filename: file.filename })
    fs.unlinkSync(`${filepath}/${file.filename}`)
  });

});

router.delete('/', (req, res) => {
  console.log(req.body)
  //delete file
  fs.unlinkSync(`${filepath}/${req.body.filename}`)
  res.sendStatus(200)
})

module.exports = router;
