import { langToExtMap } from "./constants.mjs";
// import path from 'path';

const regex = new RegExp(/```(?<type>[^\n]*)?\n(?<content>[.\s\S\n]*?)\n```/gmu);
type Range = [from: number, to: number];
export type CodeBlock = {
  blockRange: Range;
  codeRange: Range;
  content: string;
  fileName: string | undefined;
  lang: string | undefined;
  index: number;
};

export function extractCodeBlocks(text: string) {
  const blocks: Array<CodeBlock> = [];
  for (const match of text.matchAll(regex)) {
    const { content, type } = match.groups! as {
      content: string;
      type?: string;
    };
    const start = match.index!;
    const end = start + Array.from(match[0]).length;
    const codeStart = start + 3 + (type ? Array.from(type).length : 0) + 1;
    const codeEnd = codeStart + Array.from(content).length;
    const [lang, fileName] = type?.split(":") ?? [undefined, undefined];
    blocks.push({
      blockRange: [start, end],
      codeRange: [codeStart, codeEnd],
      lang,
      content,
      fileName,
      index: blocks.length,
    });
  }
  return blocks;
}

export function getVirtualFileName(block: CodeBlock) {
  const ext = langToExtMap[block.lang ?? ""] ?? ".txt";
  if (block.fileName) {
    return block.fileName.endsWith(ext) ? block.fileName : `${block.fileName}${ext}`;
  }
  return `${block.index}${ext}`;
}

