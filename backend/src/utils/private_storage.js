const fs = require('fs')
const path = require('path')
const config = require('../config')
function privateFile(filename) {
  if (!filename || !fs.existsSync(filename)) throw { statusCode: 404, message: 'Không tìm thấy tệp' }
  const resolved = fs.realpathSync(filename)
  if (!resolved.startsWith(config.upload.dir + path.sep)) {
    throw { statusCode: 403, message: 'Tệp không thuộc kho MCAH; cần chuyển nguồn có kiểm soát' }
  }
  return resolved
}
module.exports = { privateFile }
