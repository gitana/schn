/**
 * Creates a piece of content.
 */
define(function(require, exports, module) {
    var Ratchet = require("ratchet/ratchet");

    return Ratchet.Actions.register("request-attachment", Ratchet.AbstractAction.extend({

        defaultConfiguration: function()
        {
            var config = this.base();

            config.title = "Request Attachment";
            config.iconClass = "fad fa-download";

            return config;
        },

        doAction: function(actionContext, callback)
        {
            console.log("Request attachment...");
            callback();
        }
    }));
});
