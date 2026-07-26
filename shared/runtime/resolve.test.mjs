import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseYamlLite } from './load-manifest.mjs';
import { resolvePackageDependency, resolveSkillDependency } from './resolve.mjs';

describe('resolveSkillDependency', () => {
  it('maps workspace to tyohnn/skills catalog', () => {
    const r = resolveSkillDependency({ name: 'img2threejs', source: 'workspace' });
    assert.equal(r.catalog, 'tyohnn/skills');
    assert.equal(r.resolvedCommand, 'npx skills add tyohnn/skills --skill img2threejs -y');
  });

  it('maps github sources', () => {
    const r = resolveSkillDependency({
      name: 'oh-my-doc',
      source: 'github:ssota-labs/oh-my-docs',
    });
    assert.equal(r.resolvedCommand, 'npx skills add ssota-labs/oh-my-docs --skill oh-my-doc -y');
  });
});

describe('resolvePackageDependency', () => {
  it('keeps github package specs', () => {
    const r = resolvePackageDependency({
      name: 'chartcn',
      source: 'github:tyohnn/chartcn',
    });
    assert.equal(r.spec, 'github:tyohnn/chartcn');
  });
});

describe('parseYamlLite', () => {
  it('parses skill.yaml shape', () => {
    const doc = parseYamlLite(`
name: demo
version: 0.1.0
kind: workflow
domains:
  - education
description: >
  A folded
  description.
dependencies:
  skills:
    - name: img2threejs
      source: workspace
  packages: []
`);
    assert.equal(doc.name, 'demo');
    assert.equal(doc.description, 'A folded description.');
    assert.equal(doc.dependencies.skills[0].source, 'workspace');
    assert.deepEqual(doc.dependencies.packages, []);
  });
});
