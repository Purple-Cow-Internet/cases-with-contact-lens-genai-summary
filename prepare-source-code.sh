#!/bin/bash

# Script to prepare source code for deployment
# This script runs npm install and creates source-code.zip

set -e

echo "Installing npm dependencies..."
cd source-code
npm install
cd ..

echo "Creating source-code.zip..."
cd source-code
zip -r ../source-code.zip . -x "*.git*" "node_modules/.cache/*"
cd ..

echo "Done! source-code.zip has been created in the root directory."

