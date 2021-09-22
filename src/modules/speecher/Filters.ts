export const applyFilters = (message: string, filters: Function[]) =>{
  return filters.reduce((prev:string, curr:Function) => {
    return curr(prev);
  }, message);
}

export const removeCodeBlock = (message: string) => {
  return message.replace(/```[^`]+```/g, '');
}

export const removeQuote = (message: string) => {
  return message.replace(/^>.*/mg, "");
}

export const removeURL = (message: string) => {
  return message.replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/, '');
}

export const emojiToLabel = (message: string) => {
  const emojiRegex = new RegExp('(.*?)(<a|a)*:(.*?):.*','g');
  return message.match(emojiRegex)?.map(m=>m.split(' ').map(s=>s.replace(emojiRegex,'$1 $3')).join(' ')).join();
}