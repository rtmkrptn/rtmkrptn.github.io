import { visit } from "unist-util-visit";

/**
 * Promote a formula that stands alone in its own paragraph to display math.
 *
 * remark-math only treats `$$` as a block when the fences sit on their own
 * lines. Written on one line — `$$x = y$$` — it parses as *inline* math, so it
 * renders cramped and never receives the `.katex-display` wrapper the prose
 * styles hang the boxed treatment off.
 *
 * That form is exactly what Obsidian produces and renders as display math, so
 * without this, notes written in the vault look correct in Obsidian and wrong
 * on the site. Handling it here rather than rewriting each file means both
 * hand-written posts and synced notes behave the same.
 *
 * The heuristic is deliberately narrow: only a paragraph whose sole content is
 * one formula is promoted. A formula sitting inside a sentence stays inline,
 * which is what an author writing `$x$` mid-prose intends.
 */
export function remarkDisplayMath() {
  return (tree) => {
    visit(tree, "paragraph", (node, index, parent) => {
      if (!parent || index === null || index === undefined) return;

      const meaningful = node.children.filter(
        (child) => !(child.type === "text" && child.value.trim() === "")
      );
      if (meaningful.length !== 1) return;

      const only = meaningful[0];
      if (only.type !== "inlineMath") return;

      /*
        rehype-katex keys off the `math-display` class rather than the node
        type, so the container is built explicitly. A `math` literal node is
        not picked up by the mdast->hast step here, and setting hName on one
        drops its value entirely — hence a plain container with the LaTeX as a
        text child, which is exactly the shape rehype-katex reads.
      */
      parent.children[index] = {
        type: "paragraph",
        position: node.position,
        data: {
          hName: "div",
          hProperties: { className: ["math", "math-display"] },
        },
        children: [{ type: "text", value: only.value }],
      };
    });
  };
}
