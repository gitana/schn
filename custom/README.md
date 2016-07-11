# Importer script for uploading content type definitions and bulk content into a Cloud CMS project.

The importer script requires dependencies to be installed:

   npm install

There is a help message available to explain the available options:

    node import -h
    
Prior to importing content, the content model definitions should be installed.
This script can install the defintion files but does not yet install forms. That
will need to be done manually.

First list the available definitions:

    node import -l

Import a content definition. This example loads the article content type (identified by qname):

    node import -t "schn:article"

The importer will not overwrite a defintion so you may need to delete the defition in the Cloud CMS UI if you are updating.    

## importing content
Run the importer once for each file to import
node import -x ./docs/import/EndNote\ export.sample.xml -t "schn:article"

### Import content from the following files (supplied by SCHN):

"articles"
./docs/import/EndNote export.sample.xml

    node import -x ./docs/import/EndNote\ export.sample.xml -t "schn:article"
