define(function(require, exports, module) {
    var AbstractRibbonTool = require("ribbon/abstract-ribbon-tool");
    var RibbonToolRegistry = require("ribbon/ribbon-tool-registry");
    var OneTeam = require("oneteam");
    var Ratchet = require("ratchet/ratchet");

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
                        Ratchet.block("Requesting Attachment", "Please wait...", function() {
                            OneTeam.oneTeamApplication(ribbon, function() {
    
                                var application = this;
                                var document = ribbon.observable("document").get();
                                var user = ribbon.observable("user").get();
                                var emailTemplateId = tool.config.emailTemplateId;
                                var requestEmail = tool.config.requestEmail;
    
                
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
                                        application.createEmail({
                                            "to": requestEmail,
                                            "from": from,
                                            "subject": "Attachment Request",
                                            "bodyRepositoryId": document.getRepositoryId(),
                                            "bodyBranchId": document.getBranchId(),
                                            "bodyNodeId": emailTemplateId
                                        }).then(function() {
                                            this.subchain(emailProvider).send(this, emailModel).then(function() {
                                                console.log("Send email");
                                                Ratchet.unblock();
                                            })
                                        });
                                    });
                                }
                        });
                        });
                        return false;
                    }
                }(ribbon)
            });

            finished();
        }
    }));
});
