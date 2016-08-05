#!/bin/sh

# uninstall anything existing
# we do this twice because some things don't resolve the first time
# cloudcms uninstall
cloudcms uninstall

count=0
rm custom/build/missingAttachmentsList.json
rm custom/build/attachmentsList.json
for dir in custom/docs/import/CloudCMS\ database\ 10*/
do
    dir=${dir%*/}
    echo "*******************************"
    echo "** ${dir} "
    echo "*******************************"
    count=`expr $count + 1`    
    cd custom
    node ./import.js -t schn:article -f "../${dir}" -n ./docs/import/attachments/unzipped -m /Articles -k ./build

    cd ..
    echo "*******************************"
    echo "** create package schn-import-batch-${count}"
    cloudcms package schn-import-batch-${count} app 1
    echo "*******************************"
    echo "** upload package schn-import-batch-${count}"
    cloudcms upload schn-import-batch-${count} app 1
    echo "*******************************"
    echo "** import package schn-import-batch-${count}"
    cloudcms import schn-import-batch-${count} app 1
done
