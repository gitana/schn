define(function(require) {

    require("./login-splash/login-splash");

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

                    OneTeam.showOverlay("login-splash", config, function (err) {
                    });
                }
            }
        }
    });

});