import { visit } from "unist-util-visit";

/*
  Turns a fenced ```desmos block into an embedded, interactive calculator.

    ```desmos The integer detector
    Z(x)=\left\lfloor\left|\cos\left(\pi x\right)\right|\right\rfloor
    ```

  One LaTeX expression per line; the text after the language is an optional
  caption. A fence was chosen over an MDX component so notes stay plain
  Markdown: Obsidian shows this as an ordinary code block, and the vault never
  has to contain site-specific markup.

  The static fallback is not a placeholder image — it is the same expressions
  rendered as display math by KaTeX, which is what the reader would have seen
  before this plugin existed. If the Desmos script is blocked or fails, the
  post degrades to exactly that rather than to an empty box.
*/

const FENCES = new Set(["desmos", "desmos-graph"]);

/** A hast <div class="math math-display">, which rehype-katex renders later. */
function mathBlock(latex) {
  return {
    type: "element",
    tagName: "div",
    properties: { className: ["math", "math-display"] },
    children: [{ type: "text", value: latex }],
  };
}

export function remarkDesmos() {
  return (tree) => {
    visit(tree, "code", (node, index, parent) => {
      if (!parent || index === null || index === undefined) return;
      if (!node.lang || !FENCES.has(node.lang.toLowerCase())) return;

      const expressions = node.value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (!expressions.length) return;

      const caption = (node.meta ?? "").trim();
      const label = caption || "Interactive graph";

      const children = [
        {
          type: "element",
          tagName: "div",
          properties: { className: ["desmos-stage"] },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: { className: ["desmos-mount"] },
              children: [],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                className: ["desmos-fallback"],
                // Reachable and announced before any script runs, so the
                // formulas are never keyboard- or screen-reader-only content.
                tabindex: "0",
                role: "group",
                "aria-label": label,
              },
              children: expressions.map(mathBlock),
            },
          ],
        },
      ];

      if (caption) {
        children.push({
          type: "element",
          tagName: "figcaption",
          properties: {},
          children: [{ type: "text", value: caption }],
        });
      }

      parent.children[index] = {
        type: "paragraph",
        position: node.position,
        data: {
          hName: "figure",
          hProperties: {
            className: ["desmos"],
            "data-desmos": JSON.stringify(expressions),
          },
          hChildren: children,
        },
        children: [],
      };
    });
  };
}
