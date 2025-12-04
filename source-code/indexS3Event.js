
const connectCaseComment = require('./cases/connectCaseComment.js');
const casesLogTable = require('./dynamodb/casesLogTable.js');
const s3bucket = require('./s3/s3bucket.js');

const domainId = process.env.CasesDomainId;

const MAX_COMMENT_LENGTH = 3000;

function formatMillisToTime(millis) {
  if (typeof millis !== 'number' || isNaN(millis) || millis < 0) {
    return '';
  }
  const totalSeconds = Math.floor(millis / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function getSpeakerLabel(segment) {
  if (!segment) {
    return 'participant';
  }
  const role = (segment.ParticipantRole || '').toUpperCase();

  if (role === 'CUSTOMER') {
    return 'customer';
  }
  if (role === 'AGENT') {
    return 'agent';
  }
  if (role === 'SYSTEM') {
    return 'system';
  }

  return segment.ParticipantRole || 'participant';
}

function buildTranscriptLines(transcriptArray) {
  if (!Array.isArray(transcriptArray)) {
    return [];
  }

  const lines = [];
  let baseTime = null;

  for (const segment of transcriptArray) {
    // We only want actual chat/voice messages, not join/left/etc events
    if (!segment || !segment.Content || segment.Type !== 'MESSAGE') {
      continue;
    }

    // Compute relative time from the first message in the conversation.
    let timestampMs = null;
    if (segment.AbsoluteTime) {
      const parsed = Date.parse(segment.AbsoluteTime);
      if (!isNaN(parsed)) {
        timestampMs = parsed;
      }
    } else if (typeof segment.BeginOffsetMillis === 'number') {
      timestampMs = segment.BeginOffsetMillis;
    }

    let relativeMs = 0;
    if (timestampMs !== null) {
      if (baseTime === null) {
        baseTime = timestampMs;
      }
      const diffMs = timestampMs - baseTime;
      relativeMs = Math.max(0, diffMs);
    }

    const time = formatMillisToTime(relativeMs);

    const speaker = getSpeakerLabel(segment);
    const prefix = time ? `${time} - ${speaker}: ` : `${speaker}: `;

    lines.push(prefix + segment.Content);
  }

  return lines;
}

function buildCombinedCommentText(postCallSummary, transcriptLines) {
  let combined = '';

  if (postCallSummary) {
    let summaryText = postCallSummary.toString().trim();
    combined += summaryText;
  }

  if (transcriptLines && transcriptLines.length > 0) {
    if (combined.length > 0) {
      combined += '\n\n';
    }
    combined += 'transcript:\n';
    combined += '===========\n';
    combined += transcriptLines.join('\n');
  }

  return combined.trim();
}

function chunkText(text, maxLen) {
  if (!text) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxLen, text.length);

    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end);
      if (lastNewline > start + 1) {
        end = lastNewline + 1;
      }
    }

    const chunk = text.slice(start, end);
    chunks.push(chunk);
    start = end;
  }

  return chunks;
}

exports.handler = async function (event, context, callback) {
  let result = {};
  result['output'] = false;
  
  //console.log(JSON.stringify(event));

  for (let i = 0; i < event.Records.length; i++) {
    const record = event.Records[i];

    const bucket = event.Records[i].s3.bucket.name;

    const key = decodeURIComponent(event.Records[i].s3.object.key.replace(/\+/g, ' '));

    let objectBody = await s3bucket.get(bucket, key);

    let objectBodyJson = JSON.parse(objectBody);

    console.log('S3EventLambda: parsed Contact Lens object', {
      JobStatus: objectBodyJson && objectBodyJson.JobStatus,
      Channel: objectBodyJson && objectBodyJson.Channel,
      HasCustomerMetadata:
        !!(objectBodyJson && objectBodyJson.CustomerMetadata),
      HasContactId:
        !!(objectBodyJson &&
          objectBodyJson.CustomerMetadata &&
          objectBodyJson.CustomerMetadata.ContactId),
      HasTranscriptArray: Array.isArray(objectBodyJson.Transcript),
      TranscriptLength: Array.isArray(objectBodyJson.Transcript)
        ? objectBodyJson.Transcript.length
        : 0,
      HasConversationCharacteristics:
        !!(objectBodyJson && objectBodyJson.ConversationCharacteristics),
    });

    //console.log(JSON.stringify(objectBodyJson));
    
    const channel = objectBodyJson && objectBodyJson.Channel;
    const isChatContact = channel === 'CHAT';

    if (objectBodyJson && objectBodyJson.JobStatus === 'COMPLETED' && objectBodyJson.CustomerMetadata && objectBodyJson.CustomerMetadata.ContactId) {
      let ContactId = objectBodyJson.CustomerMetadata.ContactId;

      let postCallSummary;
      if (
        objectBodyJson.ConversationCharacteristics &&
        objectBodyJson.ConversationCharacteristics.ContactSummary &&
        objectBodyJson.ConversationCharacteristics.ContactSummary.PostContactSummary &&
        objectBodyJson.ConversationCharacteristics.ContactSummary.PostContactSummary.Content
      ) {
        postCallSummary = objectBodyJson.ConversationCharacteristics.ContactSummary.PostContactSummary.Content;
      }

      console.log('S3EventLambda: postCallSummary present?', !!postCallSummary, 'length:', postCallSummary ? postCallSummary.length : 0);

      let transcriptLines = [];

      if (isChatContact) {
        if (Array.isArray(objectBodyJson.Transcript)) {
          console.log(
            'S3EventLambda: (CHAT) sample Transcript[0..2]:',
            JSON.stringify(objectBodyJson.Transcript.slice(0, 3))
          );
        } else {
          console.log('S3EventLambda: (CHAT) Transcript field is not an array');
        }

        transcriptLines = buildTranscriptLines(objectBodyJson.Transcript);
        console.log('S3EventLambda: (CHAT) built transcriptLines count:', transcriptLines.length);
      } else {
        console.log('S3EventLambda: non-CHAT contact, skipping transcript');
      }

      const combinedCommentText = buildCombinedCommentText(postCallSummary, transcriptLines);
      console.log(
        'S3EventLambda: combinedCommentText length:',
        combinedCommentText ? combinedCommentText.length : 0
      );

      if (combinedCommentText && ContactId) {
        let caseId;
        let caseLogSummary = await casesLogTable.query(ContactId);
        if (caseLogSummary && caseLogSummary.Items && caseLogSummary.Items[0] && caseLogSummary.Items[0].caseId) {
          caseId = caseLogSummary.Items[0].caseId.S;
        }

        if (caseId) {
          console.log('S3EventLambda: loading summary/transcript', {
            ContactId,
            caseId,
          });

          const chunks = chunkText(combinedCommentText, MAX_COMMENT_LENGTH);
          console.log('S3EventLambda: number of chunks to send:', chunks.length);

          for (let j = chunks.length - 1; j >= 0; j--) {
            await connectCaseComment.updateCaseComments(domainId, caseId, chunks[j]);
          }
        }
      }
    }
  }

  callback(null, result);
};