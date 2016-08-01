#!/bin/sh

# uninstall anything existing
# we do this twice because some things don't resolve the first time
cloudcms uninstall
cloudcms uninstall

# packages the archive, uploads and imports content into branch
cloudcms package schn-import app 1
cloudcms upload schn-import app 1
cloudcms import schn-import app 1
