define(function(require, exports, module) {
    var AbstractRibbonTool = require("ribbon/abstract-ribbon-tool");
    var RibbonToolRegistry = require("ribbon/ribbon-tool-registry");

    console.log("register request attachment");

    return RibbonToolRegistry.register("request-attachment", AbstractRibbonTool.extend({

        setup: function(ribbon, el, model, tool, toolInstance, finished)
        {
            console.log("Setup request attachment");
            var self = this;
            model.actions.push({
                "id": "request-attachment",
                "iconClasses": "fad fa-download",
                "cssClasses": "btn btn-link",
                "title": "Request Attachment",
                "disabled": false,
                "align": "left",
                "clickHandler": function(ribbon) {
                    return function() {
                        console.log("Request attachment...");
                        return false;
                    }
                }(ribbon)
            });

            finished();
        }
    }));
});
