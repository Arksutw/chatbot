var webshot = require('webshot');

var options = {
  shotSize: {
    width: 950
    , height: 700
  },
  shotOffset: {
    left: 0
    , right: 0
    , top: 120
    , bottom: 0
  },
  customHeaders: "referer:https://tw.stock.yahoo.com/"
};

/**
 * Gets the remote Taifex futures webpage shot
 * @param {string} text The text to be corrected
 * @returns {Promise} Promise with corrected text if succeeded, error otherwise.
 */
exports.shotpng = function (url, filename) {
  return new Promise(
    function (resolve, reject) {
      if (url) {
        webshot(url, './images/' + filename, options, function (err) {
          if (err) return reject(error);
          resolve('success');
        });
      } else {
        resolve(url);
      }
    })
};