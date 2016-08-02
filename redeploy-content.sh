#!/bin/sh

# uninstall anything existing
# we do this twice because some things don't resolve the first time
# cloudcms uninstall
# cloudcms uninstall

count=0
for dir in custom/docs/import/CloudCMS\ database*/
do
    dir=${dir%*/}
    echo ***********************
    echo ${dir} ****************
    count=`expr $count + 1`    
    cd custom
    node ./import.js -t schn:article -f "../${dir}" -n ./docs/import/attachments/unzipped -m /articles -k ./build

    cd ..
    cloudcms package schn-import-batch-${count} app 1
    cloudcms upload schn-import-batch-${count} app 1
    cloudcms import schn-import-batch-${count} app 1
done
