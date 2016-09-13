define(function(require, exports, module) {

    require("css!./login-splash.css");
    var html = require("text!./login-splash.html");

    var Ratchet = require("ratchet/web");
    var OneTeam = require("oneteam");

    return Ratchet.GadgetRegistry.register("schn-login-splash", Ratchet.Overlay.extend({

        TEMPLATE: html,

        prepareModel: function(el, model, callback)
        {
            this.base(el, model, function() {
                callback();
            });
        },

        afterSwap: function(el, model, originalContext, callback)
        {
            var self = this;

            this.base(el, model, originalContext, function() {
                $(el).find("button.btn-default").off().click(function(e) {
                    self.closeOverlay(el);
                });

                callback();
            });
        }
    }));
});