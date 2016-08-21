module.exports = function(installer, callback)
{
    installer.removeContentInstances("schn:article");
    installer.removeContentAtPath("/Article Documents");
    installer.removeContentAtPath("/Articles");
    installer.execute(function(err, results) {
        callback(err, results);
    });
};