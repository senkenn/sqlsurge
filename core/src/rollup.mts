import { type Plugin } from "rollup";
import { CodeBlock, extractCodeBlocks, getVirtualFileName } from "./markdown.mjs";
import path from "node:path";

export function markdownRunner() {
  const blockMap = new Map<string, CodeBlock[]>();
  return {
    name: "mardown-runner",
    enforce: "pre",
    resolveId(id, importer) {
      // console.log("[resolveId]", id, importer);
      // console.log("[resolveId]", id, importer);
      if (id.endsWith(".mdx") || id.endsWith(".md")) {
        if (importer && id.startsWith("./")) {
          console.log("[resolveId:mdx-dot]", path.join(path.dirname(importer), id));
          const rid = path.join(path.dirname(importer), id);
          // validate(rid);
          return rid;
        }
        // validate(id);
        return id;
      }
      // if ()
      if (
        importer &&
        id.match(/\.mdx?@/) &&
        (id.endsWith(".ts") || id.endsWith(".tsx"))
      ) {
        if (id.startsWith(".")) {
          const rid = path.join(path.dirname(importer), id);
          // validate(rid);
          return rid;
        }

        const pwd = process.cwd();

        if (id.startsWith(pwd)) {
          return id;
        }
        if (id.startsWith("/")) {
          const rid = path.join(process.cwd(), id);
          // validate(rid);
          return rid;
        }
      }
      return;
    },
    load(id) {
      if (
        id.match(/\.mdx?@/) &&
        (id.endsWith(".ts") || id.endsWith(".tsx"))
      ) {
        const [originalPath, localId] = id.split("@");
        const localIdx = Number(localId.split(".")[0]);
        if (!blockMap.has(originalPath)) return;
        const block = blockMap.get(originalPath)!.find((block, idx) => {
          return (block.fileName === localId) || (localIdx === idx);
        });
        return block?.content;
      }
      return undefined;
    },
    transform(code, id) {
      if (id.endsWith(".mdx") || id.endsWith(".md")) {
        const blocks = extractCodeBlocks(code);
        blockMap.set(id, blocks);
        const selfName = path.basename(id);

        return blocks
          .map((block) => {
            const vname = getVirtualFileName(block);
            return `import "./${selfName}@${vname}"`;
          })
          .join("\n");
      }
      return undefined;
    },
  } as Plugin
}

