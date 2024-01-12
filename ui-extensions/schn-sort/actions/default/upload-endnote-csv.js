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

            console.log("Create nodes to complete upload");
            // Parse actionContext.uploadedFiles to create documents from CSV(s) row entries

            // Populating authors by splitting authors by ;
            // Do the same for editors?
            // Keywords appear to be one per line - can split by \n. What do they look like in the original CSV file?
            // for the Book Title in chapters - it maps to secondarytitle, is Article Type meant to be a subfolder?
            // - the plan is to have user navigate to the folder in question before uploading, unless there is a determined way to parse the path from the data?
            // other types: Generic, Government Document, Conference Paper, Thesis, Conference Proceedings, etc.
            const typeMap = {
                "Journal Article": "schn:article",
                "Book": "schn:book",
                "Book Section": "schn:chapter",
                "Report": "schn:report"
            };  

            const typeColumnMap = {
                "Journal Article": {
                    "author": 1, // split into array and set contributors.authors
                    "year": 2,
                    "title": 3,
                    "periodical": 5,
                    "volume": 9,
                    "number": 11,
                    "pages": 12,
                    "keywords": 37, // split into array with \n delimitter
                    "abstract": 38,
                    "notes": 39
                },
                "Book": {
                    "author": 1, // split into array and set contributors.authors
                    "year": 2,
                    "title": 3,
                    "location": 6,
                    "publisher": 7,
                    "isbn": 21,
                    "keywords": 37, // split into array with \n delimitter
                    "abstract": 38,
                    "notes": 39 
                },
                "Book Section": {
                    "author": 1, // split into array by ; and set contributors.authors
                    "year": 2, 
                    "title": 3,
                    "editor": 4, // split into array by ; and set contributors.SecondaryAuthors
                    "secondarytitle": 5, // This is used for the Article type as well for the journal title
                    "location": 6,
                    "publisher": 7,
                    "isbn": 21,
                    "keywords": 37,
                    "abstract": 38,
                    "notes": 39
                },
                "Report": {
                    "author": 1, // split into array by ; and set contributors.authors
                    "year": 2,
                    "title": 3,
                    "location": 6,
                    "publisher": 7,
                    "pages": 12,
                    "keywords": 37, // split into array with \n delimitter
                    "abstract": 38,
                    "notes": 39
                }
            };

            // const columnNames = [
            //     "type",
            //     "author",
            //     "year",
            //     "title",
            //     "secondaryAuthor",
            //     "secondaryTitle",
            //     "placePublished",
            //     "publisher",
            //     "volume",
            //     "numVolumes",
            //     "number",
            //     "pages",
            //     "section",
            //     "tertiaryAuthor",
            //     "tertiaryTitle",
            //     "edition",
            //     "date",
            //     "workType",
            //     "subsidiaryAuthor",
            //     "shortTitle",
            //     "isbn",
            //     "doi",
            //     "originalPublication",
            //     "reprintEdition",
            //     "reviewedItem",
            //     "custom1",
            //     "custom2",
            //     "custom3",
            //     "custom4",
            //     "custom5",
            //     "custom6",
            //     "custom7",
            //     "custom8",
            //     "accessionNumber",
            //     "callNumber",
            //     "label",
            //     "keywords",
            //     "abstract",
            //     "notes",
            //     "researchNotes",
            //     "url",
            //     "fileAttachments",
            //     "authorAddress",
            //     "figure",
            //     "caption",
            //     "accessDate",
            //     "translatedAuthor",
            //     "translatedTitle",
            //     "nameOfDatabase",
            //     "databaseProvider",
            //     "language"
            // ];

            const processLine = async (line) => {
                if (line.size <= 0) return;
                const type = line[0];


                let nodeObj = {};
                const typeQName = typeMap[type];
                const columnMap = typeColumnMap[type];

                let result = null;
                if (typeQName && columnMap)
                {
                    nodeObj._type = typeQName;
                    nodeObj.contributors = {};
                    for (const [key, column] of Object.entries(columnMap)) {
                        let value = line[column];
                        if (!value) continue;
                        
                        // Handle special keys
                        if (key === "author") {
                            nodeObj.contributors.authors = value.split(";").map(author => author.trim());
                        }
                        else if (key === "editor") {
                            nodeObj.contributors.SecondaryAuthors = value.split(";").map(author => author.trim());
                        }
                        else if (key == "keywords") {
                            nodeObj.keywords = value.split("\n").map(keyword => keyword.trim());
                        }
                        else if (key === "secondarytitle") {
                            nodeObj.secondarytitle = value;
                        }
                        else {
                            nodeObj[key] = value;
                        }
                    }

                    result = await new Promise((resolve, reject) => {
                        // create project
                        self.block("Uploading CSV documents...", function() {
    
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
                                        "parentFolderPath": actionContext.model.path,
                                        "associationType": "a:child"
                                    })
                                    .trap(function(err) {
                                        reject(err);
                                        return false;
                                    }).then(function() {
                                        const node = this;
                                        console.log(nodeObj);
                                        self.unblock(function() {
                                            // resolve(node);
                                            resolve(nodeObj);
                                        });
                                    });
                            });
                        });
                    });
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

            Promise.all(tasks)
                .catch(err => {
                    callback(err)
                    OneTeam.showError(err);
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
                });
        },

        handleCancel: function(actionContext, control, div, callback)
        {
            return callback();
        }

    }));

});

