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

                        OneTeam.oneTeamApplication(ribbon, function() {

                            var application = this;
                            var document = ribbon.observable("document").get();
                            var user = ribbon.observable("user").get();
                            var emailTemplateId = tool.confiog.emailTemplateId;

            
                            var publicEmailProviderId = null;
                            if (application.public)
                            {
                                publicEmailProviderId = application.public.emailProviderId;
                            }
            
                            if (publicEmailProviderId)
                            {
                                Chain(application).readEmailProvider(publicEmailProviderId).then(function() {

                                    var emailProvider = this;
                                    var from = emailProvider.from;

                                    var emailModel = {
                                        "user": user,
                                        "node": document
                                    };

                                    // create email
                                    this.createEmail({
                                        "to": "michael.whitman@gitana.io",
                                        "from": from,
                                        "subject": "Attachment Request",
                                        "bodyRepositoryId": document.getRepositoryId(),
                                        "bodyBranchId": document.getBranchId(),
                                        "bodyNodeId": emailTemplateId
                                    }).then(function() {
                                        console.log("Send email");
                                        this.subchain(emailProvider).send(this, emailModel)
                                    });
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
