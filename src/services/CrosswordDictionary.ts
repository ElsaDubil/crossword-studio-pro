export class CrosswordDictionary {
    private cache = new Map<string, string>();
    private fallbackWords: Record<string, string>;
  
    constructor() {
      this.fallbackWords = {
        'ERA': 'Historic period', 'ORE': 'Mine find', 'ALE': 'Pub drink', 'ICE': 'Frozen water',
        'OWE': 'Be in debt', 'AWE': 'Wonder', 'ELF': 'Mythical being', 'OAK': 'Strong tree',
        'ASH': 'Fire residue', 'ANT': 'Busy insect', 'ART': 'Creative work', 'ACE': 'Top card',
        'AREA': 'Region', 'ECHO': 'Sound reflection', 'EPIC': 'Grand tale', 'EVEN': 'Level',
        'ABLE': 'Capable', 'BEAR': 'Large mammal', 'BEAT': 'Rhythm', 'BELL': 'Chime maker',
        'BIRD': 'Flying animal', 'BLUE': 'Sky color', 'BOAT': 'Water craft', 'BONE': 'Skeleton part',
        'BOOK': 'Reading material', 'CAFE': 'Coffee shop', 'CAKE': 'Sweet dessert', 'CALL': 'Phone',
        'CALM': 'Peaceful', 'CAMP': 'Outdoor site', 'CARE': 'Concern', 'CAVE': 'Underground space',
        'CHEF': 'Cook', 'CITY': 'Urban area', 'CODE': 'Secret language', 'COIN': 'Money piece',
        'COLD': 'Low temp', 'COPY': 'Duplicate', 'CUBE': 'Six-sided shape', 'CUTE': 'Adorable',
        'DARK': 'No light', 'DATA': 'Information', 'DATE': 'Calendar day', 'DAWN': 'Morning start',
        'DEAL': 'Agreement', 'DEEP': 'Far down', 'DEER': 'Forest animal', 'DESK': 'Work surface',
        'DIET': 'Food plan', 'DISH': 'Food plate', 'DOOR': 'Entry way', 'DROP': 'Fall down',
        'DUCK': 'Water bird', 'EACH': 'Every one', 'FACE': 'Front of head', 'FACT': 'Truth',
        'FAIL': 'Not succeed', 'FAIR': 'Just', 'FALL': 'Autumn', 'FARM': 'Crop land',
        'FAST': 'Quick', 'FEAR': 'Anxiety', 'FEEL': 'Touch', 'FILE': 'Document',
        'FILM': 'Movie', 'FIND': 'Locate', 'FIRE': 'Flame', 'FISH': 'Water animal',
        'FIVE': 'Number 5', 'FLAG': 'Country symbol', 'FLAT': 'Level surface', 'FLOW': 'Move smoothly',
        'FOOD': 'Nourishment', 'FOOT': 'Body part', 'FORM': 'Shape', 'FOUR': 'Number 4',
        'FREE': 'No cost', 'FUEL': 'Energy source', 'FULL': 'Complete', 'GAME': 'Play activity',
        'GATE': 'Entry barrier', 'GEAR': 'Equipment', 'GIFT': 'Present', 'GIRL': 'Young female',
        'GIVE': 'Provide', 'GLAD': 'Happy', 'GOAL': 'Target', 'GOLD': 'Precious metal',
        'GOLF': 'Club sport', 'GOOD': 'Positive', 'GRAY': 'Neutral color', 'GROW': 'Get bigger',
        'HAIR': 'Head covering', 'HALF': '50 percent', 'HALL': 'Corridor', 'HAND': 'Body appendage',
        'HARD': 'Solid', 'HEAD': 'Top body part', 'HEAR': 'Use ears', 'HEAT': 'Warmth',
        'HELP': 'Assist', 'HERE': 'This place', 'HERO': 'Brave person', 'HIDE': 'Conceal',
        'HIGH': 'Elevated', 'HILL': 'Small mountain', 'HINT': 'Clue', 'HOLD': 'Grasp',
        'HOLE': 'Opening', 'HOME': 'Residence', 'HOPE': 'Optimism', 'HOST': 'Party giver',
        'HOUR': 'Time unit', 'HUGE': 'Very big', 'HUNT': 'Search', 'HURT': 'Cause pain',
        'IDEA': 'Thought', 'IRON': 'Metal', 'ITEM': 'Thing', 'JAZZ': 'Music style',
        'JOIN': 'Connect', 'JOKE': 'Funny story', 'JUMP': 'Leap', 'JUNE': 'Summer month',
        'JUST': 'Fair', 'KEEP': 'Retain', 'KIND': 'Gentle', 'KING': 'Monarch',
        'KNEE': 'Leg joint', 'KNOW': 'Understand', 'LACK': 'Missing', 'LAKE': 'Water body',
        'LAMP': 'Light source', 'LAND': 'Ground', 'LAST': 'Final', 'LATE': 'After time',
        'LAWN': 'Grass area', 'LEAD': 'Guide', 'LEAF': 'Tree part', 'LEFT': 'Not right',
        'LESS': 'Smaller amount', 'LIFE': 'Living state', 'LIFT': 'Raise up', 'LIKE': 'Similar',
        'LINE': 'Straight mark', 'LION': 'Big cat', 'LIST': 'Items in order', 'LIVE': 'Be alive',
        'LOCK': 'Secure device', 'LONG': 'Extended', 'LOOK': 'See', 'LOSE': 'Misplace',
        'LOUD': 'High volume', 'LOVE': 'Deep affection', 'LUCK': 'Fortune', 'MADE': 'Created',
        'MAIL': 'Postal system', 'MAIN': 'Primary', 'MAKE': 'Create', 'MALE': 'Masculine',
        'MANY': 'Numerous', 'MARK': 'Sign', 'MEAL': 'Food serving', 'MEAN': 'Average',
        'MEAT': 'Animal protein', 'MEET': 'Encounter', 'MENU': 'Food list', 'MILE': 'Distance unit',
        'MILK': 'Dairy drink', 'MIND': 'Thought center', 'MINE': 'Belongs to me', 'MODE': 'Method',
        'MOON': 'Night light', 'MORE': 'Additional', 'MOST': 'Greatest amount', 'MOVE': 'Change position',
        'MUCH': 'Large quantity', 'NAME': 'Identity', 'NEAR': 'Close by', 'NECK': 'Head connector',
        'NEED': 'Require', 'NEWS': 'Current events', 'NEXT': 'Following', 'NICE': 'Pleasant',
        'NINE': 'Number 9', 'NONE': 'Not any', 'NOON': 'Midday', 'NOSE': 'Smell organ',
        'NOTE': 'Written message', 'ONCE': 'One time', 'ONLY': 'Solely', 'OPEN': 'Not closed',
        'OVER': 'Above', 'PACK': 'Bundle', 'PAGE': 'Paper sheet', 'PAIN': 'Hurt feeling',
        'PAIR': 'Two together', 'PARK': 'Green space', 'PART': 'Portion', 'PASS': 'Go by',
        'PAST': 'Previous time', 'PATH': 'Walking route', 'PICK': 'Choose', 'PINK': 'Light red',
        'PLAN': 'Strategy', 'PLAY': 'Have fun', 'PLUS': 'Addition', 'POEM': 'Verse',
        'POOL': 'Water container', 'POOR': 'Not rich', 'POST': 'Mail', 'PULL': 'Draw toward',
        'PURE': 'Clean', 'PUSH': 'Apply force', 'QUIT': 'Stop', 'RACE': 'Competition',
        'RAIN': 'Water drops', 'RANK': 'Position', 'RARE': 'Uncommon', 'RATE': 'Speed',
        'READ': 'Interpret text', 'REAL': 'Actual', 'RELY': 'Depend on', 'REST': 'Take break',
        'RICH': 'Wealthy', 'RIDE': 'Travel on', 'RING': 'Circle', 'RISE': 'Go up',
        'ROAD': 'Travel path', 'ROCK': 'Stone', 'ROLE': 'Function', 'ROOM': 'Interior space',
        'ROPE': 'Thick cord', 'RULE': 'Principle', 'SAFE': 'Protected', 'SAIL': 'Wind power',
        'SALE': 'Selling event', 'SALT': 'Seasoning', 'SAME': 'Identical', 'SAND': 'Beach material',
        'SAVE': 'Preserve', 'SEAT': 'Sitting place', 'SEED': 'Plant start', 'SEEM': 'Appear',
        'SELL': 'Exchange money', 'SEND': 'Transmit', 'SHIP': 'Water vessel', 'SHOE': 'Foot wear',
        'SHOP': 'Store', 'SHOW': 'Display', 'SHUT': 'Close', 'SICK': 'Unwell',
        'SIDE': 'Edge', 'SIGN': 'Symbol', 'SING': 'Make music', 'SIZE': 'Dimensions',
        'SKIN': 'Body cover', 'SLOW': 'Not fast', 'SNAP': 'Break quickly', 'SNOW': 'White precipitation',
        'SOAP': 'Cleaning agent', 'SOFT': 'Not hard', 'SOIL': 'Dirt', 'SOME': 'Partial',
        'SONG': 'Musical piece', 'SOON': 'Shortly', 'SOUL': 'Spirit', 'SPIN': 'Rotate',
        'SPOT': 'Small area', 'STAR': 'Celestial body', 'STAY': 'Remain', 'STEP': 'Walking unit',
        'STOP': 'Cease', 'SUIT': 'Outfit', 'SURE': 'Certain', 'SWIM': 'Water movement',
        'TAIL': 'Animal end', 'TAKE': 'Grasp', 'TALK': 'Speak', 'TALL': 'High',
        'TAPE': 'Adhesive strip', 'TEAM': 'Group', 'TELL': 'Inform', 'TEST': 'Examine',
        'TEXT': 'Written words', 'THAN': 'Compared to', 'THAT': 'Pointing word', 'THEM': 'Those people',
        'THEN': 'Next', 'THEY': 'Other people', 'THIN': 'Not thick', 'THIS': 'Here item',
        'TIME': 'Duration', 'TINY': 'Very small', 'TIRE': 'Wheel cover', 'TOLD': 'Past tell',
        'TONE': 'Sound quality', 'TOOK': 'Past take', 'TOOL': 'Implement', 'TREE': 'Woody plant',
        'TRIP': 'Journey', 'TRUE': 'Factual', 'TUNE': 'Melody', 'TURN': 'Rotate',
        'TYPE': 'Kind', 'UNIT': 'Single thing', 'USED': 'Previously owned', 'USER': 'Person who uses',
        'VARY': 'Change', 'VERY': 'Extremely', 'VIEW': 'See', 'WAIT': 'Stay for',
        'WAKE': 'Stop sleeping', 'WALK': 'Move on foot', 'WALL': 'Vertical barrier', 'WANT': 'Desire',
        'WARM': 'Heated', 'WARN': 'Alert', 'WASH': 'Clean with water', 'WAVE': 'Water motion',
        'WEAR': 'Have on body', 'WEEK': 'Seven days', 'WELL': 'Good condition', 'WENT': 'Past go',
        'WERE': 'Past be', 'WHAT': 'Which thing', 'WHEN': 'At what time', 'WIFE': 'Married woman',
        'WILD': 'Untamed', 'WILL': 'Future tense', 'WIND': 'Moving air', 'WINE': 'Grape drink',
        'WING': 'Flight appendage', 'WIRE': 'Metal strand', 'WISE': 'Smart', 'WISH': 'Hope for',
        'WITH': 'Accompanied by', 'WOLF': 'Wild canine', 'WOOD': 'Tree material', 'WORD': 'Language unit',
        'WORK': 'Labor', 'YEAR': 'Time period', 'ZERO': 'Nothing', 'ZONE': 'Area'
      };
    }
  
    async getWords(options: { length?: number } = {}): Promise<string[]> {
      const { length } = options;
      const allWords = Object.keys(this.fallbackWords);
      return length ? allWords.filter(w => w.length === length) : allWords;
    }
  
    async getClue(word: string): Promise<string> {
      if (this.cache.has(word)) return this.cache.get(word)!;
      
      if (this.fallbackWords[word]) {
        this.cache.set(word, this.fallbackWords[word]);
        return this.fallbackWords[word];
      }
      
      try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
        if (response.ok) {
          const data = await response.json();
          const definition = data[0]?.meanings[0]?.definitions[0]?.definition;
          const clue = definition ? this.simplifyClue(definition) : `Definition of ${word}`;
          this.cache.set(word, clue);
          return clue;
        }
      } catch (error) {
        console.log('Dictionary API unavailable');
      }
      
      const fallback = `Clue for ${word}`;
      this.cache.set(word, fallback);
      return fallback;
    }
  
    private simplifyClue(definition: string): string {
      return definition
        .replace(/^(a|an|the)\s+/i, '')
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s*;.*$/, '')
        .replace(/\s*,.*$/, '')
        .slice(0, 50)
        .trim();
    }
  }