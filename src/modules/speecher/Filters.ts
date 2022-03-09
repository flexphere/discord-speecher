export const applyFilters = (message: string, filters: Function[]) => {
  return filters.reduce((prev: string, curr: Function) => {
    return curr(prev);
  }, message);
};

export const removeCodeBlock = (message: string) => {
  return message.replace(/```[^`]+```/g, "");
};

export const removeInlineCodeBlock = (message: string) => {
  return message.replace(/`[^`]+`/g, "");
};

export const removeQuote = (message: string) => {
  return message.replace(/^>.*/gm, "");
};

export const removeURL = (message: string) => {
  return message.replace(
    /https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/,
    ""
  );
};

export const emojiToLabel = (message: string) => {
  return message
    .replace(/<([^\d]+)\d+>/g, "$1")
    .replace(/<a?:(.*):\d+>/g, "$1");
};

export const formatRuby = (message: string) => {
  return message.replace(/\|[^<|]+<([^>]+)>/g, "$1");
};
