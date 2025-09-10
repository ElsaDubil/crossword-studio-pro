export interface Cell {
    letter: string;
    blocked: boolean;
    number: number | null;
  }
  
  export interface PlacedWord {
    word: string;
    clue: string;
    row: number;
    col: number;
    direction: 'horizontal' | 'vertical';
    number: number;
  }
  
  export interface UserWord {
    word: string;
    clue: string;
  }
  
  export interface CrosswordState {
    grid: Cell[][];
    placedWords: PlacedWord[];
    userWords: UserWord[];
  }
  
  export interface WordPlacement {
    valid: boolean;
    intersections: number;
    centralityScore: number;
    row?: number;
    col?: number;
    direction?: 'horizontal' | 'vertical';
  }

  export interface PersonalWordEntry {
    id: string;
    word: string;
    clue: string;
    weight: number; // 1-10, higher = more preferred for autofill
    category?: string;
    dateAdded: Date;
    lastUsed?: Date;
    timesUsed: number;
  }

  export interface WordBank {
    entries: PersonalWordEntry[];
    categories: string[];
  }