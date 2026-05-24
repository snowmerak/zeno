/**
 * @zeno/http - PathTrie (Correctness First)
 *
 * Reliable path trie with support for:
 * - Static segments (with basic compression on consecutive static parts)
 * - Named parameters (:id)
 * - Wildcards (* and :name*)
 *
 * Priority: static > param > wildcard
 *
 * We are deliberately prioritizing correctness and clear behavior over
 * maximum radix compression in this phase. Compression can be improved later.
 */

export interface TrieMatch<T = unknown> {
  params: Record<string, string>;
  data: T;
  pattern: string;
}

interface TrieNode<T> {
  children: Map<string, TrieNode<T>>;
  paramChild?: TrieNode<T>;
  paramName?: string;
  wildcardChild?: TrieNode<T>;
  wildcardName?: string;

  data: T | null;
  pattern: string | null;
}

export class PathTrie<T = unknown> {
  private root: TrieNode<T> = this.createNode();

  private createNode(): TrieNode<T> {
    return { children: new Map(), data: null, pattern: null };
  }

  insert(path: string, data: T): void {
    const segments = this.split(path);
    let node = this.root;

    for (const seg of segments) {
      if (seg.startsWith(":")) {
        const isWild = seg.endsWith("*");
        const name = isWild ? seg.slice(1, -1) : seg.slice(1);

        if (isWild) {
          if (!node.wildcardChild) node.wildcardChild = this.createNode();
          node.wildcardName = name || "wildcard";
          node = node.wildcardChild;
        } else {
          if (!node.paramChild) node.paramChild = this.createNode();
          node.paramName = name || "param";
          node = node.paramChild;
        }
        continue;
      }

      if (seg === "*") {
        if (!node.wildcardChild) node.wildcardChild = this.createNode();
        node.wildcardName = "wildcard";
        node = node.wildcardChild;
        continue;
      }

      // Static segment
      if (!node.children.has(seg)) {
        node.children.set(seg, this.createNode());
      }
      node = node.children.get(seg)!;
    }

    node.data = data;
    node.pattern = path;
  }

  find(path: string): TrieMatch<T> | null {
    const segments = this.split(path);
    const params: Record<string, string> = {};
    let node = this.root;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      // 1. Static (highest priority)
      if (node.children.has(seg)) {
        node = node.children.get(seg)!;
        continue;
      }

      // 2. Param (only consume one segment)
      if (node.paramChild) {
        params[node.paramName!] = seg;
        node = node.paramChild;

        // If this was the last segment, check if we have data here
        if (i === segments.length - 1) {
          if (node.data !== null) {
            return { params, data: node.data, pattern: node.pattern! };
          }
          // Otherwise fall through to see if wildcard exists on this node
        }
        continue;
      }

      // 3. Wildcard (catch-all for remaining path)
      if (node.wildcardChild) {
        const remaining = segments.slice(i).join("/");
        params[node.wildcardName!] = remaining;
        return node.wildcardChild.data !== null
          ? { params, data: node.wildcardChild.data, pattern: node.wildcardChild.pattern! }
          : null;
      }

      return null;
    }

    if (node.data !== null) {
      return { params, data: node.data, pattern: node.pattern! };
    }

    // Trailing wildcard registered at the end
    if (node.wildcardChild && node.wildcardChild.data !== null) {
      return {
        params,
        data: node.wildcardChild.data,
        pattern: node.wildcardChild.pattern!,
      };
    }

    return null;
  }

  private split(path: string): string[] {
    let p = path.startsWith("/") ? path : "/" + path;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p.split("/").filter(Boolean);
  }
}
