define(function(require) {

    require("./splash/login-splash.js");

    var $ = require("jquery");
    var OneTeam = require("oneteam");

    $(document).on("dispatch", function(event, ratchet, completed) {

        if (completed)
        {
            if (!ratchet.isDetached())
            {
                if (window.location.hash === "#/")
                {
                    var config = {};
                    config.title = "Welcome to Cloud CMS";
                    config.cancel = false;
                    config.close = true;

                    OneTeam.showOverlay("schn-login-splash", config, function (err) {
                    });
                }
            }
        }
    });

});