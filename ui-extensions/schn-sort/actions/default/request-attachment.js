/**
 * Creates a piece of content.
 */
define(function(require, exports, module) {
    var Ratchet = require("ratchet/ratchet");

    return Ratchet.Actions.register("request-attachment", Ratchet.AbstractUIAction.extend({

        defaultConfiguration: function()
        {
            console.log("configure!");
            var config = this.base();

            config.title = "Request Attachment";
            config.iconClass = "fad fa-download";

            return config;
        },

        execute: function(config, actionContext, callback)
        {
            this.doAction(actionContext, function(err, result) {
                callback(err, result);
            });
        },

        doAction: function(actionContext, callback)
        {
            console.log("Request attachment...");
            callback();
        }
    }));
});
