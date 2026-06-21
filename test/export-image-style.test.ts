import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  EXPORT_IMAGE_PADDING,
  applyExportImageCloneLayout,
  getExportImageCaptureWidth,
} from '../src/lib/export-image-style';

class MockStyle {
  [key: string]: string | ((property: string, value: string) => void);

  setProperty(property: string, value: string) {
    this[property] = value;
  }
}

class MockElement {
  readonly style = new MockStyle();
  readonly children: MockElement[] = [];
  readonly removedClasses: string[] = [];
  readonly classList = {
    remove: (...classes: string[]) => {
      this.removedClasses.push(...classes);
    },
  };
  private readonly matches = new Map<string, MockElement[]>();

  constructor(children: MockElement[] = []) {
    this.children = children;
  }

  setQuery(selector: string, elements: MockElement[]) {
    this.matches.set(selector, elements);
  }

  querySelectorAll(selector: string) {
    return this.matches.get(selector) ?? [];
  }

  getAttribute() {
    return null;
  }
}

test('applyExportImageCloneLayout adds stable export spacing and glass fallbacks', () => {
  const blockA = new MockElement();
  const blockB = new MockElement();
  const stack = new MockElement([blockA, blockB]);
  const glass = new MockElement();
  const tabsContent = new MockElement();
  const excluded = new MockElement();
  const exportCard = new MockElement();
  const formulaCard = new MockElement();
  const tableContent = new MockElement();
  const tableWrap = new MockElement();
  const resizeHandle = new MockElement();
  const frozenCell = new MockElement();
  const pingTable = new MockElement();
  const root = new MockElement([stack]);

  root.setQuery('[data-export-stack]', [stack]);
  root.setQuery('[data-export-exclude]', [excluded]);
  root.setQuery('[data-export-card]', [exportCard]);
  root.setQuery('[data-export-block="formula"]', [formulaCard]);
  root.setQuery('.ant-table-content, .ant-table-body, .ant-table-body-inner, .ant-table', [tableContent]);
  root.setQuery('.cho-table-wrap', [tableWrap]);
  root.setQuery('.react-resizable-handle', [resizeHandle]);
  root.setQuery('.cho-frozen-rank', [frozenCell]);
  root.setQuery('.ant-table-ping-left, .ant-table-ping-right, .ant-table-ping-top, .ant-table-ping-bottom', [pingTable]);
  root.setQuery('.glass', [glass]);
  root.setQuery('.ant-tabs-content-holder', [tabsContent]);

  applyExportImageCloneLayout(root as unknown as HTMLElement, { width: 1200 });

  assert.equal(root.style.width, '1248px');
  assert.equal(root.style.padding, '24px');
  assert.equal(root.style.display, 'flex');
  assert.equal(root.style.gap, '20px');
  assert.equal(stack.style.marginTop, '0');
  assert.equal(stack.style.marginBottom, '0');

  assert.equal(stack.style.gap, '20px');
  assert.equal(blockA.style.marginTop, '0');
  assert.equal(blockA.style.marginBottom, '0');
  assert.equal(blockB.style.marginTop, '0');
  assert.equal(blockB.style.marginBottom, '0');

  assert.equal(glass.style.backdropFilter, 'none');
  assert.equal(glass.style.background, 'rgba(255, 255, 255, 0.82)');
  assert.equal(tabsContent.style.paddingTop, '14px');
  assert.equal(excluded.style.display, 'none');
  assert.equal(exportCard.style.padding, '16px 18px');
  assert.equal(exportCard.style.border, '1px solid rgba(148, 163, 184, 0.28)');
  assert.equal(formulaCard.style.padding, '18px 20px');
  assert.equal(formulaCard.style.border, '1px solid rgba(220, 38, 38, 0.22)');
  assert.equal(tableContent.style.overflowX, 'visible');
  assert.equal(tableWrap.style.overflow, 'visible');
  assert.equal(resizeHandle.style.display, 'none');
  assert.equal(frozenCell.style.position, 'static');
  assert.deepEqual(pingTable.removedClasses, [
    'ant-table-ping-left',
    'ant-table-ping-right',
    'ant-table-ping-top',
    'ant-table-ping-bottom',
  ]);
});

test('getExportImageCaptureWidth includes horizontal export padding', () => {
  assert.equal(getExportImageCaptureWidth(1200), 1200 + EXPORT_IMAGE_PADDING * 2);
});
