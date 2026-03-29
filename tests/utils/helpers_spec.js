import { expect } from 'chai';
import {
  es6DynamicTemplate,
  variantToFilename,
  capitalize,
  matchesSearch,
  nodeHasMatches
} from '../../sources/utils/helpers.js';

describe('utils/helpers.js', () => {
  describe('es6DynamicTemplate', () => {
    it('should replace variables in the template string with values from the object', () => {
      const template = 'Hello ${name}, welcome to ${place}!';
      const variables = { name: 'John', place: 'Earth' };
      const result = es6DynamicTemplate(template, variables);
      expect(result).to.equal('Hello John, welcome to Earth!');
    });

    it('should return the original string if no variables are found', () => {
      const template = 'Hello World!';
      const variables = { name: 'John' };
      const result = es6DynamicTemplate(template, variables);
      expect(result).to.equal('Hello World!');
    });

    it('should not replace variables that are not in the object', () => {
      const template = 'Hello ${name}, welcome to ${place}!';
      const variables = { name: 'John' };
      const result = es6DynamicTemplate(template, variables);
      expect(result).to.equal('Hello John, welcome to ${place}!');
    });
  });

  describe('variantToFilename', () => {
    it('should replace spaces with underscores', () => {
      const variant = 'light brown';
      const result = variantToFilename(variant);
      expect(result).to.equal('light_brown');
    });

    it('should return the same string if there are no spaces', () => {
      const variant = 'dark_blue';
      const result = variantToFilename(variant);
      expect(result).to.equal('dark_blue');
    });
  });

  describe('capitalize', () => {
    it('should capitalize the first letter of the string', () => {
      const str = 'hello';
      const result = capitalize(str);
      expect(result).to.equal('Hello');
    });

    it('should return the same string if the first letter is already capitalized', () => {
      const str = 'Hello';
      const result = capitalize(str);
      expect(result).to.equal('Hello');
    });

    it('should handle empty strings', () => {
      const str = '';
      const result = capitalize(str);
      expect(result).to.equal('');
    });
  });

  describe('matchesSearch', () => {
    it('should return true if the query is empty or less than 2 characters', () => {
      expect(matchesSearch('hello', '')).to.be.true;
      expect(matchesSearch('hello', 'a')).to.be.true;
    });

    it('should return true if the text contains the query (case insensitive)', () => {
      expect(matchesSearch('hello world', 'world')).to.be.true;
      expect(matchesSearch('hello world', 'WORLD')).to.be.true;
    });

    it('should return false if the text does not contain the query', () => {
      expect(matchesSearch('hello world', 'planet')).to.be.false;
    });
  });

  describe('nodeHasMatches', () => {
    before(() => {
      window.itemMetadata = {
        1: { name: 'Sword' },
        2: { name: 'Shield' },
      };
    });

    it('should return true if the query is empty or less than 2 characters', () => {
      const node = { items: [1], children: {} };
      expect(nodeHasMatches(node, '')).to.be.true;
      expect(nodeHasMatches(node, 'a')).to.be.true;
    });

    it('should return true if any item in the node matches the query', () => {
      const node = { items: [1], children: {} };
      expect(nodeHasMatches(node, 'sword')).to.be.true;
    });

    it('should return true if any child node has matches', () => {
      const node = {
        items: [],
        children: {
          child1: { items: [2], children: {} },
        },
      };
      expect(nodeHasMatches(node, 'shield')).to.be.true;
    });

    it('should return false if no items or children match the query', () => {
      const node = {
        items: [],
        children: {
          child1: { items: [], children: {} },
        },
      };
      expect(nodeHasMatches(node, 'axe')).to.be.false;
    });
  });
});