#!/bin/bash

# Script to upload source-code.zip to the S3 solution bucket
# Usage: ./upload-source-code.sh [env] [profile]
# Example: ./upload-source-code.sh dev my-aws-profile

set -e

ENV=${1:-}
PROFILE=${2:-}

if [ -z "$ENV" ]; then
    echo "Error: Environment parameter is required"
    echo "Usage: ./upload-source-code.sh [env] [profile]"
    echo "Example: ./upload-source-code.sh dev my-aws-profile"
    exit 1
fi

BUCKET_NAME="cases-contact-lens-genai-solution-${ENV}"
ZIP_FILE="source-code.zip"
REGION="ca-central-1"

if [ ! -f "$ZIP_FILE" ]; then
    echo "Error: $ZIP_FILE not found. Please run ./prepare-source-code.sh first."
    exit 1
fi

echo "Uploading $ZIP_FILE to s3://$BUCKET_NAME..."

if [ -z "$PROFILE" ]; then
    aws s3 cp "$ZIP_FILE" "s3://${BUCKET_NAME}/" --region "$REGION"
else
    aws s3 cp "$ZIP_FILE" "s3://${BUCKET_NAME}/" --region "$REGION" --profile "$PROFILE"
fi

echo "Upload complete! File is available at s3://${BUCKET_NAME}/${ZIP_FILE}"

