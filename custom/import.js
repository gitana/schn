var Gitana = require("gitana");
var fs = require("fs");
var path = require("path");
var mime = require('mime-types')
var async = require("async");
var commandLineArgs = require('command-line-args')
var commandLineUsage = require('command-line-usage')
var camel = require('camel-case');
var sanitizeHtml = require('sanitize-html');
var md = require('to-markdown');
var marked = require('marked');
var util = require("./lib/util");
var md5 = require('md5');

var TYPES_PATH = "./docs/types";
var TYPE_QNAME__CATEGORY = "schn:category";

var aliasCounter = 0;
var fileNames = {};

if (fs.existsSync("./build/fileNames.json"))
{
    fileNames = require("./build/fileNames.json");
}

if (fileNames && fileNames.fileNames)
{
    fileNames = fileNames.fileNames || {};
}


// debug only when using charles proxy ssl proxy when intercepting cloudcms api calls:
if (process.env.NODE_ENV !== "production")
{
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

var cmdOptions = [
  {
    header: 'Cloud CMS Importer',
    content: 'Import XML or CSV to a Cloud CMS repostiory as JSON'
  },
  {
    header: 'Options',
    optionList: [
        {name: 'help', alias: 'h', type: Boolean},
        {name: 'list-types', alias: 'l', type: Boolean, description: 'list local type definitions'},
        {name: 'type-name', alias: 't', type: String, description: '_qname of the type definition to import'},
        {name: 'csv-file-path', alias: 'c', type: String, description: 'path to content csv file to import'},
        {name: 'xml-file-path', alias: 'x', type: String, description: 'path to content xml file to import'},
        {name: 'xml-folder-path', alias: 'f', type: String, description: 'path to root folder to crawl for content xml files to import'},
        {name: 'prepare-package', alias: 'k', type: String, description: 'store imported json and attachments in a local path. stored documents will be in the format expected by the cloud cms cli package command'},
        {name: 'attachment-path', alias: 'n', type: String, description: 'path to local folder where attachments can be found'},
        {name: 'cms-path', alias: 'm', type: String, description: 'root path within cms to store records. additional path elements and file name are calculated'},
        {name: 'category', alias: 'a', type: String, description: 'name of category to associate to. ex.: --category "Respiratory World Wide"'},
        {name: 'property-name', alias: 'p', type: String, multiple: true, description: 'name of an extra property to set ex.: -p contentType"'},
        {name: 'property-value', alias: 'v', type: String, multiple: true, description: 'value of the extra property ex.: -v article"'},
        {name: 'replace', alias: 'r', type: Boolean, description: 'replace type definitions if found'},
        {name: 'branch', alias: 'b', type: String, description: 'branch to write content to. branch id or "master". Default is "master"'},
        {name: 'simulate', alias: 's', type: Boolean, description: 'don\'t actually send anything to cloud cms'},
        {name: 'deleteNodes', alias: 'd', type: Boolean, description: 'delete all the nodes from any previous import of the same file'},
    ]
  }
];

var options = commandLineArgs(cmdOptions[1].optionList);

console.log(commandLineUsage(options));
if(options.help || (!options["csv-file-path"] && !options["type-name"] && !options["list-types"]))
{
    console.log(commandLineUsage(cmdOptions));
    return;
}

var branchId = options["branch"] || "master";
var csvPath = options["csv-file-path"];
var xmlPath = options["xml-file-path"];
var xmlFolderPath = options["xml-folder-path"];
var cmsPath = options["cms-path"];
var typeDefinitions = listTypeDefinitions();
var importTypeName = options["type-name"];
var importType = typeDefinitions[importTypeName];
var propertyNames = options["property-name"];
var propertyValues = options["property-value"];
var simulate = options["simulate"] || false;
var category = options["category"];
var deleteNodes = options["deleteNodes"];
var packagePath = options["prepare-package"];
var attachmentPath = options["attachment-path"];

var DELETE_QUERY = {
    "_type": importTypeName,
    "imported": true,
    "importSource": csvPath || xmlPath
};

var homeDirectory = function()
{
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
};

var rootCredentials = JSON.parse("" + fs.readFileSync(path.join(homeDirectory(), ".cloudcms", "credentials.json")));

var gitanaConfig = JSON.parse("" + fs.readFileSync("../gitana.json"));
gitanaConfig.username = rootCredentials.username;
gitanaConfig.password = rootCredentials.password;

if (!packagePath && csvPath && importType) {
    // import list of nodes from rows of a csv file
    util.loadCsvFile(csvPath, function(err, data){
        // import records from a CSV file directly into Cloud CMS
        
        if (err) {
            console.log("error loading csv " + err);
            return;
        }

        // if (data.length < 2) {
        //     console.log("array too small. 1st row should be header row");
        //     return;
        // }

        // prepare node list from csv records
        var nodes = prepareCsvNodes(data);

        // console.log(JSON.stringify(nodes));
        // if (nodes.length==0)
        // {
        //     console.log("No nodes found to import");
        //     return;
        // }

        console.log("creating nodes. count: " + nodes.length);
        
        if (!simulate)
        {
            createNodes(branchId, nodes, category, deleteNodes);
        }
    });
}
else if (!packagePath && xmlPath && importType)
{
    var totalRecords = 0;

    // import list of nodes from records in an xml file
    util.parseXMLFile(xmlPath, function(err, data){
        if (err) {
            console.log("error loading xml " + err);
            return;
        }

        var nodes = prepareXmlNodes(data, xmlPath, cmsPath);

        // console.log(JSON.stringify(nodes));
        if (nodes.length==0)
        {
            console.log("No nodes found to import");
            return;
        }

        console.log("creating nodes. count: " + nodes.length);
        totalRecords += nodes.length;
        
        if (!simulate)
        {
            createNodes(branchId, nodes, category, deleteNodes);
        }        
    });

    console.log("totalRecords: " + totalRecords);
}
else if (xmlFolderPath && importType)
{
    var nodes = [];

    // recurse into given folder and parse any XML files that are found. import the records defined in the xml files
    var xmlFilePaths = util.findAllFiles(xmlFolderPath, ".xml");
    console.log("found xml files. count: " + xmlFilePaths.length);
// xmlFilePaths = xmlFilePaths.slice(0, 1);
    for(var i = 0; i < xmlFilePaths.length; i++) {
        // console.log(xmlFilePaths[i]);

        // import list of nodes from records in this xml file
        var importFilePath = path.join(xmlFolderPath, xmlFilePaths[i]);
        util.parseXMLFile(importFilePath, function(err, data){
            if (err) {
                console.log("error loading xml " + err);
                return;
            }

            var cmsFolderPath = xmlFilePaths[i];
            if (cmsPath) {
                cmsFolderPath = path.join(cmsPath, xmlFilePaths[i].replace(".xml", ""));
                cmsFolderPath = cmsFolderPath.replace(/\.\d+$/, "");
            }

            nodes = nodes.concat(prepareXmlNodes(data, importFilePath, cmsFolderPath, attachmentPath));

            // console.log(JSON.stringify(nodes));
            if (nodes.length==0)
            {
                console.log("No nodes found to import");
                return;
            }

            console.log("creating nodes. count: " + nodes.length);

            if (!packagePath && !simulate )
            {
                DELETE_QUERY.importSource = importFilePath;
                createNodes(branchId, nodes, category, deleteNodes, DELETE_QUERY);
            }        
        });
    }

    console.log("Done parsing xml files. count: " + nodes.length);

    if (packagePath)
    {
        console.log("Creating package");
        writePackage(nodes, packagePath, attachmentPath);
    }

    console.log("Done importing xml files");
}
else if (options["list-types"])
{
    // print a list of definition type qnames in folder: docs/types
    for(var type in typeDefinitions) {
        // console.log(JSON.stringify(typeDefinitions[type]));
        console.log(" _qname: " + typeDefinitions[type].json._qname + " Title: " + typeDefinitions[type].json.title);
    }
    return;
}
else if (importType)
{
    // import a definition from a node.json file in docs/types identified by it's _qname property (NOT IT'S FILE NAME!)
    console.log("Importing " + importType.json._qname);

    if (!simulate)
    {
        util.getBranch(gitanaConfig, branchId, function(err, branch) {
            branch.queryNodes({
                "_type": importType.json._type,
                "_qname": importType.json._qname
            }).count(function(c) {
                if(c>0) {
                    console.log("Can't import. Node already exists: " + importType.json.id);
                    return;
                }

                // console.log(JSON.stringify(this));
                node = this;
                console.log("Node not found. Creating...");

                async.waterfall([
                    async.apply(createContext, importType, branch),
                    writeNode,
                    uploadAttachments
                ], function (err, context) {
                    if(err)
                    {
                        console.log("Error creating node " + err);
                    }
                    else {
                        console.log("Node has been imported succesfully");
                    }
                    return;
                });
                return;
            });
        });
    }
}
else
{
    if (!importType)
    {
        console.log("No type found with _qname \"" + options["type-name"] + "\"");
        return;
    }

    console.log(cli.getUsage(options));
    return;    
}

function writePackage(nodes, packagePath, attachmentPath) {
    var missingAttachmentList = [];
    if (fs.existsSync("./build/missingAttachmentsList.json"))
    {
        missingAttachmentList = require("./build/missingAttachmentsList.json");
    }

    if (missingAttachmentList && missingAttachmentList.attachmentList)
    {
        missingAttachmentList = missingAttachmentList.attachmentList || [];
    }

    var attachmentList = {};
    if (fs.existsSync("./build/attachmentsList.json"))
    {
        attachmentList = require("./build/attachmentsList.json");
    }

    if (attachmentList && attachmentList.attachmentList)
    {
        attachmentList = attachmentList.attachmentList || {};
    }

    var context = {
        nodes: nodes,
        attachments: [],
        attachmentPath: attachmentPath,
        packagePath: path.join(packagePath, "imports.json"),
        missingAttachmentsList: missingAttachmentList,
        attachmentsList: attachmentList || {}
    }

    console.log("Writing package to " + context.packagePath);

    async.waterfall([
        async.apply(async.ensureAsync(resolveAttachments), context),
        async.ensureAsync(writeNodesToPackage),
        async.ensureAsync(writeMissingAttachmentsReport),
        async.ensureAsync(writeAttachmentsReport),
        async.ensureAsync(writeFileNamest)
    ], function (err, context) {
        if (err)
        {
            console.log("Error creating package " + err);
        }
        else
        {
            console.log("Nodes have been imported succesfully");
        }
    });

    console.log("Done writing package to " + context.packagePath);

    return;
}

function resolveAttachments(context, callback) {
    var newNodes = [];

    for(var i = 0; i < context.nodes.length; i++)
    {
        var alias = "alias_" + i;
        context.nodes[i]["_alias"] = alias;
        var relatedDocPaths = findRelatedDocs(context.nodes[i], context.missingAttachmentsList);
        if (relatedDocPaths.length > 0)
        {
            for(var j = 0; j < relatedDocPaths.length; j++)
            {
                var attachmentId = (j ? "default" + j : "default");
                context.attachments.push({
                    "_doc": alias,
                    "attachmentId": attachmentId,
                    "path": path.resolve(path.join(attachmentPath, relatedDocPaths[j]))
                });
            }
        }
    }

    context.nodes = context.nodes.concat(newNodes);

    callback(null, context);
}

function makeFileName(fileName) {
    if (fileNames[fileName])
    {
        console.log("*duplicate file name: " + fileName);
        var i = 1;
        var tFilename = fileName;
        while (fileNames[tFilename])
        {
            tFilename = fileName + "_" + i++;
        }
        fileName = tFilename;
        console.log("** replacement file name: " + fileName);
    }
    fileNames[fileName] = 1;

    return fileName;
}

function findRelatedDocs(node, missingAttachmentsList) {
    var relatedDocs = [];

    // if (node.relatedUrl && node.relatedUrl["pdf-urls"] && node.relatedUrl["pdf-urls"].url)
    if (node.url)
    {
        // var url = node.relatedUrl["pdf-urls"].url || "";
        var url = node.url || "";
        if (!url) return;

        var urls = [];

        if (Gitana.isArray(url))
        {
            for(var i = 0; i < url.length; i++)
            {
                urls.push(url[i].split("://")[1]);
            }            
        }
        else
        {
            console.log("urls " + typeof urls);
            try {
                urls = url.split("://");
            }
            catch(e)
            {
                console.log(e + "\nerror with url for this node " + e);
                console.log(JSON.stringify(urls || {}));
                urls = [];
            }
        }

        for(var i = 0; i < urls.length; i++)
        {
            var thisUrl = urls[i];
            if (thisUrl === "internal-pdf")
            {
                continue;
            }

            // console.log("thisUrl " + thisUrl);
            var filePath = thisUrl;
            if (fs.existsSync(path.resolve(path.join(attachmentPath, thisUrl))))
            {
                relatedDocs.push(filePath);
            }
            else
            {
                missingAttachmentsList.push(thisUrl);
            }
        }
    }

    return relatedDocs;
}

function writeNodesToPackage(context, callback) {
    context.writeStream = fs.createWriteStream(context.packagePath, {
        flags: 'w',
        defaultEncoding: 'utf8',
        fd: null,
        mode: 0o666,
        autoClose: true
    });

    var packageJSON = {
        "objects": context.nodes,
        "attachments": context.attachments
    }

    context.writeStream.write(JSON.stringify(packageJSON, null, 2));

    context.writeStream.end();

    console.log("write stream done");
    callback(null, context);
}

function writeMissingAttachmentsReport(context, callback) {
    context.writeStream = fs.createWriteStream("build/missingAttachmentsList.json", {
        flags: 'w',
        defaultEncoding: 'utf8',
        fd: null,
        mode: 0o666,
        autoClose: true
    });

    context.writeStream.write(JSON.stringify({"attachmentList": context.missingAttachmentsList}, null, 2));

    context.writeStream.end();

    console.log("write missing attachments report done");
    callback(null, context);
}

function writeAttachmentsReport(context, callback) {
    context.writeStream = fs.createWriteStream("build/attachmentsList.json", {
        flags: 'w',
        defaultEncoding: 'utf8',
        fd: null,
        mode: 0o666,
        autoClose: true
    });

    context.writeStream.write(JSON.stringify({"attachmentList": context.attachmentsList||{}}, null, 2));

    context.writeStream.end();

    console.log("write attachments report done");
    callback(null, context);
}

function writeFileNamest(context, callback) {
    context.writeStream = fs.createWriteStream("build/fileNames.json", {
        flags: 'w',
        defaultEncoding: 'utf8',
        fd: null,
        mode: 0o666,
        autoClose: true
    });

    context.writeStream.write(JSON.stringify({"fileNames": fileNames||{}}, null, 2));

    context.writeStream.end();

    console.log("write fileNames report done");
    callback(null, context);
}

function createNodes(branchId, nodes, category, deleteNodes, deleteQuery) {

    var context = {
        useBulk: false,
        branchId: branchId,
        branch: null,
        nodes: nodes,
        category: category,
        categoryNode: null,
        categoryNodeRef: null,
        deleteNodes: deleteNodes,
        deleteQuery: deleteQuery
    }

    async.waterfall([
        async.apply(async.ensureAsync(getBranch), context),
        async.ensureAsync(getCategory),
        async.ensureAsync(deleteExistingNodes),
        async.ensureAsync(writeNodes)
    ], function (err, context) {
        if (err)
        {
            console.log("Error creating nodes " + err);
        }
        else
        {
            console.log("Nodes have been imported succesfully");
        }
    });

    return;
}

function getBranch(context, callback) {
    var branchId = context.branchId;

    // console.log("getBranch() " + JSON.stringify(context));
    console.log("getBranch()");

    util.getBranch(gitanaConfig, branchId, function(err, branch) {
        if (err) {
            console.log("error connecting to Cloud CMS: " + JSON.stringify(err));
        }

        context.branch = branch;

        callback(err, context);
    });    
}

function getCategory(context, callback) {
    var branch = context.branch;
    var category = context.category;
    var query = {
        "_type": TYPE_QNAME__CATEGORY,
        "title": category
    };

    // console.log("getCategory() " + JSON.stringify(context));
    console.log("getCategory()");

    if (!category)
    {
        context.categoryNode = null;
        return callback(null, context);
    }

    util.findOrCreateNode(branch, query, newCatNode({"title": category, "slug": util.slugifyText(category)}), function(err, categoryNode) {
        if (err)
        {
            return callback(err);
        }

        context.categoryNode = categoryNode;
        context.categoryNodeRef = util.refFromNode(categoryNode);
        console.log("getCategory() findOrCreateNode() " + JSON.stringify(categoryNode));

        if (categoryNode)
        {
            var ref = util.refFromNode(categoryNode);
            for(var i = 0; i < context.nodes.length; i++)
            {
                context.nodes[i].category = ref;
            }
        }

        return callback(null, context);
    })    
}

function deleteExistingNodes(context, callback) {
    var branch = context.branch;
    var deleteNodes = context.deleteNodes;
    var deleteQuery = context.deleteQuery;

    // console.log("deleteExistingNodes() " + JSON.stringify(context));
    console.log("deleteExistingNodes()");

    if (!deleteNodes)
    {
        return callback(null, context);
    }

    if (deleteQuery)
    {
        util.deleteNodes(branch, deleteQuery, function(err) {
            return callback(err, context);
        });
    }
    else
    {
        return callback(null, context);
    }
}

function writeNodes(context, callback) {
    var branch = context.branch;

    // console.log("writeNodes() " + JSON.stringify(context));
    console.log("writeNodes()");

    util.createNodes(branch, context.nodes, function(err) {
        return callback(err, context);
    });
}

function addKeysToNode(node, data) {
    if (typeof data === "object")
    {
        for(var key in data) {
            var camelKey = camel(key) || "_";
            if (data[key].style)
            {
                node[camelKey] = data[key].style._;
            }
            else
            {
                if (typeof data[key] === "object")
                {
                    node[camelKey] = {};
                    addKeysToNode(node[camelKey], data[key]);
                }
                else if (Gitana.isArray(data))
                {
                    node[camelKey] = [];
                    for(var i = 0; i < data.length; i++)
                    {
                        node[camelKey].push("");
                        addKeysToNode(node[camelKey][i], data[key]);
                    }
                }
                else
                {
                    node[camelKey] = data[key];
                }
            }
        }
    }
    else if (Gitana.isArray(data))
    {
        var camelKey = camel(key) || "_";
        node[camelKey] = [];
        for(var i = 0; i < data[key]; i++)
        {
            node[i] = "";
            addKeysToNode(node[i], data[key][i]);
        }
    }
    else
    {
        node = data;
    }
}

function nestedKey(data, propertyName, defaultValue) {
    var keys = propertyName.split(".");
    var dataValue = data;
    var value = defaultValue || "";
    for(var i = 0; i < keys.length; i++)
    {
        var key = keys[i];
        if (dataValue[key])
        {
            dataValue = dataValue[key];
            value = dataValue;
        }
        else
        {
            return value
        }
    }

    return value;
}

function _nestedKey(data, propertyName) {
    var keys = propertyName.split(".");
    var dataValue = data;
    var value = "";
    for(var i = 0; i < keys.length; i++)
    {
        var key = keys[i];
        if (dataValue[key])
        {
            dataValue = dataValue[key];
            value = dataValue;
        }
        else
        {
            return value
        }
    }

    return value;
}

function nestedArrayKey(data, propertyName, propertyName2) {
    var keys = propertyName.split(".");
    var dataValue = data;
    var value = "";
    var resultArray = [];
    for(var i = 0; i < keys.length; i++)
    {
        var key = keys[i];
        if (dataValue[key])
        {
            dataValue = dataValue[key];
            value = dataValue;
        }
        else
        {
            value = [];
            break;
        }
    }

    if (Gitana.isArray(value) && propertyName2)
    {
        for(var i = 0; i < value.length; i++)
        {
            resultArray.push(nestedKey(value[i], propertyName2));
        }
    }
    else
    {
        resultArray.push(nestedKey(value, propertyName2));
    }

    return resultArray || [];
}

function prepareXmlNodes(data, xmlFilePath, cmsPath, attachmentPath) {
    var nodes = [];

    // console.log("data: \n" + JSON.stringify(data));
    data = data.xml.records.record;
    if (!Gitana.isArray(data))
    {
        data = [data];
    }
    
    for(var i = 0; i < data.length; i++) {
        // console.log("\n**\n" + JSON.stringify(data[i],null,2))
        var title = "";
        if (data[i].titles && data[i].titles.title && data[i].titles.title._value)
        {
            title = data[i].titles.title._value;
        }

        // special case for when title is an array
        if (Gitana.isArray(title)) {
            if (title[0])
            {
                title = title.join("\n");
            }
            else
            {
                title = title.join("");
            }
        }
        
        var secondaryTitle = "";
        if (data[i].titles["secondary-title"])
        {
            secondaryTitle = data[i].titles["secondary-title"]._value;
        }

        if (!title && secondaryTitle)
        {
            title = secondaryTitle;
        }
        
        var altTitle = "";
        if (data[i].titles["alt-title"])
        {
            altTitle = data[i].titles["alt-title"]._value;
        }

        if (!title)
        {
            if (altTitle)
            {
                title = altTitle;
            }
            else
            {
                title = "Untitled";
            }
        }

        var abstract = nestedKey(data[i], "abstract._value", "");
        if (Gitana.isArray(abstract))
        {
            abstract = abstract.join("");
        }

        var authors = nestedArrayKey(data[i], "contributors.authors.author", "_value");
        for(var j = 0; j++; j < authors.length)
        {
            if (Gitana.isArray(authors[j]))
            {
                authors[j] = authors[j].join("");
            }
            
        }

        var notes = nestedKey(data[i], "notes._value");
        if (Gitana.isArray(notes))
        {
            notes = notes.join(" ");
        }

        var node = newArticleNode(importTypeName, {
            "importSource": xmlFilePath,
            "title": title || secondaryTitle,
            "secondaryTitle": secondaryTitle,
            "altTitle": altTitle,
            "abstract": abstract,
            "year": nestedKey(data[i], "dates.year._value"),
            "contributors": [
                {
                    "authors": authors,
                    "secondaryAuthors": nestedArrayKey(data[i], "contributors.secondary-authors.author", "_value"),
                    "tertiaryAuthors": nestedArrayKey(data[i], "contributors.tertiary-authors.author", "_value")
                }
            ],
            "periodical": nestedKey(data[i], "periodical.full-title._value"),
            "altPeriodical": nestedKey(data[i], "alt-periodical.full-title._value"),
            "authAddress": nestedKey(data[i], "auth-address._value"),
            "electronicResourceNumber": nestedKey(data[i], "electronic-resource-num._value"),
            "recNumber": data[i]["rec-number"] || "",
            "keywords": nestedArrayKey(data[i], "keywords.keyword", "_value"),
            "publisher": nestedKey(data[i], "publisher._value"),
            "pubLocation": nestedKey(data[i], "pub-location._value"),
            "url": nestedKey(data[i], "urls.pdf-urls.url"),
            "relatedUrl": nestedKey(data[i], "urls.related-urls.url._value"),
            "workType": nestedKey(data[i], "work-type._value"),
            "isbn": nestedKey(data[i], "isbn._value"),
            "pages": nestedKey(data[i], "pages._value"),
            "volume": nestedKey(data[i], "volume._value"),
            "number": nestedKey(data[i], "number._value"),
            "notes": notes,
            "accessionNum": nestedKey(data[i], "accession-num._value"),
            "_qname": "schn_article:" + md5(data[i]["rec-number"] + xmlFilePath + title +  Math.floor(Math.random() * data.length))
        });

        // calculate path to store within Cloud CMS
        if (node.title) {
            // if cmsPath is defined then store in a folder structure within Cloud CMS
            if (cmsPath) {
                // node._filePath = path.join(cmsPath, node.title)
                // node._parentFolderPath = path.join(cmsPath, node.year || "Other");
                node._parentFolderPath = cmsPath;
                node.title = node._filename = makeFileName(node.title);
            }
        }
        else
        {
            console.log("Warning. Node found with no title. It will be stored without a path: " + JSON.stringify(node, null, 2));
        }

        // add optional properties define don command line
        if (propertyNames) {
            for(var j = 0; j < propertyNames.length; j++) {
                node[propertyNames[j]] = propertyValues[j] || "";
            }
        }

        // console.log("*\n" + JSON.stringify(node,null,2))
        nodes.push(node);
    }

    return nodes;
}

function prepareCsvNodes(data) {
    var nodes = [];
    var headers = [];

    // expect the first row to define header names. use these as property names
    var bodyIndex = -1;
    for(var i = 0; i < data[0].length; i++) {
        if (data[0][i] === "text")
        {
            // "text" field becomes "body" in the new content model
            headers.push("body");
            bodyIndex = i;
        }
        else
        {
            headers.push(camel(data[0][i]));
        }
    }

    for(var i = 1; i < data.length; i++) {
        var node = newArticleNode(importTypeName, {
            "importSource": csvPath
        });

        if (propertyNames) {
            for(var j = 0; j < propertyNames.length; j++) {
                node[propertyNames[j]] = propertyValues[j] || "";
            }
        }
        
        for(var j = 0; j < headers.length; j++) {
            if (j === bodyIndex)
            {
                // clean up the body field before import
                node[headers[j]] = cleanText(data[i][j]);;
                // node[headers[j]] = md(data[i][j]);
            }
            else
            {
                node[headers[j]] = data[i][j];
            }
        }

        // console.log("adding node: " + JSON.stringify(node));
        nodes.push(node);
    }

    return nodes;    
}

function cleanText(text) {
    var newText = md(sanitizeHtml(text));
    
    return newText;
}

function extractImagePath(markdownText) {
    var renderer = new marked.Renderer();

    renderer.image = function (href, title, text) {
        console.log(marked('# heading+', { renderer: renderer }));
        return "";
    };

    console.log(marked(markdownText, { renderer: renderer }));
}

function newArticleNode(typeName, defaults) {
    var node = {
        "_type": typeName,
        "imported": true
    };
    
    if (defaults)
    {
        for(var key in defaults) {
            node[key] = defaults[key];
        }
    }
    
    return node;
}

function newCatNode(defaults) {
    var node = {
        "_type": TYPE_QNAME__CATEGORY,
        "title": "",
        "slug": "",
        "id": "",
        "body": "",
        "originalImageURL": "",
        "imported": true
    };
    
    for(var key in defaults) {
        node[key] = defaults[key];
    }
    
    return node;
}

function writeNode(context, callback) {
    context.branch.createNode(context.node).trap(function(err){
        return callback(err);
    }).then(function(){
        if(!this || !this._doc)
        {
            return callback("Node not created");
        }

        // console.log("Created node " + JSON.stringify(this));
        console.log("Created node " + this._doc);
        context.node = this;
        callback(null, context);
    });
}

function uploadAttachments(context, callback) {
    if(!context.attachments || context.attachments.length === 0)
    {
        // skipping, no attachments
        return callback(null, context);
    }

    if(!context.node)
    {
        return callback("Node not found");
    }

    async.each(context.attachments, function(attachment, callback){
        console.log("adding attachment " + attachment.attachmentId);

        context.node.attach(
            attachment.attachmentId,
            mime.lookup(attachment.path),
            fs.readFileSync(attachment.path),
            path.basename(attachment.path))
        .trap(function(err){
            return callback("Attachment upload failed " + err);
        }).then(function(){
            console.log("Attachment upload complete");
            callback(null, context);
        });
    }, function(err){
        return callback(err, context);
    });
}

function listTypeDefinitions() {
    var types = {};
    var files = util.findFiles(TYPES_PATH, "node.json");
    for (var i = 0; i < files.length; i++)
    {
        // module directory
        var dir = path.dirname(files[i]);
        var name = path.basename(files[i]);

        // read the module.json file
        var json = util.readJsonObject(files[i]);

        types[json._qname] = {
            "json": json,
            "dir": dir
        };
    }

    return types;
}

function createContext(node, branch, done) {
    var context = {
        "attachments": [],
        "branch": branch,
        "node": node.json
    };

    var nodeDir = node.dir;

    // attachments
    var attachmentsDir = path.join(nodeDir, "attachments");
    if (fs.existsSync(attachmentsDir))
    {
        var attachmentFiles = fs.readdirSync(attachmentsDir);
        for (var p = 0; p < attachmentFiles.length; p++)
        {
            var attachmentId = attachmentFiles[p];
            if (attachmentId.indexOf(".") > -1) {
                attachmentId = attachmentId.substring(0, attachmentId.indexOf("."));
            }

            context.attachments.push({
                // "_doc": product._alias,
                "attachmentId": attachmentId,
                "path": path.resolve(path.join(attachmentsDir, attachmentFiles[p]))
            });
        }
    }

    return done(null, context);
};