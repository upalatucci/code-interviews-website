// Monaco Editor is loaded from CDN via AMD loader; declare as ambient globals.
declare const monaco: typeof import('monaco-editor');

declare function require(deps: string[], cb: () => void): void;
declare namespace require {
  function config(opts: { paths: Record<string, string> }): void;
}

// marked is loaded from CDN
declare const marked: {
  parse(src: string, options?: Record<string, unknown>): string;
  setOptions(options: Record<string, unknown>): void;
};
