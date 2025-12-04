const {   ConnectCasesClient,   CreateRelatedItemCommand, } = require("@aws-sdk/client-connectcases");
const region = process.env.AWS_REGION;
const connectCasesClient = new ConnectCasesClient({ region: region });

const connectCaseComment = {
  async updateCaseComments(domainId, caseId, commentText) {
    console.log('connectCaseComment.updateCaseComments called', {
      domainId,
      caseId,
      commentLength: commentText ? commentText.length : 0,
    });

    let input = {};
    input.caseId = caseId;
    input.domainId = domainId;
    input.type = "Comment";

    let comment = {};
    comment.body = commentText;
    comment.contentType = "Text/Plain";

    if (commentText) {
      const preview =
        commentText.length > 200
          ? commentText.substring(0, 200) + '...'
          : commentText;
      console.log('connectCaseComment comment preview:', preview);
    }

    let content = {};
    content.comment = comment;

    input.content = content;

    const command = new CreateRelatedItemCommand(input);
    const response = await connectCasesClient.send(command);

    return response;
  },
};

module.exports = connectCaseComment;
