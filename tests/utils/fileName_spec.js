import { expect } from 'chai';
import { getItemFileName } from '../../sources/utils/fileName.js';

describe('getItemFileName', () => {
  before(() => {
    window.itemMetadata = {
      1: {
        layers: {
          layer_1: { zPos: 50 },
          layer_2: { zPos: 75 },
        },
      },
      2: {
        layers: {
          layer_1: { zPos: 100 },
        },
      },
    };
  });

  after(() => {
    delete window.itemMetadata;
  });

  it('should return the correct filename with zPos prefix', () => {
    const result = getItemFileName(1, 'variant1', 'body_male_light');
    expect(result).to.equal('050 body_male_light.png');
  });

  it('should handle missing metadata and return the name as is', () => {
    const result = getItemFileName(999, 'variant1', 'body_male_light');
    expect(result).to.equal('body_male_light.png');
  });

  it('should throw an error if the requested layer number is not found', () => {
    expect(() => getItemFileName(1, 'variant1', 'body_male_light', 3)).to.throw(
      'Requested layer number 3 not found for item: 1'
    );
  });

  it('should use the default layerNum if not provided', () => {
    const result = getItemFileName(2, 'variant2', 'body_female_light');
    expect(result).to.equal('100 body_female_light.png');
  });

  it('should use the altName if name is not provided', () => {
    const result = getItemFileName(1, 'variant1', null);
    expect(result).to.equal('050 1_variant1.png');
  });

  it('should pad zPos to 3 digits', () => {
    const result = getItemFileName(1, 'variant1', 'body_male_light');
    expect(result.startsWith('050')).to.be.true;
  });

  it('should sanitize the name to replace non-alphanumeric characters with underscores', () => {
    const result = getItemFileName(1, 'variant1', 'body male light');
    expect(result).to.equal('050 body_male_light.png');
  });

  it('should append .png if the name does not already end with .png', () => {
    const result = getItemFileName(1, 'variant1', 'body_male_light');
    expect(result.endsWith('.png')).to.be.true;
  });

  it('should not append .png if the name already ends with .png', () => {
    const result = getItemFileName(1, 'variant1', 'body_male_light.png');
    expect(result).to.equal('050 body_male_light.png');
  });
});