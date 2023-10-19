define(function(require, exports, module) {
    var AbstractRibbonTool = require("ribbon/abstract-ribbon-tool");
    var RibbonToolRegistry = require("ribbon/ribbon-tool-registry");
    var OneTeam = require("oneteam");

    console.log("register request attachment");

    return RibbonToolRegistry.register("request-attachment", AbstractRibbonTool.extend({

        setup: function(ribbon, el, model, tool, toolInstance, finished)
        {
            console.log("Setup request attachment");
            var self = this;
            var emailId = tool.config.emailId;

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

                        OneTeam.oneTeamApplication(self, function() {

                            var application = this;
            
                            var publicEmailProviderId = null;
                            if (application.public)
                            {
                                publicEmailProviderId = application.public.emailProviderId;
                            }
            
                            if (publicEmailProviderId)
                            {
                                var emailModel = {
                                    "username": "myguy",
                                    "node": {
                                        "title": "Heyhey"
                                    }
                                };
                                
                                console.log("Send email");
            
                                $.ajax({
                                    "type": "POST",
                                    "contentType": "application/json",
                                    "dataType": "json",
                                    "processData": false,
                                    "url": `/proxy/applications/${application.getId()}/emailprovider/send?id=${emailId}`,
                                    "data": JSON.stringify(emailModel),
                                    "headers": {
                                        "X-CSRF-TOKEN": OneTeam.getCsrfToken()
                                    }
                                }).done(function(data) {
                
                
                                }).fail(function(xhr) {
                                    OneTeam.errorHandler(xhr);
                                }); 
                            }
                        });


                        return false;
                    }
                }(ribbon)
            });

            finished();
        }
    }));
});
