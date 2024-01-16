define(function(require, exports, module) {

    // require("css!./upload-endnote-csv.css");

    var Ratchet = require("ratchet/ratchet");
    var Actions = Ratchet.Actions;
    var $ = require("jquery");
    var UI = require("ui");
    
    var OneTeam = require("oneteam");

    require("../../csv.min.js");

    return Actions.register("upload-endnote-csv", Ratchet.AbstractUIAction.extend({

        defaultConfiguration: function()
        {
            var config = this.base();

            config.title = "Upload Endnote CSV";
            config.iconClass = "fad fa-table";

            return config;
        },

        execute: function(config, actionContext, callback)
        {
            var parentFolderPath = actionContext.model.path;
            var typeQName = "schn:article"
            var ratchet = actionContext.ratchet;

            if (typeof(actionContext.promptOnCleanup) === "undefined") {
                actionContext.promptOnCleanup = true;
            }

            this.doAction(actionContext, parentFolderPath, typeQName, ratchet, function(err, result) {
                callback(err, result);
            });
        },

        doAction: function(actionContext, parentFolderPath, typeQName, ratchet, callback)
        {
            var self = this;
            
            // store nodeIds generated with uploaded files	
            actionContext.data = [];

            var branch = OneTeam.getEditorialBranch(actionContext);

            var enhanceFiles = function(fileUploadConfig, data)
            {
                // convert to files
                var files = [];

                for (var file of data.files)
                {
                    files.push({
                        "id": file.name,
                        "name": file.name,
                        "size": file.size,
                        "type": file.type,
                        "file": file
                    });
                }

                data.result = {};
                data.result.files = files;
            };

            var parentFolderPathFriendly = parentFolderPath.trim();
            if (parentFolderPathFriendly.indexOf("/") === 0) {
                parentFolderPathFriendly = parentFolderPathFriendly.substring(1);
            }
            if (parentFolderPathFriendly)
            {
                parentFolderPathFriendly = OneTeam.uriDecode(parentFolderPathFriendly);
                parentFolderPathFriendly = OneTeam.replaceAll(parentFolderPathFriendly, "+", " ");
                parentFolderPathFriendly = "Root/" + parentFolderPathFriendly;
            }
            else
            {
                parentFolderPathFriendly = "Root";
            }
            var parts = parentFolderPathFriendly.split("/");
            for (var q = 0; q < parts.length; q++)
            {
                parts[q] = OneTeam.toPathTitle(actionContext, parts[q]);
            }
            parentFolderPathFriendly = parts.join("/");
            parentFolderPathFriendly = OneTeam.replaceAll(parentFolderPathFriendly, "/", "&nbsp;/&nbsp;");

            actionContext.uploadedFiles = {};
            actionContext.branch = OneTeam.projectBranch(actionContext);

            // modal dialog
            UI.showModal({
                "title": "Upload Endnote CSV",
                "classes": "upload_documents",
                "full": true
            }, function(div, renderCallback) {

                $(div).show();

                // append the "Cancel" button -- will delete nodes generated with uploaded files
                $(div).find('.modal-footer').append("<button class='btn btn-danger pull-left cancel'>Cancel</button>");
                
                // append the "Create" button
                $(div).find('.modal-footer').append("<button class='btn btn-primary pull-right done'>Done</button>");


                // body
                $(div).find(".modal-body").html("");

                if (parentFolderPathFriendly)
                {
                    $(div).find(".modal-body").append("<p class='upload-path'><i class='fad fa-folder'></i>&nbsp;&nbsp;" + parentFolderPathFriendly + "</p>");
                }

                $(div).find(".modal-body").append("<div class='form'></div>");

                // form definition
                var c = {
                    "schema": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    },
                    "options": {
                        "type": "upload",
                        "multiple": true,
                        "directory": true,
                        "upload": {
                            "dataType": "text",
                            "maxNumberOfFiles": 10,
                            "showSubmitButton": false,
                            "processQueue": []
                        },
                        "enhanceFiles": enhanceFiles,
                        "showUploadPreview": true,
                        "showHeaders": true,
                        "errorHandler": function(data)
                        {
                            // filesize too big
                            if (data && Array.isArray(data) && data[0]) {
                                OneTeam.showError(data[0]);
                            }

                            // if we get back more information in the underlying jqXHR, show that
                            if (data && data.files && data.files.length > 0)
                            {
                                for (var i = 0; i < data.files.length; i++)
                                {
                                    if (data.jqXHR && data.jqXHR.responseJSON)
                                    {
                                        var errMsg = data.jqXHR.responseJSON.message;
                                        if (errMsg)
                                        {
                                            OneTeam.showError(errMsg);
                                        }
                                    }
                                }
                            }
                        },
                        "beforeAddValidator": function(file)
                        {
                            // prevent MacOS .ds_store files from uploading
                            if (!(file.name.toLowerCase().endsWith(".csv") || file.name.toLowerCase().endsWith(".xlsx")))
                            {
                                return false;
                            }

                            return true;
                        },
                        "afterFileUploadDone": function(data)
                        {
                            actionContext.uploadedFiles = data.files;
                            $(div).find("thead").show();
                        },
                        "afterFileUploadRemove": function(data)
                        {
                            actionContext.uploadedFiles = data.files;
                            if (this.getValueAsArray() && this.getValueAsArray().length === 0)
                            {
                                $(div).find("thead").hide();
                            }
                            else
                            {
                                $(div).find("thead").show();
                            }
                        },
                        "afterFileUploadAlways": function(data)
                        {
                            self.refreshWindow(div);
                        },
                    }
                };

                c.postRender = function(control)
                {
                    $(div).off('hidden.bs.modal');
                    $(div).on('hidden.bs.modal', function() {

                        var uploadedFileIds = [];

                        var uploadedFiles = control.getValue();
                        if (uploadedFiles)
                        {
                            for (var i = 0; i < uploadedFiles.length; i++) {
                                uploadedFileIds.push(uploadedFiles[i].id);
                            }
                        }

                        callback(null, uploadedFileIds);
                    });

                    $(div).find(".fileupload-add-button").addClass("btn").addClass("btn-primary");

                    // done button
                    $(div).find('.done').click(function() {
                        $(div).modal("hide");
                        self.handleDone(actionContext, control, div, function() {
                        });
                    });

                    // cancel button
                    $(div).find('.cancel').click(function() {
                        self.handleCancel(actionContext, control, div, function() {
                            control.setValue([]);
                            // $(div).on('hidden.bs.modal', function() {
                            //     $(div).modal("dispose");
                            // });
                            $(div).modal("hide");

                        });
                    });

                    // if we don't have any files uploaded (no preloaded data)
                    // then hide thead
                    if (control.getValue().length > 0)
                    {
                        $(div).find("thead").show();
                    }

                    self.refreshWindow(div);
                };

                var _form = $(div).find(".form");
                OneTeam.formCreate(_form, c, actionContext);
            });
        },

        refreshWindow: function(modalDiv)
        {
        },

        handleDone: function(actionContext, control, div, callback)
        {
            const self = this;

            // Parse actionContext.uploadedFiles to create documents from CSV(s) row entries
            const typeMap = {
                "Journal Article": "schn:article",
                "Book": "schn:book",
                "Book Section": "schn:chapter",
                "Report": "schn:report",
                "Government Document": "schn:report",
                "Thesis": "schn:report",
            };  

            const typeColumnMap = {
                "schn:article": {
                    "author": 1, // split into array and set contributors.authors
                    "year": 2,
                    "title": 3,
                    "periodical": 5,
                    "volume": 8,
                    "number": 10,
                    "pages": 11,
                    "path": 31,
                    "keywords": 37, // split into array with \n delimitter
                    "abstract": 38,
                    "notes": 39
                },
                "schn:book": {
                    "author": 1, // split into array and set contributors.authors
                    "year": 2,
                    "title": 3,
                    "location": 6,
                    "publisher": 7,
                    "isbn": 21,
                    "path": 31,
                    "keywords": 37, // split into array with \n delimitter
                    "abstract": 38,
                    "notes": 39 
                },
                "schn:chapter": {
                    "author": 1, // split into array by ; and set contributors.authors
                    "year": 2, 
                    "title": 3,
                    "editor": 4, // split into array by ; and set contributors.SecondaryAuthors
                    "secondarytitle": 5, // This is used for the Article type as well for the journal title
                    "location": 6,
                    "publisher": 7,
                    "isbn": 21,
                    "path": 31,
                    "keywords": 37,
                    "abstract": 38,
                    "notes": 39
                },
                "schn:report": {
                    "author": 1, // split into array by ; and set contributors.authors
                    "year": 2,
                    "title": 3,
                    "location": 6,
                    "publisher": 7,
                    "pages": 12,
                    "path": 31,
                    "keywords": 37, // split into array with \n delimitter
                    "abstract": 38,
                    "notes": 39
                },
                "schn:general": {
                    "author": 1, // split into array by ; and set contributors.authors
                    "year": 2,
                    "title": 3,
                    "secondarytitle": 5,
                    "location": 6,
                    "publisher": 7,
                    "path": 31,
                    "keywords": 37, // split into array with \n delimitter
                    "abstract": 38,
                    "notes": 39 
                }
            };

            const processLine = async (line) => {
                if (line.size <= 0) return;
                const type = line[0];


                let nodeObj = {};
                const typeQName = typeMap[type] || "schn:general";
                const columnMap = typeColumnMap[typeQName];

                let result = null;
                if (typeQName && columnMap)
                {
                    nodeObj._type = typeQName;
                    nodeObj.contributors = [{}];
                    let path = actionContext.model.path;

                    for (const [key, column] of Object.entries(columnMap)) {
                        let value = line[column];
                        if (!value) continue;
                        
                        // Handle special keys
                        if (key === "author") {
                            nodeObj.contributors[0].authors = value.split(";").map(author => author.trim());
                        }
                        else if (key === "editor") {
                            nodeObj.contributors[0].SecondaryAuthors = value.split(";").map(author => author.trim());
                        }
                        else if (key === "keywords") {
                            nodeObj.keywords = value.split("\n").map(keyword => keyword.trim());
                        }
                        else if (key === "path") {
                            // override the path if present in the metadata
                            path = value;
                            delete nodeObj[key];
                        }
                        else {
                            nodeObj[key] = String(value);
                        }
                    }

                    try {
                        const blah = await new Promise((resolve, reject) => {
                            // list the definitions on the branch
                            var branch = actionContext.branch;
                            Chain(branch)
                                .trap(function(err) {
                                    reject(err);
                                    return false;
                                })
                                .then(function() {
                                    this.createNode(nodeObj, {
                                        "rootNodeId": "root",
                                        "parentFolderPath": path,
                                        "associationType": "a:child"
                                    })
                                    .trap(function(err) {
                                        reject(err);
                                        return false;
                                    }).then(function(n) {
                                        const node = this;
                                        
                                        // resolve json since node object seems to get nulled out
                                        resolve(node.json());
                                    });
                            });
                        });
                        result = blah;
                    }
                    catch (e)
                    {
                        debugger;
                        throw e;
                    }
                }
                return result;
            }
            
            const processFile = async (file) => {
                let tasks = [];
                const text = await file.text();

                // Too basic
                // const lines = text.split("\n").map(line => line.split(","));
                
                const lines = CSV.parse(text);
                
                for (const line of lines)
                {
                    tasks.push((async () => {
                        let result = undefined;
                        try {
                            result = await processLine(line)
                        }
                        catch (err) {
                            console.error(err);
                            throw err;
                        }
                        return result;
                    })());
                }

                const results = await Promise.all(tasks);
                return results;
            }

            let tasks = [];
            if (actionContext.uploadedFiles)
            {
                for (const fileDescriptor of actionContext.uploadedFiles)
                {
                    const file = fileDescriptor.file;
    
                    // async!!
                    tasks.push(processFile(file))
                }
            }

            self.block("Uploading CSV documents...", function() {
                Promise.all(tasks)
                    .catch(err => {
                        OneTeam.showError(err, callback);
                    })
                    .then(fileResults => {
                        let message = "Created these documents from CSV:\n<ul>";
                        for (const nodes of fileResults)
                        {
                            for (const node of nodes)
                            {
                                if (node) {
                                    message += `<li>${node.title || node._doc}</li>`
                                }
                            }
                        }
    
                        message += "</ul>";
                        OneTeam.showMessage("Success", message, callback);
                    })
                    .finally(() => {
                        self.unblock(() => {});
                    });
            });
        },

        handleCancel: function(actionContext, control, div, callback)
        {
            return callback();
        }

    }));

});

