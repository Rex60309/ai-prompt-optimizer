// Interpret only explicit HTML line-break nodes; code samples and other HTML stay untouched.
interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
}
export default function remarkLineBreaks() {
  return (tree: MarkdownNode) => {
    function visit(node: MarkdownNode) {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === 'html' && /^<br\s*\/?\s*>$/i.test(child.value || ''))
          return { type: 'break' };
        visit(child);
        return child;
      });
    }
    visit(tree);
  };
}
