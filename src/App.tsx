import React, { useState, useEffect, useCallback } from 'react';
import { Cell, PlacedWord, UserWord, WordPlacement } from './types/crossword';
import { CrosswordDictionary } from './services/CrosswordDictionary';
import './App.css';

const dictionary = new CrosswordDictionary();

const App: React.FC = () => {
  const [gridSize, setGridSize] = useState(15);
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [userWords, setUserWords] = useState<UserWord[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newClue, setNewClue] = useState('');
  const [placedWords, setPlacedWords] = useState<PlacedWord[]>([]);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [hoveredWord, setHoveredWord] = useState<PlacedWord | null>(null);
  const [symmetryMode, setSymmetryMode] = useState<'none' | 'rotational' | 'mirror'>('rotational');
  const [isPlacingBlocks, setIsPlacingBlocks] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);

  useEffect(() => {
    const newGrid = Array(gridSize).fill(null).map(() => 
      Array(gridSize).fill({ letter: '', blocked: false, number: null })
    );
    setGrid(newGrid);
    setHistory([{ grid: newGrid, placedWords: [], userWords: [] }]);
    setHistoryIndex(0);
    setPlacedWords([]);
    setUserWords([]);
  }, [gridSize]);

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
      const longWords = await dictionary.getWords({ length: 5 });
      const mediumWords = await dictionary.getWords({ length: 4 });
      const shortWords = await dictionary.getWords({ length: 3 });
      
      const allWords = [
        ...longWords.slice(0, 10),
        ...mediumWords.slice(0, 15),
        ...shortWords.slice(0, 20)
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
          const clue = await dictionary.getClue(word);
          
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
              <p className="text-sm text-gray-600">Professional crossword creation with React & TypeScript</p>
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
                    onChange={(e) => setGridSize(parseInt(e.target.value))}
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
                          isPlacingBlocks && hoveredCell && 
                          getSymmetricCells(hoveredCell[0], hoveredCell[1]).some(([r, c]) => r === rowIdx && c === colIdx)
                            ? 'symmetry-preview' : ''
                        }`}
                        onClick={() => {
                          if (isPlacingBlocks) {
                            toggleBlockedCell(rowIdx, colIdx);
                          } else {
                            setSelectedCell([rowIdx, colIdx]);
                          }
                        }}
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