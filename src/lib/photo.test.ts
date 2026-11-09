import { describe, expect, it } from 'vitest';
import { fitSize } from './photo';

describe('fitSize', () => {
	it('reduz o maior lado para 1600 mantendo proporcao', () => {
		expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
		expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
	});
	it('nao amplia imagens menores', () => {
		expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
	});
});
