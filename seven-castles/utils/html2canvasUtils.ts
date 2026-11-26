import html2canvas from "html2canvas";

const colorCache = new Map<string, string>();

export const convertColorToRgba = (colorStr: string): string => {
  if (!colorStr) return colorStr;
  if (!colorStr.includes('oklch') && !colorStr.includes('oklab') && !colorStr.includes('lab(') && !colorStr.includes('lch(')) {
    return colorStr;
  }

  const colorRegex = /(oklch|oklab|lab|lch)\((?:[^)(]+|\([^)(]*\))*\)/g;

  return colorStr.replace(colorRegex, (match) => {
    if (colorCache.has(match)) {
      return colorCache.get(match)!;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return match;
      ctx.fillStyle = match;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      const rgba = `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
      colorCache.set(match, rgba);
      return rgba;
    } catch {
      return match;
    }
  });
};

const colorProperties = [
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'text-decoration-color',
  'outline-color',
  'box-shadow',
  'text-shadow',
  'fill',
  'stroke'
];

export const patchColorsForHtml2Canvas = (container: HTMLElement) => {
  const elements = [container, ...Array.from(container.querySelectorAll('*'))] as HTMLElement[];
  const patchedElements: Array<{ el: HTMLElement; origStyle: string | null }> = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const computed = window.getComputedStyle(el);

    let hasColorToPatch = false;
    let patchStyles: Record<string, string> | null = null;

    for (let j = 0; j < colorProperties.length; j++) {
      const prop = colorProperties[j];
      const val = computed.getPropertyValue(prop);
      if (val && (val.includes('oklch') || val.includes('oklab') || val.includes('lab(') || val.includes('lch('))) {
        if (!patchStyles) patchStyles = {};
        patchStyles[prop] = convertColorToRgba(val);
        hasColorToPatch = true;
      }
    }

    if (hasColorToPatch && patchStyles) {
      patchedElements.push({ el, origStyle: el.getAttribute('style') });
      const entries = Object.entries(patchStyles);
      for (let k = 0; k < entries.length; k++) {
        el.style.setProperty(entries[k][0], entries[k][1], 'important');
      }
    }
  }

  return () => {
    for (let i = 0; i < patchedElements.length; i++) {
      const { el, origStyle } = patchedElements[i];
      if (origStyle !== null) {
        el.setAttribute('style', origStyle);
      } else {
        el.removeAttribute('style');
      }
    }
  };
};

export const createPdfCaptureContainer = (
  targetWidth: number,
  targetHeight: number,
  backgroundColor: string
): HTMLDivElement => {
  const tempContainer = document.createElement('div');
  tempContainer.setAttribute('data-pdf-capture-container', 'true');
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '0';
  tempContainer.style.top = '0';
  tempContainer.style.width = `${targetWidth}px`;
  tempContainer.style.minHeight = `${targetHeight}px`;
  tempContainer.style.overflow = 'visible';
  tempContainer.style.zIndex = '-9999';
  tempContainer.style.pointerEvents = 'none';
  tempContainer.style.backgroundColor = backgroundColor;
  tempContainer.style.color = '#1A2E1A';
  tempContainer.style.borderColor = 'transparent';
  tempContainer.dir = 'rtl';

  const tempStyle = document.createElement('style');
  tempStyle.textContent = `
    [data-pdf-capture-container="true"], [data-pdf-capture-container="true"] * {
      font-family: 'Cairo', sans-serif !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
      text-rendering: optimizeLegibility !important;
    }
  `;
  tempContainer.appendChild(tempStyle);
  document.body.appendChild(tempContainer);
  return tempContainer;
};

const waitForImages = async (root: HTMLElement): Promise<void> => {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return;

  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, 2500);
        const done = () => {
          window.clearTimeout(timer);
          resolve();
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });
    })
  );
};

export interface CapturePageOptions {
  tempContainer: HTMLDivElement;
  targetWidth: number;
  targetHeight: number;
  backgroundColor: string;
  scale?: number;
  jpegQuality?: number;
  rotate180?: boolean;
}

export const capturePageElementToJpeg = async (
  pageEl: HTMLDivElement,
  options: CapturePageOptions
): Promise<string> => {
  const {
    tempContainer,
    targetWidth,
    targetHeight,
    backgroundColor,
    scale = 2,
    jpegQuality = 0.92,
    rotate180 = false,
  } = options;

  const prevMarginBottom = pageEl.style.marginBottom;
  const prevWidth = pageEl.style.width;
  const prevHeight = pageEl.style.height;
  const prevOverflow = pageEl.style.overflow;

  pageEl.style.marginBottom = '0';
  pageEl.style.width = `${targetWidth}px`;
  pageEl.style.height = 'auto';
  pageEl.style.overflow = 'visible';

  tempContainer.appendChild(pageEl);

  const innerDiv = pageEl.firstElementChild as HTMLElement | null;
  let wrapper: HTMLDivElement | null = null;
  let originalParent: ParentNode | null = null;
  let savedInnerStyles: {
    transform: string;
    transformOrigin: string;
    height: string;
    width: string;
    maxHeight: string;
    flexShrink: string;
  } | null = null;

  try {
    await waitForImages(pageEl);

    if (innerDiv) {
      const contentHeight = innerDiv.scrollHeight;
      if (contentHeight > targetHeight + 1) {
        const fitScale = targetHeight / contentHeight;
        savedInnerStyles = {
          transform: innerDiv.style.transform,
          transformOrigin: innerDiv.style.transformOrigin,
          height: innerDiv.style.height,
          width: innerDiv.style.width,
          maxHeight: innerDiv.style.maxHeight,
          flexShrink: innerDiv.style.flexShrink,
        };

        wrapper = document.createElement('div');
        wrapper.style.width = `${targetWidth}px`;
        wrapper.style.height = `${targetHeight}px`;
        wrapper.style.overflow = 'hidden';
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.alignItems = 'flex-start';
        wrapper.style.backgroundColor = backgroundColor;

        innerDiv.style.transform = `scale(${fitScale})`;
        innerDiv.style.transformOrigin = 'top center';
        innerDiv.style.height = `${contentHeight}px`;
        innerDiv.style.width = `${targetWidth}px`;
        innerDiv.style.maxHeight = 'none';
        innerDiv.style.flexShrink = '0';

        originalParent = innerDiv.parentNode;
        if (originalParent) {
          originalParent.replaceChild(wrapper, innerDiv);
          wrapper.appendChild(innerDiv);
        }
      }
    }

    pageEl.style.height = `${targetHeight}px`;
    pageEl.style.overflow = 'hidden';

    const restoreColors = patchColorsForHtml2Canvas(pageEl);
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(pageEl, {
        scale,
        useCORS: true,
        backgroundColor,
        logging: false,
        width: targetWidth,
        height: targetHeight,
        windowWidth: targetWidth,
        windowHeight: targetHeight,
        scrollX: 0,
        scrollY: 0,
        ignoreElements: (el: Element) => {
          if (el.parentElement === document.body) {
            return el !== tempContainer && el.tagName !== 'STYLE' && el.tagName !== 'LINK';
          }
          return false;
        },
        onclone: (clonedDoc: Document) => {
          clonedDoc.documentElement.classList.remove('dark');
          clonedDoc.documentElement.style.margin = '0';
          clonedDoc.documentElement.style.padding = '0';
          clonedDoc.documentElement.style.background = backgroundColor;
          clonedDoc.documentElement.style.color = '#1A2E1A';
          clonedDoc.body.style.margin = '0';
          clonedDoc.body.style.padding = '0';
          clonedDoc.body.style.background = backgroundColor;
          clonedDoc.body.style.color = '#1A2E1A';
          clonedDoc.body.style.overflow = 'visible';

          const clonedContainer = clonedDoc.querySelector('[data-pdf-capture-container="true"]') as HTMLElement | null;
          if (clonedContainer) {
            clonedContainer.style.position = 'absolute';
            clonedContainer.style.left = '0';
            clonedContainer.style.top = '0';
            clonedContainer.style.zIndex = '9999';
            clonedContainer.style.visibility = 'visible';
            clonedContainer.style.opacity = '1';
          }
        },
      });
    } finally {
      restoreColors();
    }

    let imgData: string;
    if (rotate180) {
      const rotCanvas = document.createElement('canvas');
      rotCanvas.width = canvas.width;
      rotCanvas.height = canvas.height;
      const ctx = rotCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, rotCanvas.width, rotCanvas.height);
        ctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        imgData = rotCanvas.toDataURL('image/jpeg', jpegQuality);
      } else {
        imgData = canvas.toDataURL('image/jpeg', jpegQuality);
      }
      rotCanvas.width = 0;
      rotCanvas.height = 0;
    } else {
      imgData = canvas.toDataURL('image/jpeg', jpegQuality);
    }

    canvas.width = 0;
    canvas.height = 0;

    return imgData;
  } finally {
    if (wrapper && innerDiv && originalParent && savedInnerStyles) {
      if (wrapper.contains(innerDiv)) {
        wrapper.removeChild(innerDiv);
      }
      if (originalParent.contains(wrapper)) {
        originalParent.replaceChild(innerDiv, wrapper);
      }
      innerDiv.style.transform = savedInnerStyles.transform;
      innerDiv.style.transformOrigin = savedInnerStyles.transformOrigin;
      innerDiv.style.height = savedInnerStyles.height;
      innerDiv.style.width = savedInnerStyles.width;
      innerDiv.style.maxHeight = savedInnerStyles.maxHeight;
      innerDiv.style.flexShrink = savedInnerStyles.flexShrink;
    }

    pageEl.style.marginBottom = prevMarginBottom;
    pageEl.style.width = prevWidth;
    pageEl.style.height = prevHeight;
    pageEl.style.overflow = prevOverflow;

    if (tempContainer.contains(pageEl)) {
      tempContainer.removeChild(pageEl);
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
};

