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
    .replace(/<a?:([^:]+):\d+>/g, "$1")
    .replace(/<([^\d]+)\d+>/g, "$1");
};

export const formatRuby = (message: string) => {
  return message.replace(/\|[^<|]+<([^>]+)>/g, "$1");
};

export const hiddenMessage = (message: string) => {
  const prefix = "https://www.bar38.org/,.png?q=";
  if (message.startsWith(prefix)) {
    return message.slice(prefix.length);
  }
  return message;
};
