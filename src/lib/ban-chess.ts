// Re-export ban-chess.ts with proper typing
// This works around ESM/CommonJS issues in Next.js

let BanChessClass: any;

// Dynamic import to handle ESM modules
if (typeof window === 'undefined') {
  // Server-side: use dynamic import
  import('ban-chess.ts').then(module => {
    BanChessClass = module.BanChess;
  });
} else {
  // Client-side: use dynamic import
  import('ban-chess.ts').then(module => {
    BanChessClass = module.BanChess;
  });
}

// For immediate use, we'll use a Proxy that waits for the module to load
export const BanChess = new Proxy({} as any, {
  construct(target, args) {
    if (!BanChessClass) {
      throw new Error('BanChess not loaded yet');
    }
    return new BanChessClass(...args);
  },
  get(target, prop) {
    if (!BanChessClass) {
      throw new Error('BanChess not loaded yet');
    }
    return BanChessClass[prop];
  }
});