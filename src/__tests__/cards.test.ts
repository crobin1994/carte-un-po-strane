import {
  blackCards,
  whiteCards,
  shuffleArray,
  getShuffledBlackCards,
  getShuffledWhiteCards,
} from '../data/cards';

describe('Card Data', () => {
  describe('Black Cards', () => {
    it('should have at least 50 black cards', () => {
      expect(blackCards.length).toBeGreaterThanOrEqual(50);
    });

    it('should have unique IDs', () => {
      const ids = blackCards.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should all have text', () => {
      blackCards.forEach(card => {
        expect(card.text).toBeDefined();
        expect(card.text.length).toBeGreaterThan(0);
      });
    });

    it('should all have valid pick count', () => {
      blackCards.forEach(card => {
        expect(card.pick).toBeGreaterThanOrEqual(1);
        expect(card.pick).toBeLessThanOrEqual(3);
      });
    });

    it('should have some cards with pick > 1', () => {
      const multiPickCards = blackCards.filter(c => c.pick > 1);
      expect(multiPickCards.length).toBeGreaterThan(0);
    });
  });

  describe('White Cards', () => {
    it('should have at least 200 white cards', () => {
      expect(whiteCards.length).toBeGreaterThanOrEqual(200);
    });

    it('should have unique IDs', () => {
      const ids = whiteCards.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should all have text', () => {
      whiteCards.forEach(card => {
        expect(card.text).toBeDefined();
        expect(card.text.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Dario Moccia Theme', () => {
    it('should contain "sbusto" reference', () => {
      const allText = [...blackCards, ...whiteCards].map(c => c.text.toLowerCase()).join(' ');
      expect(allText).toContain('sbusto');
    });

    it('should contain "peffo" reference', () => {
      const allText = [...blackCards, ...whiteCards].map(c => c.text.toLowerCase()).join(' ');
      expect(allText).toContain('peffo');
    });

    it('should contain "mio padre" reference', () => {
      const allText = [...blackCards, ...whiteCards].map(c => c.text.toLowerCase()).join(' ');
      expect(allText).toContain('mio padre');
    });

    it('should contain anime references', () => {
      const allText = [...blackCards, ...whiteCards].map(c => c.text.toLowerCase()).join(' ');
      const hasAnimeRef =
        allText.includes('anime') ||
        allText.includes('manga') ||
        allText.includes('one piece') ||
        allText.includes('rufy') ||
        allText.includes('goku');
      expect(hasAnimeRef).toBe(true);
    });

    it('should contain Twitch references', () => {
      const allText = [...blackCards, ...whiteCards].map(c => c.text.toLowerCase()).join(' ');
      const hasTwitchRef =
        allText.includes('twitch') ||
        allText.includes('stream') ||
        allText.includes('sub') ||
        allText.includes('raid') ||
        allText.includes('chat');
      expect(hasTwitchRef).toBe(true);
    });
  });

  describe('Shuffle Function', () => {
    it('should return array of same length', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);
      expect(shuffled.length).toBe(original.length);
    });

    it('should contain same elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);
      expect(shuffled.sort()).toEqual(original.sort());
    });

    it('should not modify original array', () => {
      const original = [1, 2, 3, 4, 5];
      const originalCopy = [...original];
      shuffleArray(original);
      expect(original).toEqual(originalCopy);
    });

    it('should eventually produce different order', () => {
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      let foundDifferent = false;

      // Try multiple times (shuffling is random)
      for (let i = 0; i < 10; i++) {
        const shuffled = shuffleArray(original);
        if (JSON.stringify(shuffled) !== JSON.stringify(original)) {
          foundDifferent = true;
          break;
        }
      }

      expect(foundDifferent).toBe(true);
    });
  });

  describe('Get Shuffled Cards', () => {
    it('should return all black cards shuffled', () => {
      const shuffled = getShuffledBlackCards();
      expect(shuffled.length).toBe(blackCards.length);
    });

    it('should return all white cards shuffled', () => {
      const shuffled = getShuffledWhiteCards();
      expect(shuffled.length).toBe(whiteCards.length);
    });
  });
});
