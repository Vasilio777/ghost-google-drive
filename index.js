'use strict'
/*
 * Google drive storage for ghost blog
 * @author : Robin C Samuel <hi@robinz.in> http://robinz.in
 * @date : 11th August 2015
 */
var Promise = require('bluebird'),
    fs = require('fs'),
    googleapis = require('googleapis'),
    https = require('https'),
    util = require('util'),
    BaseStore = require('../../core/server/storage/base');

function GhostGoogleDrive(config) {
    this.config = config || {};
    BaseStore.call(this);
};

util.inherits(GhostGoogleDrive, BaseStore);

GhostGoogleDrive.prototype.save = function(file) {
    var _this = this;
    return new Promise(function(resolve, reject) {
        var key = _this.config.key
        var jwtClient = new googleapis.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/drive'], null);

        jwtClient.authorize(function(err, tokens) {
            if (err) {
                console.log(err);
                reject(err)
                return;
            }

            var drive = googleapis.drive({
                version: 'v2',
                auth: jwtClient
            });
            drive.files.insert({
                resource: {
                    title: file.name,
                    mimeType: file.type
                },
                media: {
                    mimeType: file.type,
                    body: fs.createReadStream(file.path)
                }
            }, function(err, data) {
                if (err) {
                    console.log(err)
                    reject(err)
                    return;
                }
                // make the url looks like a file
                resolve('/content/images/' + data.id + '.' + data.fileExtension);
            });
        });
    });
};

GhostGoogleDrive.prototype.exists = function(filename) {
    var _this = this;
    var id = filename.replace('/', '').split('.')[0];
    var key = _this.config.key
    var jwtClient = new googleapis.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/drive'], null);

    return new Promise(function(resolve, reject) {
        jwtClient.authorize(function(err, tokens) {
            if (err) {
                console.log(err);
                reject(err);
            }
            var drive = googleapis.drive({
                version: 'v2',
                auth: jwtClient
            });
            drive.files.get({
                fileId: id
            }, function(err, file) {
                resolve(!err)
            });
        });
    });
}

GhostGoogleDrive.prototype.serve = function() {
    var _this = this;
    return function(req, res, next) {
        // get the file id from url
        var id = req.path.replace('/', '').split('.')[0];

        var key = _this.config.key
        var jwtClient = new googleapis.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/drive'], null);
        //auth
        jwtClient.authorize(function(err, tokens) {
            if (err) {
                console.log(err);
                next()
            }
            var drive = googleapis.drive({
                version: 'v2',
                auth: jwtClient
            });
            drive.files.get({
                fileId: id
            }, function(err, file) {
                if (!err) {
                    var newReq = https.request(file.downloadUrl + '&access_token=' + tokens.access_token, function(newRes) {
                        // Modify google headers here to cache!
                        var headers = newRes.headers;
                        headers['content-disposition'] = "attachment; filename=" + file.originalFilename;
                        headers['cache-control'] = 'public, max-age=1209600';
                        delete headers['expires'];
                        res.writeHead(newRes.statusCode, headers);
                        // pipe the file
                        newRes.pipe(res);
                    }).on('error', function(err) {
                        res.statusCode = 500;
                        res.end();
                    });
                    req.pipe(newReq);
                } else {
                    next()
                }

            });
        });
    };
};

GhostGoogleDrive.prototype.delete = function (filename) {
  var _this = this;
  var id = filename.replace('/', '').split('.')[0];
  var key = _this.config.key
  var jwtClient = new googleapis.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/drive'], null);

  return new Promise(function(resolve, reject) {
      jwtClient.authorize(function(err, tokens) {
          if (err) {
              console.log(err);
              reject(err)
          }
          var drive = googleapis.drive({
              version: 'v2',
              auth: jwtClient
          });
          drive.files.delete({
              fileId: id
          }, function(err, file) {
              resolve(!err)
          });
      });
  });
};

module.exports = GhostGoogleDrive
