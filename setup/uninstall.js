module.exports = function(installer, callback)
{
    installer.removeContentInstances("schn:article");
    installer.removeContentAtPath("/Article Documents");
    installer.execute(function(err, results) {
        callback(err, results);
    });
};