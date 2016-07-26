var path = require("path");
var fs = require("fs");
var async = require("async");

module.exports = function(packager, callback)
{
    // NOTE: everything in /setup/data/* is picked up automatically by the packager!
    //       here we add in our custom imports
    async.waterfall([
        loadImports(packager, "./custom/build/imports.json"),
        addImports(packager)
    ], done(callback));
};

var loadImports = function(packager, filePath)
{
    return function(callback) {

        var context = JSON.parse("" + fs.readFileSync(filePath));

        callback(null, context);
    };
};

var addImports = function(packager)
{
    return function(context, callback) {

        var count = 0;

        // add all context objects and attachments
        context.objects.forEach(function (el) {
            packager.addNode(el);
            count++;
        });
        context.attachments.forEach(function (el) {
            packager.addAttachment(el._doc, el.attachmentId, el.path);
            count++;
        });

        callback(null, context);
    };
};

var done = function (callback) {
    return function(err, context) {
        if (err) console.log(err);
        callback();
    };
};
