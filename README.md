# Amazon Connect Cases - Generative AI call summarization

## Introduction

With generative AI-powered post-contact summarization, you get essential information from customer conversations in a structured, concise, and easy to read format. You can quickly review the summaries and understand the context instead of reading through transcripts and monitoring calls. Your agents save time when they view post-contact summarization associated with Amazon Connect cases.

In this solution for each contact, when the post-contact summarization is available, you attach the post-contact summarization to the case that is created as part of that contact. If a caller had five cases opened in the past, the agent can see all the cases and their respective post-contact summaries. This helps the agent understand the call's circumstances that led to the case being opened efficiently.

## Prerequisites
It is assumed that you understand the use of the services below and you have the following prerequisites:
1. An AWS account with both management console and programmatic administrator access.
2. An existing Amazon Connect instance.
3. Amazon Connect Customer Profiles enabled on Connect Instance.
4. Amazon Connect Cases enabled on Connect Instance. 
5. [Amazon Connect Contact Lens post contact summarization is enabled](https://docs.aws.amazon.com/connect/latest/adminguide/view-generative-ai-contact-summaries.html).

## Architecture diagram 

In the below architecture, there are two mains steps:

Step 1: Whenever an agent creates or updates a Case, Amazon Connect Cases event writes the case ID and the contact ID to Amazon Dynamo DB. 

Step 2: Amazon Connect writes Contact Lens file to Amazon S3, which contains a post-call summary. Amazon S3 event with Contact ID detail is configured to invoke an AWS Lambda function. The AWS Lambda does an Amazon Dynamo DB look up to fetch the Case ID. Amazon Connect Case API is called to add the post-call summary to the Case comments.

![Architecture Diagram](images/cases-with-contact-lens-genai-summary.png?raw=true)

## Walkthrough

1.  Download the content [here](https://github.com/aws-samples/cases-with-contact-lens-genai-summary/archive/refs/heads/main.zip) and unzip.
2.  Run the preparation script from the root directory to install dependencies and create the source-code.zip file:

   ```bash
   ./prepare-source-code.sh
   ```

   This script will:
   - Install npm dependencies in the source-code folder
   - Create source-code.zip containing the source-code folder contents
4.	Create a new S3 solution bucket in your AWS account. For example, using the AWS CLI in region `ca-central-1`:

   ```bash
   aws s3api create-bucket \
     --bucket cases-contact-lens-genai-solution-[env] \
     --region ca-central-1 \
     --create-bucket-configuration LocationConstraint=ca-central-1 \
     --profile <your-aws-profile-name>
   ```

5.	Upload the source-code zip file (created in step 2) into S3 Bucket (step 4). Run the upload script from the root directory:

   ```bash
   ./upload-source-code.sh [env] [profile]
   ```

   Replace `[env]` with your environment (e.g., `dev`, `qa`, `prod`) and `[profile]` with your AWS profile name (optional if using default profile).

   Example:
   ```bash
   ./upload-source-code.sh dev my-aws-profile
   ```
6-7.	Deploy the CloudFormation stack. Run the deployment script from the root directory:

   ```bash
   ./deploy-stack.sh [stack-name] [env] [connect-contact-lens-bucket] [cases-domain-id] [kms-key-arn] [profile] [region]
   ```

   Parameters:
   - `stack-name`: Name for the CloudFormation stack
   - `env`: Environment (e.g., `dev`, `qa`, `prod`) - used to construct the solution bucket name
   - `connect-contact-lens-bucket`: Data storage S3 bucket from the Amazon Connect instance
   - `cases-domain-id`: Case domain ID from the Amazon Connect instance
   - `kms-key-arn`: (Optional) KMS key ARN used to encrypt Contact Lens S3 objects. Use `""` if your bucket is not using SSE-KMS.
   - `profile`: AWS profile name (optional, if using default profile)
   - `region`: AWS region (optional, defaults to `ca-central-1`)

   Example:
   ```bash
   # With KMS-encrypted Contact Lens bucket
   ./deploy-stack.sh connect-cases-ai-summary-stack dev my-connect-bucket-123456 domain-1234567890 arn:aws:kms:ca-central-1:123456789012:key/abcd-efgh my-aws-profile

   # Without SSE-KMS on the Contact Lens bucket
   ./deploy-stack.sh connect-cases-ai-summary-stack dev my-connect-bucket-123456 domain-1234567890 "" my-aws-profile
   ```

   This script will deploy the CloudFormation template with the required parameters:
   - `SolutionSourceBucket`: Automatically set to `cases-contact-lens-genai-solution-[env]`
   - `ConnectContactLensS3Bucket`: The Connect Contact Lens S3 bucket you provide
   - `CasesDomainId`: The Cases domain ID you provide

![CloudFormation Template Screenshot](images/cft-screenshot2.png?raw=true)

8.	Once CloudFormation execution is successful, configure the Amazon S3 event.
    1. Navigate to Amazon Connect S3 data store bucket (the ConnectContactLensS3Bucket parameter from step 6-7)

    2. Click on Properties
![Properties](images/b-s3Bucket.png?raw=true)

    3. Click on Create event notification
![Properties](images/c-event.png?raw=true)

    4. Configure one of the following option
       
         Option 1: With Contact Lens redaction turned on, configure two events for the respective channel
           
            For Voice channel
           
                Enter a logical event name, e.g. cases-voice-sum
                Prefix: Analysis/Voice/Redacted
                Suffix: .json
           
            For Chat channel
           
                Enter a logical event name, e.g. cases-chat-sum
                Prefix: Analysis/Chat/Redacted
                Suffix: .json
       Option 2: With NO Contact Lens redaction, configure two events for the respective channel
           
            For Voice channel
           
                Enter a logical event name, e.g. cases-voice-sum
                Prefix: Analysis/Voice
                Suffix: .json
           
            For Chat channel
           
                Enter a logical event name, e.g. cases-chat-sum
                Prefix: Analysis/Chat
                Suffix: .json
           
    Screenshot example below
![Properties](images/d-eventname.png?raw=true)

    5. Select Put under event types
![Properties](images/e-eventtype.png?raw=true)

    6. Under the destination, select **Lambda function** and choose the AWS Lambda function named “`<stackname>-S3EventLambda`”
![Properties](images/f-destination.png?raw=true)

## Validate
1. Create or update your cases by placing test call or using the Agent workspace
2. You see Contact ID and Cases event in the Amazon DynamoDB table
3. You see post-contact summary under each Cases comment section in the Agent Workspace Cases view.

![S3 ](images/validate.png?raw=true)

## Conclusion
In this guide, you learned how to associate Amazon Connect Contact Lens’s generative AI powered post-contact summary to Amazon Connect Cases.
