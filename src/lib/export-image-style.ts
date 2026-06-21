export const EXPORT_IMAGE_PADDING = 24;

const EXPORT_IMAGE_GAP = 20;
const EXPORT_IMAGE_COMPACT_GAP = 14;
const EXPORT_IMAGE_BACKGROUND = '#f8fafc';

interface ExportImageCloneLayoutOptions {
  width?: number;
  padding?: number;
  gap?: number;
  backgroundColor?: string;
}

function px(value: number): string {
  return `${value}px`;
}

export function getExportImageCaptureWidth(contentWidth: number, padding = EXPORT_IMAGE_PADDING): number {
  return Math.ceil(contentWidth) + padding * 2;
}

function applyStackLayout(stack: HTMLElement, gap: number): void {
  stack.style.display = 'flex';
  stack.style.flexDirection = 'column';
  stack.style.gap = px(gap);

  Array.from(stack.children).forEach((child) => {
    const element = child as HTMLElement;
    element.style.marginTop = '0';
    element.style.marginBottom = '0';
  });
}

function applyExportCardStyle(card: HTMLElement): void {
  card.style.boxSizing = 'border-box';
  card.style.padding = '16px 18px';
  card.style.borderRadius = '14px';
  card.style.background = 'rgba(255, 255, 255, 0.9)';
  card.style.border = '1px solid rgba(148, 163, 184, 0.28)';
  card.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.06)';
  card.style.overflow = 'visible';
}

function applyFormulaCardStyle(card: HTMLElement): void {
  card.style.boxSizing = 'border-box';
  card.style.padding = '18px 20px';
  card.style.borderRadius = '14px';
  card.style.background = 'rgba(255, 247, 247, 0.94)';
  card.style.border = '1px solid rgba(220, 38, 38, 0.22)';
  card.style.boxShadow = '0 10px 30px rgba(127, 29, 29, 0.06)';
}

function applyTableExportFallbacks(root: HTMLElement): void {
  root.querySelectorAll('.ant-table-content, .ant-table-body, .ant-table-body-inner, .ant-table').forEach((tablePart) => {
    const element = tablePart as HTMLElement;
    element.style.overflow = 'visible';
    element.style.overflowX = 'visible';
    element.style.overflowY = 'visible';
  });

  root.querySelectorAll('.cho-table-wrap').forEach((tableWrap) => {
    (tableWrap as HTMLElement).style.overflow = 'visible';
  });

  root.querySelectorAll('.react-resizable-handle').forEach((handle) => {
    (handle as HTMLElement).style.display = 'none';
  });

  root.querySelectorAll('.cho-frozen-rank').forEach((cell) => {
    const element = cell as HTMLElement;
    element.style.position = 'static';
    element.style.left = 'auto';
    element.style.zIndex = 'auto';
  });

  root.querySelectorAll('.ant-table-cell-fix-left, .ant-table-cell-fix-right').forEach((cell) => {
    (cell as HTMLElement).style.boxShadow = 'none';
  });

  root.querySelectorAll('.ant-table-ping-left, .ant-table-ping-right, .ant-table-ping-top, .ant-table-ping-bottom').forEach((table) => {
    table.classList.remove(
      'ant-table-ping-left',
      'ant-table-ping-right',
      'ant-table-ping-top',
      'ant-table-ping-bottom',
    );
  });
}

function injectExportTableStyle(root: HTMLElement): void {
  const doc = root.ownerDocument;
  if (!doc?.head) return;
  if (doc.getElementById('export-image-table-style')) return;

  const style = doc.createElement('style');
  style.id = 'export-image-table-style';
  style.textContent = `
    #${root.id || 'cho-dashboard-export'} .ant-table-container::before,
    #${root.id || 'cho-dashboard-export'} .ant-table-container::after,
    #${root.id || 'cho-dashboard-export'} .ant-table-cell-fix-left::before,
    #${root.id || 'cho-dashboard-export'} .ant-table-cell-fix-left::after,
    #${root.id || 'cho-dashboard-export'} .ant-table-cell-fix-right::before,
    #${root.id || 'cho-dashboard-export'} .ant-table-cell-fix-right::after {
      display: none !important;
      box-shadow: none !important;
      opacity: 0 !important;
      content: none !important;
    }
  `;
  doc.head.appendChild(style);
}

export function applyExportImageCloneLayout(
  root: HTMLElement,
  options: ExportImageCloneLayoutOptions = {},
): void {
  const padding = options.padding ?? EXPORT_IMAGE_PADDING;
  const gap = options.gap ?? EXPORT_IMAGE_GAP;

  root.style.boxSizing = 'border-box';
  root.style.background = options.backgroundColor ?? EXPORT_IMAGE_BACKGROUND;
  root.style.padding = px(padding);
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.gap = px(gap);
  root.style.overflow = 'visible';

  if (options.width != null) {
    root.style.width = px(getExportImageCaptureWidth(options.width, padding));
    root.style.maxWidth = 'none';
  }

  applyStackLayout(root, gap);

  root.querySelectorAll('[data-export-exclude]').forEach((excluded) => {
    (excluded as HTMLElement).style.display = 'none';
  });

  root.querySelectorAll('[data-export-stack]').forEach((stack) => {
    const element = stack as HTMLElement;
    const stackGap = element.getAttribute('data-export-stack') === 'compact' ? EXPORT_IMAGE_COMPACT_GAP : gap;
    applyStackLayout(element, stackGap);
  });

  root.querySelectorAll('[data-export-card]').forEach((card) => {
    applyExportCardStyle(card as HTMLElement);
  });

  root.querySelectorAll('[data-export-block="formula"]').forEach((card) => {
    applyFormulaCardStyle(card as HTMLElement);
  });

  root.querySelectorAll('.ant-tabs-content-holder').forEach((content) => {
    const element = content as HTMLElement;
    element.style.paddingTop = '14px';
  });

  root.querySelectorAll('.glass').forEach((card) => {
    const element = card as HTMLElement;
    element.style.backdropFilter = 'none';
    element.style.setProperty('-webkit-backdrop-filter', 'none');
    element.style.background = 'rgba(255, 255, 255, 0.82)';
    element.style.borderColor = 'rgba(255, 255, 255, 0.86)';
    element.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.07)';
  });

  applyTableExportFallbacks(root);
  injectExportTableStyle(root);
}
