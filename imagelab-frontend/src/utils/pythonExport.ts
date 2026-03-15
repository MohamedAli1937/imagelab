import type { PipelineStep } from "../types/pipeline";

/**
 * Convert a hex colour string (#RRGGBB) to an OpenCV BGR tuple string.
 * Example: "#ff6600" → "(0, 102, 255)"
 */
function hexToBgr(hex?: string): string {
  if (typeof hex !== "string") return "(0, 0, 0)";
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return "(0, 0, 0)";
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return `(${b}, ${g}, ${r})`;
}

/**
 * Ensure a value is a valid number, falling back to a default if not.
 */
function safeNum(value: unknown, fallback: number): number {
  return typeof value === "number" && !isNaN(value) ? value : fallback;
}

/**
 * Escape a string for use as a Python string literal.
 * Uses JSON.stringify to handle all necessary escapes and wrap in double quotes.
 */
function escapePythonString(str: string): string {
  return JSON.stringify(str);
}

/** Resolve OpenCV interpolation flag name from the block dropdown value. */
function interpolationFlag(value: string): string {
  const map: Record<string, string> = {
    LINEAR: "cv2.INTER_LINEAR",
    AREA: "cv2.INTER_AREA",
    CUBIC: "cv2.INTER_CUBIC",
    NEAREST: "cv2.INTER_NEAREST",
    LANCZOS4: "cv2.INTER_LANCZOS4",
  };
  return map[value] ?? "cv2.INTER_LINEAR";
}

interface CodeFragment {
  comment: string;
  code: string;
  requirements?: string[];
}

/**
 * Map a single pipeline step to its Python/OpenCV equivalent.
 */
function blockToPython(step: PipelineStep): CodeFragment {
  const p = step.params as Record<string, unknown>;

  switch (step.type) {
    case "basic_readimage":
      return {
        comment: "Read input image",
        code: 'img = cv2.imread("input.jpg")',
      };

    case "basic_writeimage":
      return {
        comment: "Write output image",
        code: 'cv2.imwrite("output.jpg", img)',
      };

    case "geometric_reflectimage": {
      const flipMap: Record<string, string> = { X: "0", Y: "1", Both: "-1" };
      const code = flipMap[p.type as string] ?? "1";
      return {
        comment: `Reflect image in ${p.type} direction`,
        code: `img = cv2.flip(img, ${code})`,
      };
    }

    case "geometric_rotateimage": {
      const angle = safeNum(p.angle, 90);
      const scale = safeNum(p.scale, 1.0);
      return {
        comment: `Rotate image by ${angle}° and scale by ${scale}`,
        code: [
          `h, w = img.shape[:2]`,
          `M = cv2.getRotationMatrix2D((w / 2, h / 2), ${angle}, ${scale})`,
          `img = cv2.warpAffine(img, M, (w, h))`,
        ].join("\n"),
      };
    }

    case "geometric_scaleimage": {
      const fx = safeNum(p.fx, 1.0);
      const fy = safeNum(p.fy, 1.0);
      const interp = interpolationFlag(p.interpolation as string);
      return {
        comment: `Scale image by ${fx}x (X) and ${fy}x (Y)`,
        code: `img = cv2.resize(img, None, fx=${fx}, fy=${fy}, interpolation=${interp})`,
      };
    }

    case "geometric_resizeimage": {
      const w = safeNum(p.width, 640);
      const h = safeNum(p.height, 480);
      const interp = interpolationFlag(p.interpolation as string);
      return {
        comment: `Resize image to ${w}x${h} pixels`,
        code: `img = cv2.resize(img, (${w}, ${h}), interpolation=${interp})`,
      };
    }

    case "geometric_cropimage": {
      const x1 = safeNum(p.x1, 0);
      const y1 = safeNum(p.y1, 0);
      const x2 = safeNum(p.x2, 100);
      const y2 = safeNum(p.y2, 100);
      return {
        comment: `Crop image to region (${x1}, ${y1}) → (${x2}, ${y2})`,
        code: `img = img[${y1}:${y2}, ${x1}:${x2}]`,
      };
    }

    case "geometric_affineimage":
      return {
        comment: "Apply affine transformation (fixed translation)",
        code: [
          `# Note: This block uses a fixed translation (50, 100).`,
          `# For custom transformations, modify the matrix M below.`,
          `rows, cols = img.shape[:2]`,
          `M = np.float32([[1, 0, 50], [0, 1, 100]])`,
          `img = cv2.warpAffine(img, M, (cols, rows))`,
        ].join("\n"),
      };

    case "imageconvertions_grayimage":
      return {
        comment: "Convert to grayscale",
        code: "img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)",
      };

    case "imageconvertions_clahe": {
      const cl = safeNum(p.clipLimit, 2.0);
      const tx = safeNum(p.tileGridSizeX, 8);
      const ty = safeNum(p.tileGridSizeY, 8);
      return {
        comment: `Apply CLAHE (clipLimit=${cl}, tileGridSize=(${tx}, ${ty}))`,
        code: [
          `clahe = cv2.createCLAHE(clipLimit=${cl}, tileGridSize=(${tx}, ${ty}))`,
          `img = clahe.apply(img)`,
        ].join("\n"),
      };
    }

    case "imageconvertions_channelsplit": {
      const channelMap: Record<string, number> = { BLUE: 0, GREEN: 1, RED: 2 };
      const idx = channelMap[p.channel as string] ?? 2;
      const name = (p.channel as string) ?? "RED";
      return {
        comment: `Extract ${name} channel`,
        code: `img = cv2.split(img)[${idx}]`,
      };
    }

    case "imageconvertions_graytobinary": {
      const tv = safeNum(p.thresholdValue, 127);
      const mv = safeNum(p.maxValue, 255);
      return {
        comment: `Convert grayscale to binary (threshold=${tv}, maxValue=${mv})`,
        code: `_, img = cv2.threshold(img, ${tv}, ${mv}, cv2.THRESH_BINARY)`,
      };
    }

    case "imageconvertions_colortobinary": {
      const tv = safeNum(p.thresholdValue, 127);
      const mv = safeNum(p.maxValue, 255);
      const thType =
        (p.thresholdType as string) === "threshold_binary_inv"
          ? "cv2.THRESH_BINARY_INV"
          : "cv2.THRESH_BINARY";
      return {
        comment: `Convert colour image to binary (${p.thresholdType}, threshold=${tv}, maxValue=${mv})`,
        code: [
          `# Ensure image is grayscale before thresholding`,
          `gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img`,
          `_, img = cv2.threshold(gray, ${tv}, ${mv}, ${thType})`,
        ].join("\n"),
      };
    }

    case "imageconvertions_colormaps": {
      const cmMap: Record<string, string> = {
        HOT: "cv2.COLORMAP_HOT",
        AUTUMN: "cv2.COLORMAP_AUTUMN",
        BONE: "cv2.COLORMAP_BONE",
        COOL: "cv2.COLORMAP_COOL",
        HSV: "cv2.COLORMAP_HSV",
        JET: "cv2.COLORMAP_JET",
        OCEAN: "cv2.COLORMAP_OCEAN",
        PARULA: "cv2.COLORMAP_PARULA",
        PINK: "cv2.COLORMAP_PINK",
        RAINBOW: "cv2.COLORMAP_RAINBOW",
      };
      const cm = cmMap[p.type as string] ?? "cv2.COLORMAP_HOT";
      return {
        comment: `Apply ${p.type} colour map`,
        code: `img = cv2.applyColorMap(img, ${cm})`,
      };
    }

    case "imageconvertions_invertimage":
      return {
        comment: "Invert image",
        code: "img = cv2.bitwise_not(img)",
      };

    case "imageconvertions_bgrtohsv":
      return { comment: "Convert BGR to HSV", code: "img = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)" };

    case "imageconvertions_hsvtobgr":
      return { comment: "Convert HSV to BGR", code: "img = cv2.cvtColor(img, cv2.COLOR_HSV2BGR)" };

    case "imageconvertions_bgrtolab":
      return { comment: "Convert BGR to LAB", code: "img = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)" };

    case "imageconvertions_labtobgr":
      return { comment: "Convert LAB to BGR", code: "img = cv2.cvtColor(img, cv2.COLOR_LAB2BGR)" };

    case "imageconvertions_bgrtoycrcb":
      return {
        comment: "Convert BGR to YCrCb",
        code: "img = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)",
      };

    case "imageconvertions_ycrcbtobgr":
      return {
        comment: "Convert YCrCb to BGR",
        code: "img = cv2.cvtColor(img, cv2.COLOR_YCrCb2BGR)",
      };

    case "drawingoperations_drawline": {
      const color = hexToBgr(p.rgbcolors_input);
      const x1 = safeNum(p.starting_point_x1, 0);
      const y1 = safeNum(p.starting_point_y1, 0);
      const x2 = safeNum(p.ending_point_x, 100);
      const y2 = safeNum(p.ending_point_y, 100);
      const thickness = safeNum(p.thickness, 2);
      return {
        comment: `Draw a line from (${x1}, ${y1}) to (${x2}, ${y2})`,
        code: `cv2.line(img, (${x1}, ${y1}), (${x2}, ${y2}), ${color}, ${thickness})`,
      };
    }

    case "drawingoperations_drawcircle": {
      const color = hexToBgr(p.rgbcolors_input);
      const cx = safeNum(p.center_point_x, 100);
      const cy = safeNum(p.center_point_y, 100);
      const r = safeNum(p.radius, 50);
      const thickness = safeNum(p.thickness, 2);
      return {
        comment: `Draw a circle at (${cx}, ${cy}) with radius ${r}`,
        code: `cv2.circle(img, (${cx}, ${cy}), ${r}, ${color}, ${thickness})`,
      };
    }

    case "drawingoperations_drawellipse": {
      const color = hexToBgr(p.rgbcolors_input);
      const cx = safeNum(p.center_point_x, 100);
      const cy = safeNum(p.center_point_y, 100);
      const w = safeNum(p.width, 100);
      const h = safeNum(p.height, 50);
      const angle = safeNum(p.angle, 0);
      const thickness = safeNum(p.thickness, 2);
      return {
        comment: `Draw an ellipse at (${cx}, ${cy})`,
        code: `cv2.ellipse(img, (${cx}, ${cy}), (${w}, ${h}), ${angle}, 0, 360, ${color}, ${thickness})`,
      };
    }

    case "drawingoperations_drawrectangle": {
      const color = hexToBgr(p.rgbcolors_input);
      const x1 = safeNum(p.starting_point_x, 10);
      const y1 = safeNum(p.starting_point_y, 10);
      const x2 = safeNum(p.ending_point_x, 100);
      const y2 = safeNum(p.ending_point_y, 100);
      const thickness = safeNum(p.thickness, 2);
      return {
        comment: `Draw a rectangle from (${x1}, ${y1}) to (${x2}, ${y2})`,
        code: `cv2.rectangle(img, (${x1}, ${y1}), (${x2}, ${y2}), ${color}, ${thickness})`,
      };
    }

    case "drawingoperations_drawarrowline": {
      const color = hexToBgr(p.rgbcolors_input);
      const x1 = safeNum(p.starting_point_x, 10);
      const y1 = safeNum(p.starting_point_y, 10);
      const x2 = safeNum(p.ending_point_x, 100);
      const y2 = safeNum(p.ending_point_y, 100);
      const thickness = safeNum(p.thickness, 2);
      return {
        comment: `Draw an arrow from (${x1}, ${y1}) to (${x2}, ${y2})`,
        code: `cv2.arrowedLine(img, (${x1}, ${y1}), (${x2}, ${y2}), ${color}, ${thickness})`,
      };
    }

    case "drawingoperations_drawtext": {
      const color = hexToBgr(p.rgbcolors_input);
      const rawText = (p.draw_text as string) ?? "Image Lab";
      const safeText = escapePythonString(rawText);
      const x = safeNum(p.starting_point_x, 10);
      const y = safeNum(p.starting_point_y, 50);
      const scale = safeNum(p.scale, 1.0);
      const thickness = safeNum(p.thickness, 2);
      return {
        comment: `Draw text ${safeText} at (${x}, ${y})`,
        code: `cv2.putText(img, ${safeText}, (${x}, ${y}), cv2.FONT_HERSHEY_SIMPLEX, ${scale}, ${color}, ${thickness})`,
      };
    }

    case "blurring_applyblur": {
      const w = safeNum(p.widthSize, 5);
      const h = safeNum(p.heightSize, 5);
      return {
        comment: `Apply blur (${w}x${h})`,
        code: `img = cv2.blur(img, (${w}, ${h}))`,
      };
    }

    case "blurring_applygaussianblur": {
      const w = safeNum(p.widthSize, 5);
      const h = safeNum(p.heightSize, 5);
      return {
        comment: `Apply Gaussian blur (${w}x${h})`,
        code: `img = cv2.GaussianBlur(img, (${w}, ${h}), 0)`,
      };
    }

    case "blurring_applymedianblur": {
      const ks = safeNum(p.kernelSize, 5);
      return {
        comment: `Apply median blur (kernel=${ks})`,
        code: `img = cv2.medianBlur(img, ${ks})`,
      };
    }

    case "filtering_bilateral": {
      const d = safeNum(p.filterSize, 9);
      const sc = safeNum(p.sigmaColor, 75);
      const ss = safeNum(p.sigmaSpace, 75);
      return {
        comment: `Apply bilateral filter (d=${d}, sigmaColor=${sc}, sigmaSpace=${ss})`,
        code: `img = cv2.bilateralFilter(img, ${d}, ${sc}, ${ss})`,
      };
    }

    case "filtering_boxfilter": {
      const w = safeNum(p.width, 5);
      const h = safeNum(p.height, 5);
      const d = safeNum(p.depth, -1);
      return {
        comment: `Apply box filter (${w}x${h}, depth=${d})`,
        code: `img = cv2.boxFilter(img, ${d}, (${w}, ${h}))`,
      };
    }

    case "filtering_pyramidup":
      return { comment: "Pyramid up (upsample 2x)", code: "img = cv2.pyrUp(img)" };

    case "filtering_pyramiddown":
      return { comment: "Pyramid down (downsample 2x)", code: "img = cv2.pyrDown(img)" };

    case "filtering_erosion": {
      const iter = safeNum(p.iteration, 1);
      return {
        comment: `Apply erosion (${iter} iterations)`,
        code: [
          `kernel = np.ones((3, 3), np.uint8)`,
          `img = cv2.erode(img, kernel, iterations=${iter})`,
        ].join("\n"),
      };
    }

    case "filtering_dilation": {
      const iter = safeNum(p.iteration, 1);
      return {
        comment: `Apply dilation (${iter} iterations)`,
        code: [
          `kernel = np.ones((3, 3), np.uint8)`,
          `img = cv2.dilate(img, kernel, iterations=${iter})`,
        ].join("\n"),
      };
    }

    case "filtering_morphological": {
      const morphMap: Record<string, string> = {
        TOPHAT: "cv2.MORPH_TOPHAT",
        CLOSE: "cv2.MORPH_CLOSE",
        GRADIENT: "cv2.MORPH_GRADIENT",
        BLACKHAT: "cv2.MORPH_BLACKHAT",
        OPEN: "cv2.MORPH_OPEN",
      };
      const op = morphMap[p.type as string] ?? "cv2.MORPH_TOPHAT";
      const ks = safeNum(p.kernelSize, 5);
      return {
        comment: `Apply morphological ${p.type} (kernel=${ks})`,
        code: [
          `kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (${ks}, ${ks}))`,
          `img = cv2.morphologyEx(img, ${op}, kernel)`,
        ].join("\n"),
      };
    }

    case "filtering_sharpen": {
      const s = safeNum(p.strength, 1.0);
      return {
        comment: `Apply sharpening (strength=${s})`,
        code: [
          `blur = cv2.GaussianBlur(img, (0, 0), 3)`,
          `img = cv2.addWeighted(img, 1 + ${s}, blur, -${s}, 0)`,
        ].join("\n"),
      };
    }

    case "filtering_gaborfilter": {
      const ks = safeNum(p.kernelSize, 21);
      const sigma = safeNum(p.sigma, 5.0);
      const theta = safeNum(p.theta, 0);
      const lambda_ = safeNum(p.lambda_, 10.0);
      const gamma = safeNum(p.gamma, 0.5);
      return {
        comment: `Apply Gabor filter (kernel=${ks}, sigma=${sigma}, theta=${theta}°, lambda=${lambda_}, gamma=${gamma})`,
        requirements: ["math"],
        code: [
          `gabor_kernel = cv2.getGaborKernel((${ks}, ${ks}), ${sigma}, math.radians(${theta}), ${lambda_}, ${gamma})`,
          `img = cv2.filter2D(img, -1, gabor_kernel)`,
        ].join("\n"),
      };
    }

    case "filtering_contourdetection": {
      const modeMap: Record<string, string> = {
        EXTERNAL: "cv2.RETR_EXTERNAL",
        TREE: "cv2.RETR_TREE",
      };
      const methodMap: Record<string, string> = {
        SIMPLE: "cv2.CHAIN_APPROX_SIMPLE",
        NONE: "cv2.CHAIN_APPROX_NONE",
      };
      const mode = modeMap[p.mode as string] ?? "cv2.RETR_EXTERNAL";
      const method = methodMap[p.method as string] ?? "cv2.CHAIN_APPROX_SIMPLE";
      const color = hexToBgr(p.rgbcolors_input);
      const thickness = safeNum(p.thickness, 2);
      return {
        comment: "Detect and draw contours",
        code: [
          `# Ensure image is grayscale for contour detection`,
          `gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img`,
          `contours, _ = cv2.findContours(gray, ${mode}, ${method})`,
          `cv2.drawContours(img, contours, -1, ${color}, ${thickness})`,
        ].join("\n"),
      };
    }

    case "filtering_cannyedge": {
      const t1 = safeNum(p.threshold1, 100);
      const t2 = safeNum(p.threshold2, 200);
      return {
        comment: `Apply Canny edge detection (t1=${t1}, t2=${t2})`,
        code: `img = cv2.Canny(img, ${t1}, ${t2})`,
      };
    }

    case "thresholding_applythreshold": {
      const mv = safeNum(p.maxValue, 255);
      const tv = safeNum(p.thresholdValue, 127);
      return {
        comment: `Apply simple threshold (thresh=${tv}, maxValue=${mv})`,
        code: `_, img = cv2.threshold(img, ${tv}, ${mv}, cv2.THRESH_BINARY)`,
      };
    }

    case "thresholding_adaptivethreshold": {
      const methodName =
        (p.adaptiveMethod as string) === "MEAN"
          ? "cv2.ADAPTIVE_THRESH_MEAN_C"
          : "cv2.ADAPTIVE_THRESH_GAUSSIAN_C";
      const bs = safeNum(p.blockSize, 11);
      const c = safeNum(p.cValue, 2);
      const mv = safeNum(p.maxValue, 255);
      return {
        comment: `Apply adaptive threshold (${p.adaptiveMethod}, blockSize=${bs}, C=${c})`,
        code: `img = cv2.adaptiveThreshold(img, ${mv}, ${methodName}, cv2.THRESH_BINARY, ${bs}, ${c})`,
      };
    }

    case "thresholding_otsuthreshold": {
      const mv = safeNum(p.maxValue, 255);
      return {
        comment: "Apply Otsu threshold (auto-calculated)",
        code: `_, img = cv2.threshold(img, 0, ${mv}, cv2.THRESH_BINARY + cv2.THRESH_OTSU)`,
      };
    }

    case "thresholding_applyborders": {
      if (p.border_all_sides !== undefined) {
        const b = safeNum(p.border_all_sides, 5);
        return {
          comment: `Apply border (${b}px all sides)`,
          code: `img = cv2.copyMakeBorder(img, ${b}, ${b}, ${b}, ${b}, cv2.BORDER_CONSTANT, value=(0, 0, 0))`,
        };
      }
      const top = safeNum(p.borderTop, 10);
      const bottom = safeNum(p.borderBottom, 10);
      const left = safeNum(p.borderLeft, 10);
      const right = safeNum(p.borderRight, 10);
      return {
        comment: `Apply border (top=${top}, bottom=${bottom}, left=${left}, right=${right})`,
        code: `img = cv2.copyMakeBorder(img, ${top}, ${bottom}, ${left}, ${right}, cv2.BORDER_CONSTANT, value=(0, 0, 0))`,
      };
    }

    case "border_for_all":
    case "border_each_side":
      return { comment: "", code: "" };

    case "segmentation_watershed": {
      const ft = safeNum(p.foreground_threshold, 0.5);
      return {
        comment: `Watershed segmentation (foreground threshold=${ft})`,
        code: [
          `# Ensure image is grayscale for watershed`,
          `gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img`,
          `_, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)`,
          `kernel = np.ones((3, 3), np.uint8)`,
          `opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)`,
          `sure_bg = cv2.dilate(opening, kernel, iterations=3)`,
          `dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)`,
          `_, sure_fg = cv2.threshold(dist_transform, ${ft} * dist_transform.max(), 255, 0)`,
          `sure_fg = np.uint8(sure_fg)`,
          `unknown = cv2.subtract(sure_bg, sure_fg)`,
          `_, markers = cv2.connectedComponents(sure_fg)`,
          `markers = markers + 1`,
          `markers[unknown == 255] = 0`,
          `markers = cv2.watershed(img, markers)`,
          `img[markers == -1] = [0, 0, 255]`,
        ].join("\n"),
      };
    }

    case "segmentation_kmeans": {
      const k = safeNum(p.k, 3);
      const maxIter = safeNum(p.max_iter, 100);
      const eps = safeNum(p.epsilon, 0.2);
      return {
        comment: `K-Means segmentation (K=${k}, maxIter=${maxIter}, epsilon=${eps})`,
        code: [
          `Z = img.reshape((-1, 3)).astype(np.float32)`,
          `criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, ${maxIter}, ${eps})`,
          `_, labels, centers = cv2.kmeans(Z, ${k}, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)`,
          `centers = np.uint8(centers)`,
          `img = centers[labels.flatten()].reshape(img.shape)`,
        ].join("\n"),
      };
    }

    case "segmentation_meanshift": {
      const sp = safeNum(p.sp, 21);
      const sr = safeNum(p.sr, 51);
      const ml = safeNum(p.maxLevel, 1);
      return {
        comment: `Mean shift segmentation (sp=${sp}, sr=${sr}, maxLevel=${ml})`,
        code: `img = cv2.pyrMeanShiftFiltering(img, ${sp}, ${sr}, maxLevel=${ml})`,
      };
    }

    case "sobelderivatives_soblederivate": {
      const depth = safeNum(p.ddepth, 0);
      const direction = p.type as string;
      const dx = direction === "VERTICAL" ? 1 : 0;
      const dy = direction === "VERTICAL" ? 0 : 1;
      return {
        comment: `Apply ${direction} Sobel derivative (depth=${depth})`,
        code: `img = cv2.Sobel(img, ${depth === 0 ? "cv2.CV_64F" : depth}, ${dx}, ${dy}, ksize=3)`,
      };
    }

    case "sobelderivatives_scharrderivate": {
      const depth = safeNum(p.ddepth, 0);
      const direction = p.type as string;
      const dx = direction === "VERTICAL" ? 1 : 0;
      const dy = direction === "VERTICAL" ? 0 : 1;
      return {
        comment: `Apply ${direction} Scharr derivative (depth=${depth})`,
        code: `img = cv2.Scharr(img, ${depth === 0 ? "cv2.CV_64F" : depth}, ${dx}, ${dy})`,
      };
    }

    case "transformation_distance": {
      const distMap: Record<string, string> = {
        DIST_L1: "cv2.DIST_L1",
        DIST_L2: "cv2.DIST_L2",
        DIST_C: "cv2.DIST_C",
      };
      const dt = distMap[p.type as string] ?? "cv2.DIST_L2";
      return {
        comment: `Apply ${p.type} distance transform`,
        code: `img = cv2.distanceTransform(img, ${dt}, 5)`,
      };
    }

    case "transformation_laplacian": {
      const ksize = safeNum(p.ksize, 1);
      const ddepth = safeNum(p.ddepth, -1);
      const ddepthStr = ddepth === -1 ? "cv2.CV_64F" : String(ddepth);
      return {
        comment: `Apply Laplacian (ksize=${ksize}, depth=${ddepth})`,
        code: `img = cv2.Laplacian(img, ${ddepthStr}, ksize=${ksize})`,
      };
    }

    default:
      return {
        comment: `Unknown block: ${step.type}`,
        code: `# TODO: implement ${step.type}`,
      };
  }
}

/**
 * Generate a complete, ready-to-run Python script from the pipeline steps.
 */
export function generatePythonCode(steps: PipelineStep[]): string {
  const stepFragments: Array<{ num: number; type: string; fragment: CodeFragment }> = [];
  const allRequirements = new Set<string>(["opencv-python", "numpy"]);

  let stepNum = 1;
  for (const step of steps) {
    const fragment = blockToPython(step);
    if (!fragment.code) continue;

    if (fragment.requirements) {
      fragment.requirements.forEach((req) => allRequirements.add(req));
    }

    stepFragments.push({ num: stepNum, type: step.type, fragment });
    stepNum++;
  }

  const reqString = Array.from(allRequirements).sort().join(" ");

  const importMap: Record<string, string> = {
    "opencv-python": "import cv2",
    numpy: "import numpy as np",
    scipy: "import scipy",
    matplotlib: "import matplotlib.pyplot as plt",
    "scikit-image": "import skimage",
    math: "import math",
  };

  const lines: string[] = [
    `"""`,
    `ImageLab Pipeline — Auto-generated Python code`,
    `This script replicates the visual pipeline built in ImageLab.`,
    `Requirements: pip install ${reqString}`,
    `"""`,
    ``,
  ];

  Array.from(allRequirements)
    .sort()
    .forEach((req) => {
      const statement = importMap[req] || `import ${req.replace(/-/g, "_")}`;
      lines.push(statement);
    });

  lines.push(``);

  for (const { num, fragment } of stepFragments) {
    lines.push(`# Step ${num}: ${fragment.comment}`);
    lines.push(fragment.code);
    lines.push(``);
  }

  const lastProcessedStep = stepFragments[stepFragments.length - 1];
  if (lastProcessedStep && lastProcessedStep.type !== "basic_writeimage") {
    lines.push(`# Save the result`);
    lines.push(`cv2.imwrite("output.jpg", img)`);
    lines.push(``);
  }

  lines.push(`print("Pipeline complete — saved to output.jpg")`);

  return lines.join("\n");
}

/**
 * Trigger a browser download of the generated Python file.
 */
export function downloadPythonFile(code: string, filename = "imagelab_pipeline.py"): void {
  const blob = new Blob([code], { type: "text/x-python;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
