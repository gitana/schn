module.exports = function(installer, callback)
{
    installer.removeContentInstances("wcm:page");
    installer.removeContentInstances("wcm:template");
    installer.removeContentPackage("core");

    installer.removeContentAtPath("/app");
    installer.removeContentAtPath("/content");

    installer.execute(function(err, results) {
        callback(err, results);
    });
};