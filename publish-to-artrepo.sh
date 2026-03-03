#!/usr/bin/env bash

# Check if ARTIFACTORY_USER is set
if [ -z "$ARTIFACTORY_USER" ]; then
    echo "ARTIFACTORY_USER is not set"
    exit 1
fi

# Check if ARTIFACTORY_TOKEN is setl
if [ -z "$ARTIFACTORY_TOKEN" ]; then
    echo "ARTIFACTORY_TOKEN is not set"
    exit 1
fi

# Check if VERSION is set
if [ -z "$VERSION" ]; then
    echo "VERSION is not set"
    exit 1
fi

curl -u "$ARTIFACTORY_USER:$ARTIFACTORY_TOKEN" -T dist.tar.gz "https://artrepo.vegvesen.no/artifactory/webcontent-release-local/no/vegvesen/vt/nvdb/nvdb-finn-vegdata/nvdb-finn-vegdata-$VERSION.tar.gz"
