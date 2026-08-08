export const mem0 = {
  add: async (memory: string, options?: any) => {
    console.log("mem0.add", memory, options);
  },
  search: async (query: string, options?: any) => {
    console.log("mem0.search", query, options);
    return [];
  },
};
