/**
 * Este script lista as principais propriedades e métodos da classe Message
 * do whatsapp-web.js com base na documentação
 */

const messageProps = [
  // Propriedades básicas
  "id", "body", "type", "timestamp", "from", "to", "author", "deviceType", "isForwarded", 
  "forwardingScore", "isStatus", "isStarred", "broadcast", "fromMe", "hasMedia", "hasQuotedMsg",
  
  // Propriedades de mídia
  "mimetype", "mediaKey", "caption", "isGif", "isPTT", "isAudio", "duration",

  // Propriedades de reações
  "reaction", "pollName", "pollOptions", "pollVotes", "pollVote",
  
  // Propriedades de localização
  "location", "lat", "lng", "speed", "address", "shareDuration",

  // Propriedades de contato e vCard
  "vCards", "mentionedIds", "groupMentions",
  
  // Propriedades de negócios e pagamentos
  "orderId", "token", "product", "businessOwnerJid", "inviteV4", "paymentCurrency", "paymentAmount1000", "paymentMessageReceiptId", "paymentStatus",
  
  // Propriedades de estados e flags
  "ack", "hasReaction", "isEphemeral", "isViewOnce", "links", "buttons", "selectedButtonId", "selectedRowId",
];

// Exibe as propriedades
console.log("Propriedades da classe Message no whatsapp-web.js:");
console.log(JSON.stringify(messageProps, null, 2));
