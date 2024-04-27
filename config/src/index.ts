export type SqlNode = {
  code_range: {
    start: {
      line: number; // 0-based
      character: number; // 0-based
    };
    end: {
      line: number; // 0-based
      character: number; // 0-based
    };
  };
  content: string;
};
