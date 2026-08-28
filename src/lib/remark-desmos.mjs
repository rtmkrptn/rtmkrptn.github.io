import { visit } from "unist-util-visit";

/*
  Turns a fenced ```desmos block into an embedded, interactive calculator.

    ```desmos The integer detector
    Z(x)=\left\lfloor\left|\cos\left(\pi x\right)\right|\right\rfloor
    ```

  One Desmos expression per line; the text after the language is an optional
  caption. A fence was chosen over an MDX component so notes stay plain
  Markdown: Obsidian shows this as an ordinary code block, and the vault never
  has to contain site-specific markup.

  What goes in the fence is DESMOS syntax, which is its own language and not
  the LaTeX of a $...$ formula. The two overlap enough to be mistaken for one
  another — and KaTeX will happily typeset most Desmos input without
  complaining — but it does not mean the same thing: `y_1~mx_1+b` is a
  regression, `a=3` is a slider, `[1,...,10]` is a list. Rendering those as
  maths produces something that looks correct and says something else.

  So the fallback shows the expressions as source, not as typeset maths. A post
  that wants a typeset formula writes one with $...$, independently; the graph
  and the formula are separate things and neither is derived from the other.
*/

const FENCES = new Set(["desmos", "desmos-graph"]);

/** The expressions verbatim, as the source they are. */
function sourceBlock(expressions) {
  return {
    type: "element",
    tagName: "pre",
    properties: { className: ["desmos-source"] },
    children: [
      {
        type: "element",
        tagName: "code",
        properties: {},
        children: [{ type: "text", value: expressions.join("\n") }],
      },
    ],
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
                // expressions are never keyboard- or screen-reader-only.
                tabindex: "0",
                role: "group",
                "aria-label": label,
              },
              children: [sourceBlock(expressions)],
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
