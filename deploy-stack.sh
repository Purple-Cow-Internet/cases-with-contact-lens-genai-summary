#!/bin/bash

# Script to deploy the CloudFormation stack
# Usage: ./deploy-stack.sh [stack-name] [env] [connect-contact-lens-bucket] [cases-domain-id] [kms-key-arn] [profile] [region]
# Example with KMS key: ./deploy-stack.sh my-stack dev my-connect-bucket domain-1234567890 arn:aws:kms:ca-central-1:123456789012:key/abcd-efgh my-aws-profile ca-central-1
# Example without KMS key: ./deploy-stack.sh my-stack dev my-connect-bucket domain-1234567890 "" my-aws-profile ca-central-1

set -e

STACK_NAME=${1:-}
ENV=${2:-}
CONNECT_CONTACT_LENS_BUCKET=${3:-}
CASES_DOMAIN_ID=${4:-}
KMS_KEY_ARN=${5:-}
PROFILE=${6:-}
REGION=${7:-ca-central-1}

if [ -z "$STACK_NAME" ] || [ -z "$ENV" ] || [ -z "$CONNECT_CONTACT_LENS_BUCKET" ] || [ -z "$CASES_DOMAIN_ID" ]; then
    echo "Error: Missing required parameters"
    echo "Usage: ./deploy-stack.sh [stack-name] [env] [connect-contact-lens-bucket] [cases-domain-id] [kms-key-arn] [profile] [region]"
    echo ""
    echo "Parameters:"
    echo "  stack-name                  - Name for the CloudFormation stack"
    echo "  env                         - Environment (e.g., dev, qa, prod)"
    echo "  connect-contact-lens-bucket - Data storage S3 bucket from Amazon Connect instance"
    echo "  cases-domain-id             - Case domain ID from Amazon Connect instance"
    echo "  kms-key-arn                 - (Optional) KMS key ARN used to encrypt Contact Lens S3 objects. Use \"\" if not using SSE-KMS."
    echo "  profile                     - AWS profile name (optional, if using default profile)"
    echo "  region                      - AWS region (optional, defaults to ca-central-1)"
    echo ""
    echo "Example:"
    echo "  ./deploy-stack.sh my-stack dev my-connect-bucket domain-1234567890 my-aws-profile"
    exit 1
fi

SOLUTION_BUCKET="cases-contact-lens-genai-solution-${ENV}"
TEMPLATE_FILE="cft/cases-with-contact-lens-genai-summary-cft.yaml"

if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "Error: CloudFormation template not found at $TEMPLATE_FILE"
    exit 1
fi

echo "Deploying CloudFormation stack: $STACK_NAME"
echo "  Environment: $ENV"
echo "  Solution Bucket: $SOLUTION_BUCKET"
echo "  Connect Contact Lens Bucket: $CONNECT_CONTACT_LENS_BUCKET"
echo "  Cases Domain ID: $CASES_DOMAIN_ID"
echo "  KMS Key ARN: ${KMS_KEY_ARN:-<none>}"
echo "  Region: $REGION"
echo ""

if [ -z "$PROFILE" ]; then
    aws cloudformation deploy \
        --template-file "$TEMPLATE_FILE" \
        --stack-name "$STACK_NAME" \
        --parameter-overrides \
            SolutionSourceBucket="$SOLUTION_BUCKET" \
            ConnectContactLensS3Bucket="$CONNECT_CONTACT_LENS_BUCKET" \
            CasesDomainId="$CASES_DOMAIN_ID" \
            ContactLensKmsKeyArn="$KMS_KEY_ARN" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        --region "$REGION"
else
    aws cloudformation deploy \
        --template-file "$TEMPLATE_FILE" \
        --stack-name "$STACK_NAME" \
        --parameter-overrides \
            SolutionSourceBucket="$SOLUTION_BUCKET" \
            ConnectContactLensS3Bucket="$CONNECT_CONTACT_LENS_BUCKET" \
            CasesDomainId="$CASES_DOMAIN_ID" \
            ContactLensKmsKeyArn="$KMS_KEY_ARN" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        --region "$REGION" \
        --profile "$PROFILE"
fi

echo ""
echo "Stack deployment initiated. Check the AWS CloudFormation console for status."

