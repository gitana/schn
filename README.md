# schn

cd custom
node import.js -t "schn:article" -f "./docs/import/CloudCMS database" -n "./docs/import/attachments/unzipped" -m "/articles" -k "./build"

cd ..
cloudcms package schn app 1