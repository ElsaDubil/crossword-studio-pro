import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Cell, PlacedWord, UserWord, WordPlacement, PersonalWordEntry, WordBank } from './types/crossword';
import { CrosswordDictionary } from './services/CrosswordDictionary';
import './App.css';

const dictionary = new CrosswordDictionary();

const App: React.FC = () => {
  const [gridSize, setGridSize] = useState(15);
  const [grid, setGrid] = useState<Cell[][]>(() => 
    Array(15).fill(null).map(() => 
      Array(15).fill({ letter: '', blocked: false, number: null })
    )
  );
  const [userWords, setUserWords] = useState<UserWord[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newClue, setNewClue] = useState('');
  const [placedWords, setPlacedWords] = useState<PlacedWord[]>([]);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [history, setHistory] = useState<any[]>(() => {
    const initialGrid = Array(15).fill(null).map(() => 
      Array(15).fill({ letter: '', blocked: false, number: null })
    );
    return [{ grid: initialGrid, placedWords: [], userWords: [] }];
  });
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [hoveredWord, setHoveredWord] = useState<PlacedWord | null>(null);
  const [clickedWord, setClickedWord] = useState<PlacedWord | null>(null);
  const [symmetryMode, setSymmetryMode] = useState<'none' | 'rotational' | 'mirror'>('rotational');
  
  // Grid resize confirmation state
  const [showResizeConfirm, setShowResizeConfirm] = useState(false);
  const [pendingGridSize, setPendingGridSize] = useState<number | null>(null);
  const [blockAnalysis, setBlockAnalysis] = useState<{
    totalBlocks: number;
    preservedBlocks: number;
    lostBlocks: number;
    symmetryMaintained: boolean;
    wordConflicts: number;
  } | null>(null);
  const [isPlacingBlocks, setIsPlacingBlocks] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);
  const previousGridSizeRef = useRef(gridSize);
  
  // Personal Word Bank state
  const [wordBank, setWordBank] = useState<WordBank>(() => {
    const saved = localStorage.getItem('crossword-word-bank');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        parsed.entries = parsed.entries.map((entry: any) => ({
          ...entry,
          dateAdded: new Date(entry.dateAdded),
          lastUsed: entry.lastUsed ? new Date(entry.lastUsed) : undefined
        }));
        return parsed;
      } catch (e) {
        console.error('Failed to load word bank from localStorage:', e);
      }
    }
    return { entries: [], categories: ['General', 'Theme', 'Specialty'] };
  });
  const [showWordBank, setShowWordBank] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PersonalWordEntry | null>(null);
  const [newEntryWord, setNewEntryWord] = useState('');
  const [newEntryClue, setNewEntryClue] = useState('');
  const [newEntryWeight, setNewEntryWeight] = useState(5);
  const [newEntryCategory, setNewEntryCategory] = useState('General');

  useEffect(() => {
    // Only run when grid size actually changes
    if (previousGridSizeRef.current === gridSize) {
      return;
    }

    const previousSize = previousGridSizeRef.current;
    previousGridSizeRef.current = gridSize;

    // Create new empty grid
    const newGrid = Array(gridSize).fill(null).map(() => 
      Array(gridSize).fill({ letter: '', blocked: false, number: null })
    );

    // Preserve blocked cells that fit in the new grid size
    if (grid.length > 0) {
      for (let row = 0; row < Math.min(grid.length, gridSize); row++) {
        for (let col = 0; col < Math.min(grid[0].length, gridSize); col++) {
          if (grid[row][col].blocked) {
            newGrid[row][col].blocked = true;
          }
        }
      }
    }

    // If we have existing placed words, try to preserve them
    if (placedWords.length > 0) {
      const validWords: PlacedWord[] = [];
      const wordsToReplace: PlacedWord[] = [];

      // Check which words can fit in the new grid size
      placedWords.forEach(word => {
        const endRow = word.direction === 'horizontal' ? word.row : word.row + word.word.length - 1;
        const endCol = word.direction === 'horizontal' ? word.col + word.word.length - 1 : word.col;
        
        if (endRow < gridSize && endCol < gridSize && word.row >= 0 && word.col >= 0) {
          // Word fits, keep it
          validWords.push(word);
          placeWordOnGrid(newGrid, word.word, word.row, word.col, word.direction, word.number);
        } else {
          // Word doesn't fit, needs repositioning
          wordsToReplace.push(word);
        }
      });

      // Try to reposition words that don't fit
      wordsToReplace.forEach(word => {
        const bestPlacement = findBestPlacement(word.word.toUpperCase(), newGrid, validWords);
        if (bestPlacement && 'row' in bestPlacement) {
          const repositionedWord: PlacedWord = {
            ...word,
            row: bestPlacement.row!,
            col: bestPlacement.col!,
            direction: bestPlacement.direction!,
            number: validWords.length + 1
          };
          validWords.push(repositionedWord);
          placeWordOnGrid(newGrid, word.word, bestPlacement.row!, bestPlacement.col!, bestPlacement.direction!, repositionedWord.number);
        }
      });

      // Update state with preserved/repositioned words
      setPlacedWords(validWords);
      setGrid(newGrid);
      
      // Update history
      setHistory(prev => [...prev, { grid: newGrid, placedWords: validWords, userWords }]);
      setHistoryIndex(prev => prev + 1);
    } else {
      // No words to preserve, just create empty grid
      setGrid(newGrid);
      setHistory([{ grid: newGrid, placedWords: [], userWords: [] }]);
      setHistoryIndex(0);
    }
  }, [gridSize]);

  // Save word bank to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('crossword-word-bank', JSON.stringify(wordBank));
  }, [wordBank]);

  const saveToHistory = useCallback((newGrid: Cell[][], newPlacedWords: PlacedWord[], newUserWords: UserWord[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      grid: newGrid.map(row => row.map(cell => ({...cell}))),
      placedWords: [...newPlacedWords],
      userWords: [...newUserWords]
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setGrid(prevState.grid);
      setPlacedWords(prevState.placedWords);
      setUserWords(prevState.userWords);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setGrid(nextState.grid);
      setPlacedWords(nextState.placedWords);
      setUserWords(nextState.userWords);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const findBestPlacement = (word: string, currentGrid: Cell[][], currentPlaced: PlacedWord[]): WordPlacement | null => {
    const placements: (WordPlacement & { row: number; col: number; direction: 'horizontal' | 'vertical' })[] = [];
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col <= gridSize - word.length; col++) {
        const placement = evaluatePlacement(word, row, col, 'horizontal', currentGrid);
        if (placement.valid) {
          placements.push({ ...placement, row, col, direction: 'horizontal' });
        }
      }
    }

    for (let row = 0; row <= gridSize - word.length; row++) {
      for (let col = 0; col < gridSize; col++) {
        const placement = evaluatePlacement(word, row, col, 'vertical', currentGrid);
        if (placement.valid) {
          placements.push({ ...placement, row, col, direction: 'vertical' });
        }
      }
    }

    placements.sort((a, b) => {
      if (b.intersections !== a.intersections) return b.intersections - a.intersections;
      return a.centralityScore - b.centralityScore;
    });

    return placements[0] || null;
  };

  const evaluatePlacement = (word: string, row: number, col: number, direction: 'horizontal' | 'vertical', grid: Cell[][]): WordPlacement => {
    let intersections = 0;
    let valid = true;
    const center = Math.floor(gridSize / 2);
    const wordCenterRow = direction === 'horizontal' ? row : row + Math.floor(word.length / 2);
    const wordCenterCol = direction === 'horizontal' ? col + Math.floor(word.length / 2) : col;
    const centralityScore = Math.abs(wordCenterRow - center) + Math.abs(wordCenterCol - center);

    for (let i = 0; i < word.length; i++) {
      const r = direction === 'horizontal' ? row : row + i;
      const c = direction === 'horizontal' ? col + i : col;
      
      if (r >= gridSize || c >= gridSize || r < 0 || c < 0) {
        valid = false;
        break;
      }
      
      const cell = grid[r][c];
      if (cell.blocked) {
        valid = false;
        break;
      }
      
      if (cell.letter) {
        if (cell.letter === word[i].toUpperCase()) {
          intersections++;
        } else {
          valid = false;
          break;
        }
      }
    }

    return { valid, intersections, centralityScore };
  };

  const placeWordOnGrid = (grid: Cell[][], word: string, row: number, col: number, direction: 'horizontal' | 'vertical', number: number) => {
    if (!grid[row][col].number) {
      grid[row][col] = { ...grid[row][col], number };
    }
    
    for (let i = 0; i < word.length; i++) {
      const r = direction === 'horizontal' ? row : row + i;
      const c = direction === 'horizontal' ? col + i : col;
      grid[r][c] = { ...grid[r][c], letter: word[i] };
    }
  };

  const placeWord = async (word: string, clue: string) => {
    const newGrid = grid.map(row => row.map(cell => ({...cell})));
    const placed = [...placedWords];
    
    const bestPlacement = findBestPlacement(word.toUpperCase(), newGrid, placed);
    
    if (bestPlacement && 'row' in bestPlacement) {
      placeWordOnGrid(newGrid, word.toUpperCase(), bestPlacement.row!, bestPlacement.col!, bestPlacement.direction!, placed.length + 1);
      const newPlacedWord: PlacedWord = {
        word: word.toUpperCase(),
        clue,
        row: bestPlacement.row!,
        col: bestPlacement.col!,
        direction: bestPlacement.direction!,
        number: placed.length + 1
      };
      placed.push(newPlacedWord);
      
      setGrid(newGrid);
      setPlacedWords(placed);
      
      return true;
    }
    return false;
  };

  const addWord = async () => {
    if (newWord.trim() && newClue.trim()) {
      const word = newWord.trim().toUpperCase();
      if (await placeWord(word, newClue.trim())) {
        const newUserWords = [...userWords, { word, clue: newClue.trim() }];
        setUserWords(newUserWords);
        saveToHistory(grid, placedWords, newUserWords);
        setNewWord('');
        setNewClue('');
      } else {
        alert("Couldn't place word! Try a different word or clear some space.");
      }
    }
  };

  const clearGrid = () => {
    const newGrid = Array(gridSize).fill(null).map(() => 
      Array(gridSize).fill({ letter: '', blocked: false, number: null })
    );
    setGrid(newGrid);
    setPlacedWords([]);
    setUserWords([]);
    setHistory([{ grid: newGrid, placedWords: [], userWords: [] }]);
    setHistoryIndex(0);
  };

  const fillWithDictionaryWords = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    
    try {
      // Get personal words first (prioritized)
      const personalLongWords = getPersonalWordsByLength(5).slice(0, 15);
      const personalMediumWords = getPersonalWordsByLength(4).slice(0, 20);
      const personalShortWords = getPersonalWordsByLength(3).slice(0, 25);
      
      // Get dictionary words to supplement
      const dictLongWords = await dictionary.getWords({ length: 5 });
      const dictMediumWords = await dictionary.getWords({ length: 4 });
      const dictShortWords = await dictionary.getWords({ length: 3 });
      
      // Combine personal words (first) with dictionary words
      const allWords = [
        ...personalLongWords.map(entry => entry.word),
        ...dictLongWords.slice(0, Math.max(0, 10 - personalLongWords.length)),
        ...personalMediumWords.map(entry => entry.word),
        ...dictMediumWords.slice(0, Math.max(0, 15 - personalMediumWords.length)),
        ...personalShortWords.map(entry => entry.word),
        ...dictShortWords.slice(0, Math.max(0, 20 - personalShortWords.length))
      ];
      
      let currentGrid = grid.map(row => row.map(cell => ({...cell})));
      let currentPlaced = [...placedWords];
      let wordsAdded = 0;
      const maxWords = 12;
      
      for (let i = 0; i < allWords.length && wordsAdded < maxWords; i++) {
        const word = allWords[i];
        
        setGenerationProgress((i / Math.min(allWords.length, maxWords * 2)) * 100);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const bestPlacement = findBestPlacement(word, currentGrid, currentPlaced);
        
        if (bestPlacement && 'row' in bestPlacement && (bestPlacement.intersections > 0 || currentPlaced.length < 3)) {
          // Check if this is a personal word
          const personalEntry = wordBank.entries.find(entry => entry.word === word);
          let clue: string;
          
          if (personalEntry) {
            clue = personalEntry.clue;
            markWordAsUsed(word);
          } else {
            clue = await dictionary.getClue(word);
          }
          
          placeWordOnGrid(currentGrid, word, bestPlacement.row!, bestPlacement.col!, bestPlacement.direction!, currentPlaced.length + 1);
          currentPlaced.push({
            word: word,
            clue: clue,
            row: bestPlacement.row!,
            col: bestPlacement.col!,
            direction: bestPlacement.direction!,
            number: currentPlaced.length + 1
          });
          wordsAdded++;
          
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      setGrid(currentGrid);
      setPlacedWords(currentPlaced);
      saveToHistory(currentGrid, currentPlaced, userWords);
      
    } catch (error) {
      console.error('Dictionary loading failed:', error);
      alert('Could not load dictionary. Please try again.');
    } finally {
      setGenerationProgress(100);
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationProgress(0);
      }, 500);
    }
  };

  const exportToPDF = () => {
    // Simple alert for now - can implement jsPDF later
    alert('PDF export feature coming soon!');
  };

  const isPartOfWord = (row: number, col: number, word: PlacedWord | null): boolean => {
    if (!word) return false;
    if (word.direction === 'horizontal') {
      return row === word.row && col >= word.col && col < word.col + word.word.length;
    } else {
      return col === word.col && row >= word.row && row < word.row + word.word.length;
    }
  };

  const findWordsAtPosition = (row: number, col: number): PlacedWord[] => {
    return placedWords.filter(word => isPartOfWord(row, col, word));
  };

  const handleCellClick = (row: number, col: number) => {
    if (isPlacingBlocks) {
      toggleBlockedCell(row, col);
      return;
    }

    const wordsAtPosition = findWordsAtPosition(row, col);
    
    if (wordsAtPosition.length === 0) {
      // No words at this position, just select the cell
      setSelectedCell([row, col]);
      setClickedWord(null);
      return;
    }

    if (wordsAtPosition.length === 1) {
      // Only one word, highlight it
      setClickedWord(wordsAtPosition[0]);
      setSelectedCell([row, col]);
      return;
    }

    // Multiple words at this position (intersection)
    if (!clickedWord || !isPartOfWord(row, col, clickedWord)) {
      // First click or clicked word doesn't include this cell - show first word
      setClickedWord(wordsAtPosition[0]);
    } else {
      // Second click on same intersection - toggle to the other word
      const currentIndex = wordsAtPosition.findIndex(w => 
        w.row === clickedWord.row && 
        w.col === clickedWord.col && 
        w.direction === clickedWord.direction
      );
      const nextIndex = (currentIndex + 1) % wordsAtPosition.length;
      setClickedWord(wordsAtPosition[nextIndex]);
    }
    
    setSelectedCell([row, col]);
  };

  const analyzeBlockPreservation = (newSize: number) => {
    const currentBlocks: [number, number][] = [];
    let totalBlocks = 0;
    
    // Find all current blocked cells
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        if (grid[row][col].blocked) {
          currentBlocks.push([row, col]);
          totalBlocks++;
        }
      }
    }
    
    if (totalBlocks === 0) {
      return null; // No blocks to analyze
    }
    
    // Find blocks that would be preserved
    const preservedBlocks = currentBlocks.filter(([row, col]) => 
      row < newSize && col < newSize
    );
    
    // Check symmetry maintenance
    let symmetryMaintained = true;
    if (symmetryMode !== 'none') {
      for (const [row, col] of preservedBlocks) {
        const symmetricCells = getSymmetricCells(row, col);
        const allSymmetricPreserved = symmetricCells.every(([r, c]) => 
          r < newSize && c < newSize
        );
        if (!allSymmetricPreserved) {
          symmetryMaintained = false;
          break;
        }
      }
    }
    
    // Simulate word repositioning to check conflicts
    let wordConflicts = 0;
    const tempGrid = Array(newSize).fill(null).map(() => 
      Array(newSize).fill({ letter: '', blocked: false, number: null })
    );
    
    // Restore preserved blocks
    preservedBlocks.forEach(([row, col]) => {
      tempGrid[row][col].blocked = true;
    });
    
    // Check word repositioning conflicts
    placedWords.forEach(word => {
      const endRow = word.direction === 'horizontal' ? word.row : word.row + word.word.length - 1;
      const endCol = word.direction === 'horizontal' ? word.col + word.word.length - 1 : word.col;
      
      if (endRow >= newSize || endCol >= newSize) {
        // Word needs repositioning - check if placement would conflict with blocks
        const bestPlacement = findBestPlacement(word.word.toUpperCase(), tempGrid, []);
        if (!bestPlacement || !('row' in bestPlacement)) {
          wordConflicts++;
        }
      }
    });
    
    return {
      totalBlocks,
      preservedBlocks: preservedBlocks.length,
      lostBlocks: totalBlocks - preservedBlocks.length,
      symmetryMaintained,
      wordConflicts
    };
  };

  const getSymmetricCells = (row: number, col: number): [number, number][] => {
    const cells: [number, number][] = [[row, col]];
    
    if (symmetryMode === 'rotational') {
      // 180-degree rotational symmetry
      const symRow = gridSize - 1 - row;
      const symCol = gridSize - 1 - col;
      if (symRow !== row || symCol !== col) {
        cells.push([symRow, symCol]);
      }
    } else if (symmetryMode === 'mirror') {
      // Vertical mirror symmetry
      const symCol = gridSize - 1 - col;
      if (symCol !== col) {
        cells.push([row, symCol]);
      }
      // Horizontal mirror symmetry
      const symRow = gridSize - 1 - row;
      if (symRow !== row) {
        cells.push([symRow, col]);
      }
      // Diagonal symmetry (both axes)
      if (symRow !== row && symCol !== col) {
        cells.push([symRow, symCol]);
      }
    }
    
    return cells;
  };

  // Personal Word Bank Management
  const addToWordBank = () => {
    if (!newEntryWord.trim() || !newEntryClue.trim()) return;

    const newEntry: PersonalWordEntry = {
      id: Date.now().toString(),
      word: newEntryWord.trim().toUpperCase(),
      clue: newEntryClue.trim(),
      weight: newEntryWeight,
      category: newEntryCategory,
      dateAdded: new Date(),
      timesUsed: 0
    };

    setWordBank(prev => ({
      ...prev,
      entries: [...prev.entries, newEntry]
    }));

    // Clear form
    setNewEntryWord('');
    setNewEntryClue('');
    setNewEntryWeight(5);
    setNewEntryCategory('General');
  };

  const updateWordBankEntry = (updatedEntry: PersonalWordEntry) => {
    setWordBank(prev => ({
      ...prev,
      entries: prev.entries.map(entry => 
        entry.id === updatedEntry.id ? updatedEntry : entry
      )
    }));
    setEditingEntry(null);
  };

  const deleteWordBankEntry = (id: string) => {
    setWordBank(prev => ({
      ...prev,
      entries: prev.entries.filter(entry => entry.id !== id)
    }));
  };

  const getPersonalWordsByLength = (length: number): PersonalWordEntry[] => {
    return wordBank.entries
      .filter(entry => entry.word.length === length)
      .sort((a, b) => {
        // Sort by weight (higher first), then by usage frequency, then alphabetically
        if (b.weight !== a.weight) return b.weight - a.weight;
        if (b.timesUsed !== a.timesUsed) return b.timesUsed - a.timesUsed;
        return a.word.localeCompare(b.word);
      });
  };

  const markWordAsUsed = (word: string) => {
    setWordBank(prev => ({
      ...prev,
      entries: prev.entries.map(entry => 
        entry.word === word.toUpperCase() 
          ? { ...entry, lastUsed: new Date(), timesUsed: entry.timesUsed + 1 }
          : entry
      )
    }));
  };

  const exportWordBank = () => {
    const dataStr = JSON.stringify(wordBank, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crossword-word-bank-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResizeConfirm = (strategy: 'preserve' | 'clear' | 'cancel') => {
    if (strategy === 'cancel' || !pendingGridSize) {
      setShowResizeConfirm(false);
      setPendingGridSize(null);
      setBlockAnalysis(null);
      return;
    }
    
    if (strategy === 'clear') {
      // Clear all blocks before resizing
      const clearedGrid = grid.map(row => 
        row.map(cell => ({ ...cell, blocked: false }))
      );
      setGrid(clearedGrid);
    }
    
    // Proceed with resize
    setGridSize(pendingGridSize);
    setShowResizeConfirm(false);
    setPendingGridSize(null);
    setBlockAnalysis(null);
  };

  const importWordBank = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        // Convert date strings back to Date objects
        imported.entries = imported.entries.map((entry: any) => ({
          ...entry,
          dateAdded: new Date(entry.dateAdded),
          lastUsed: entry.lastUsed ? new Date(entry.lastUsed) : undefined
        }));
        setWordBank(imported);
        alert(`Successfully imported ${imported.entries.length} words!`);
      } catch (error) {
        alert('Failed to import word bank. Please check the file format.');
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const toggleBlockedCell = (row: number, col: number) => {
    const newGrid = grid.map(r => r.map(c => ({...c})));
    const symmetricCells = getSymmetricCells(row, col);
    
    // Check if the main cell is currently blocked
    const isCurrentlyBlocked = newGrid[row][col].blocked;
    
    // Toggle all symmetric cells
    symmetricCells.forEach(([r, c]) => {
      if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
        newGrid[r][c] = {
          ...newGrid[r][c],
          blocked: !isCurrentlyBlocked,
          letter: !isCurrentlyBlocked ? '' : newGrid[r][c].letter,
          number: !isCurrentlyBlocked ? null : newGrid[r][c].number
        };
      }
    });
    
    setGrid(newGrid);
    
    // Remove any placed words that conflict with new blocked cells
    const validPlacedWords = placedWords.filter(word => {
      for (let i = 0; i < word.word.length; i++) {
        const r = word.direction === 'horizontal' ? word.row : word.row + i;
        const c = word.direction === 'horizontal' ? word.col + i : word.col;
        if (newGrid[r][c].blocked) {
          return false;
        }
      }
      return true;
    });
    
    if (validPlacedWords.length !== placedWords.length) {
      setPlacedWords(validPlacedWords);
      // Rebuild the grid without the removed words
      const cleanGrid = Array(gridSize).fill(null).map(() => 
        Array(gridSize).fill(null).map(() => ({ letter: '', blocked: false, number: null }))
      );
      
      // Restore blocked cells
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (newGrid[r][c].blocked) {
            cleanGrid[r][c].blocked = true;
          }
        }
      }
      
      // Re-place valid words
      validPlacedWords.forEach((word, index) => {
        placeWordOnGrid(cleanGrid, word.word, word.row, word.col, word.direction, index + 1);
      });
      
      setGrid(cleanGrid);
      saveToHistory(cleanGrid, validPlacedWords, userWords);
    } else {
      saveToHistory(newGrid, placedWords, userWords);
    }
  };

  const CircularProgress: React.FC<{ progress: number }> = ({ progress }) => {
    const size = 40;
    const strokeWidth = 4;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
      <div className="relative inline-flex">
        <svg className="progress-ring" width={size} height={size}>
          <circle
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            stroke="#3b82f6"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
          {Math.round(progress)}%
        </span>
      </div>
    );
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        }
      }
    };
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <>
      {/* Animated Cloud Background */}
      <div className="cloud-background">
        <div className="cloud cloud1"></div>
        <div className="cloud cloud2"></div>
        <div className="cloud cloud3"></div>
        <div className="cloud cloud4"></div>
      </div>
      
    <div className="min-h-screen">
      {/* Header */}
      <div className="glass border-b sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Crossword Studio Pro</h1>
              <p className="text-sm text-gray-600">Elsa's magic tool!</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="btn-secondary px-3 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Undo (Ctrl+Z)"
              >
                ↶ Undo
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="btn-secondary px-3 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Redo (Ctrl+Y)"
              >
                ↷ Redo
              </button>
              <button
                onClick={() => setShowWordBank(!showWordBank)}
                className="btn-secondary px-4 py-2 rounded-lg transition-all"
              >
                📚 Word Bank ({wordBank.entries.length})
              </button>
              <button
                onClick={exportToPDF}
                disabled={placedWords.length === 0}
                className="btn-primary px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                📄 Export PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 max-w-7xl">
        <div className="grid xl:grid-cols-4 gap-6">
          {/* Left Panel - Controls */}
          <div className="xl:col-span-1 space-y-6">
            {/* Grid Settings */}
            <div className="glass rounded-2xl p-6 slide-up">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Grid Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Size: {gridSize}×{gridSize}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="21"
                    step="1"
                    value={gridSize}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value);
                      const analysis = analyzeBlockPreservation(newSize);
                      
                      if (analysis && (analysis.lostBlocks > 0 || !analysis.symmetryMaintained || analysis.wordConflicts > 0)) {
                        // Show confirmation modal
                        setPendingGridSize(newSize);
                        setBlockAnalysis(analysis);
                        setShowResizeConfirm(true);
                      } else {
                        // No blocks or no issues, resize immediately
                        setGridSize(newSize);
                      }
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={clearGrid}
                    className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={fillWithDictionaryWords}
                    disabled={isGenerating}
                    className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <CircularProgress progress={generationProgress} />
                    ) : (
                      '🤖 Auto-Fill'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Block Placement */}
            <div className="glass rounded-2xl p-6 slide-up">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Block Placement</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Symmetry Mode
                  </label>
                  <select
                    value={symmetryMode}
                    onChange={(e) => setSymmetryMode(e.target.value as 'none' | 'rotational' | 'mirror')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                  >
                    <option value="none">No Symmetry</option>
                    <option value="rotational">Rotational (180°)</option>
                    <option value="mirror">Mirror (4-way)</option>
                  </select>
                </div>
                <button
                  onClick={() => setIsPlacingBlocks(!isPlacingBlocks)}
                  className={`w-full px-4 py-3 rounded-xl transition-all font-medium ${
                    isPlacingBlocks 
                      ? 'bg-purple-600 text-white hover:bg-purple-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isPlacingBlocks ? '⬛ Block Mode ON' : '⬜ Block Mode OFF'}
                </button>
                <p className="text-xs text-gray-600">
                  {isPlacingBlocks 
                    ? 'Click grid cells to place/remove blocks with symmetry'
                    : 'Enable block mode to place dark squares'
                  }
                </p>
              </div>
            </div>

            {/* Add Word */}
            <div className="glass rounded-2xl p-6 slide-up">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Add Word</h3>
              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Enter word..."
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    maxLength={20}
                  />
                </div>
                <div>
                  <textarea
                    placeholder="Enter clue..."
                    value={newClue}
                    onChange={(e) => setNewClue(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    rows={2}
                  />
                </div>
                <button
                  onClick={addWord}
                  disabled={!newWord.trim() || !newClue.trim()}
                  className="btn-primary w-full px-4 py-3 rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium"
                >
                  ➕ Place Word
                </button>
              </div>
            </div>

          </div>

          {/* Center - Crossword Grid */}
          <div className="xl:col-span-2">
            <div className="glass rounded-2xl p-8 fade-in">
              <div className="flex justify-center">
                <div 
                  className="nyt-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                    width: '100%',
                    maxWidth: Math.min(600, 40 * gridSize) + 'px',
                    aspectRatio: '1',
                  }}
                >
                  {grid.map((row, rowIdx) =>
                    row.map((cell, colIdx) => (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        className={`nyt-cell crossword-cell cursor-pointer ${
                          cell.blocked ? 'blocked' : ''
                        } ${
                          selectedCell && selectedCell[0] === rowIdx && selectedCell[1] === colIdx ? 'highlighted' : ''
                        } ${
                          hoveredWord && isPartOfWord(rowIdx, colIdx, hoveredWord) ? 'word-highlight' : ''
                        } ${
                          clickedWord && isPartOfWord(rowIdx, colIdx, clickedWord) ? 'clicked-word-highlight' : ''
                        } ${
                          isPlacingBlocks && hoveredCell && 
                          getSymmetricCells(hoveredCell[0], hoveredCell[1]).some(([r, c]) => r === rowIdx && c === colIdx)
                            ? 'symmetry-preview' : ''
                        }`}
                        onClick={() => handleCellClick(rowIdx, colIdx)}
                        onMouseEnter={() => isPlacingBlocks && setHoveredCell([rowIdx, colIdx])}
                        onMouseLeave={() => isPlacingBlocks && setHoveredCell(null)}
                        style={{ 
                          fontSize: Math.max(8, Math.min(14, 400 / gridSize)) + 'px',
                          aspectRatio: '1'
                        }}
                      >
                        {cell.number && (
                          <span className="cell-number">
                            {cell.number}
                          </span>
                        )}
                        <span style={{ marginTop: cell.number ? '6px' : '0' }}>
                          {cell.letter || ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  {placedWords.length > 0 ? 
                    `${placedWords.length} words • ${gridSize}×${gridSize} grid • React powered` :
                    'Add words to start building your crossword'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel - Clues & Words */}
          <div className="xl:col-span-1 space-y-6">
            {/* Statistics */}
            <div className="glass rounded-2xl p-6 slide-up">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Words placed:</span>
                  <span className="font-semibold text-blue-600">{placedWords.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Grid coverage:</span>
                  <span className="font-semibold text-blue-600">
                    {placedWords.length > 0 ? Math.round((placedWords.reduce((acc, word) => acc + word.word.length, 0) / (gridSize * gridSize)) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">User words:</span>
                  <span className="font-semibold text-blue-600">{userWords.length}</span>
                </div>
              </div>
            </div>

            {/* Your Words */}
            {userWords.length > 0 && (
              <div className="glass rounded-2xl p-6 slide-up">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Your Words</h3>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {userWords.map((item, idx) => (
                    <div key={idx} className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                      <div className="font-semibold text-blue-900 text-sm">{item.word}</div>
                      <div className="text-blue-700 text-xs mt-1">{item.clue}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clues */}
            {placedWords.length > 0 && (
              <div className="glass rounded-2xl p-6 slide-up">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Clues</h3>
                <div className="space-y-6 max-h-96 overflow-y-auto">
                  {/* Across */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Across</h4>
                    <div className="space-y-2">
                      {placedWords.filter(w => w.direction === 'horizontal').map(word => (
                        <div 
                          key={`${word.number}-across`} 
                          className="text-sm p-2 rounded-lg hover:bg-gray-50 transition-all cursor-pointer"
                          onMouseEnter={() => setHoveredWord(word)}
                          onMouseLeave={() => setHoveredWord(null)}
                        >
                          <span className="font-semibold text-blue-600 mr-2">{word.number}.</span>
                          <span className="text-gray-700">{word.clue}</span>
                          <span className="text-gray-400 text-xs ml-2">({word.word.length})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Down */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Down</h4>
                    <div className="space-y-2">
                      {placedWords.filter(w => w.direction === 'vertical').map(word => (
                        <div 
                          key={`${word.number}-down`} 
                          className="text-sm p-2 rounded-lg hover:bg-gray-50 transition-all cursor-pointer"
                          onMouseEnter={() => setHoveredWord(word)}
                          onMouseLeave={() => setHoveredWord(null)}
                        >
                          <span className="font-semibold text-blue-600 mr-2">{word.number}.</span>
                          <span className="text-gray-700">{word.clue}</span>
                          <span className="text-gray-400 text-xs ml-2">({word.word.length})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Help */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 slide-up">
              <h3 className="text-lg font-semibold mb-3 text-blue-900">💡 Pro Tips</h3>
              <div className="space-y-2 text-sm text-blue-700">
                <p>• Use Ctrl+Z to undo/redo</p>
                <p>• Auto-fill uses 300+ words</p>
                <p>• Algorithm seeks intersections</p>
                <p>• Hover clues to highlight</p>
                <p>• Built with React 18 & TypeScript</p>
              </div>
            </div>
          </div>
        </div>

        {/* Grid Resize Confirmation Modal */}
        {showResizeConfirm && blockAnalysis && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="glass rounded-2xl p-6 shadow-2xl max-w-md w-full">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Grid Resize</h2>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-left">
                  <h3 className="font-semibold text-yellow-800 mb-2">Block Impact Analysis:</h3>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Total blocks: {blockAnalysis.totalBlocks}</li>
                    <li>• Will be preserved: {blockAnalysis.preservedBlocks}</li>
                    <li>• Will be lost: {blockAnalysis.lostBlocks}</li>
                    {!blockAnalysis.symmetryMaintained && <li>• ⚠️ Symmetry will be broken</li>}
                    {blockAnalysis.wordConflicts > 0 && <li>• ⚠️ {blockAnalysis.wordConflicts} word(s) may not fit</li>}
                  </ul>
                </div>
                <p className="text-gray-700 mb-6">How would you like to proceed?</p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleResizeConfirm('preserve')}
                    className="btn-primary px-4 py-3 rounded-xl font-medium"
                  >
                    Preserve What Fits & Resize
                  </button>
                  <button
                    onClick={() => handleResizeConfirm('clear')}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-xl font-medium transition-all"
                  >
                    Clear All Blocks & Resize
                  </button>
                  <button
                    onClick={() => handleResizeConfirm('cancel')}
                    className="btn-secondary px-4 py-3 rounded-xl font-medium"
                  >
                    Cancel Resize
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Word Bank Modal */}
        {showWordBank && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="glass rounded-2xl p-6 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Personal Word Bank</h2>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".json"
                    onChange={importWordBank}
                    className="hidden"
                    id="import-wordbank"
                  />
                  <label
                    htmlFor="import-wordbank"
                    className="btn-secondary px-3 py-2 rounded-lg cursor-pointer text-sm"
                  >
                    📁 Import
                  </label>
                  <button
                    onClick={exportWordBank}
                    className="btn-secondary px-3 py-2 rounded-lg text-sm"
                  >
                    💾 Export
                  </button>
                  <button 
                    onClick={() => setShowWordBank(false)}
                    className="bg-gray-200 hover:bg-red-100 text-gray-800 hover:text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-xl font-bold transition-all border border-gray-300 hover:border-red-300"
                    title="Close Word Bank"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Add New Word Form */}
              <div className="glass rounded-xl p-4 mb-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Add New Word</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <input
                  
                    placeholder="Clue..."
                    value={newEntryClue}
                    onChange={(e) => setNewEntryClue(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Weight:</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={newEntryWeight}
                      onChange={(e) => setNewEntryWeight(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-semibold text-blue-600 w-6">{newEntryWeight}</span>
                  </div>
                  <select
                    value={newEntryCategory}
                    onChange={(e) => setNewEntryCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                  >
                    {wordBank.categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    onClick={addToWordBank}
                    disabled={!newEntryWord.trim() || !newEntryClue.trim()}
                    className="btn-primary px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
                  >
                    Add Word
                  </button>
                </div>
              </div>

              {/* Word List */}
              <div className="overflow-y-auto max-h-96">
                <div className="grid gap-2">
                  {wordBank.entries.map(entry => (
                    <div key={entry.id} className="flex items-center gap-4 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-900 text-sm">{entry.word}</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{entry.category}</span>
                          <div className="flex">
                            {Array.from({length: 10}, (_, i) => (
                              <span key={i} className={`text-xs ${i < entry.weight ? 'text-yellow-500' : 'text-gray-300'}`}>★</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-gray-700 text-xs mt-1">{entry.clue}</div>
                        <div className="text-gray-500 text-xs mt-1">
                          Used {entry.timesUsed} times • Added {entry.dateAdded.toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingEntry(entry)}
                          className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteWordBankEntry(entry.id)}
                          className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {wordBank.entries.length === 0 && (
                    <div className="text-center py-8 px-4 bg-white bg-opacity-80 rounded-xl border border-gray-300 shadow-sm">
                      <p className="text-gray-800 font-medium text-lg">No words in your personal bank yet.</p>
                      <p className="text-gray-700 mt-2">Add some words using the form above to get started!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isGenerating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="glass rounded-2xl p-8 shadow-2xl">
              <div className="text-center">
                <CircularProgress progress={generationProgress} />
                <h3 className="text-lg font-semibold mt-4 mb-2">Generating crossword...</h3>
                <p className="text-gray-600">Finding optimal word placements with TypeScript</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default App;