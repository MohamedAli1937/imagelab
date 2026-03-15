import { describe, expect, it } from "vitest";
import { generatePythonCode } from "./pythonExport";
import type { PipelineStep } from "../types/pipeline";

describe("pythonExport", () => {
  it("generates a complete script with basic imports", () => {
    const steps: PipelineStep[] = [
      { type: "basic_readimage", params: {} },
      { type: "basic_writeimage", params: {} },
    ];
    const code = generatePythonCode(steps);

    expect(code).toContain("import cv2");
    expect(code).toContain("import numpy as np");
    expect(code).toContain('img = cv2.imread("input.jpg")');
    expect(code).toContain('cv2.imwrite("output.jpg", img)');
    expect(code).toContain('print("Pipeline complete — saved to output.jpg")');
  });

  it("handles parameter interpolation for rotate block", () => {
    const steps: PipelineStep[] = [
      { type: "geometric_rotateimage", params: { angle: 45, scale: 0.5 } },
    ];
    const code = generatePythonCode(steps);

    expect(code).toContain("M = cv2.getRotationMatrix2D((w / 2, h / 2), 45, 0.5)");
    expect(code).toContain("img = cv2.warpAffine(img, M, (w, h))");
    expect(code).not.toContain("undefined");
    expect(code).not.toContain("NaN");
  });

  it("correctly maps Sobel derivative directions (VERTICAL logic)", () => {
    const vertical: PipelineStep[] = [
      { type: "sobelderivatives_soblederivate", params: { type: "VERTICAL", ddepth: 0 } },
    ];
    const horizontal: PipelineStep[] = [
      { type: "sobelderivatives_soblederivate", params: { type: "HORIZONTAL", ddepth: 0 } },
    ];

    const vCode = generatePythonCode(vertical);
    const hCode = generatePythonCode(horizontal);

    expect(vCode).toContain("cv2.Sobel(img, cv2.CV_64F, 1, 0, ksize=3)");
    expect(hCode).toContain("cv2.Sobel(img, cv2.CV_64F, 0, 1, ksize=3)");
  });

  it("adds requirements and manages imports for Gabor filter", () => {
    const steps: PipelineStep[] = [{ type: "filtering_gaborfilter", params: {} }];
    const code = generatePythonCode(steps);

    expect(code).toContain("import math");
    expect(code).toContain("math.radians");
    expect(code).toContain("Requirements: pip install cv2 math numpy");
  });

  it("emits conditional grayscale conversion for contour detection", () => {
    const steps: PipelineStep[] = [{ type: "filtering_contourdetection", params: {} }];
    const code = generatePythonCode(steps);

    expect(code).toContain(
      "gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img",
    );
    expect(code).toContain("cv2.findContours(gray,");
  });

  it("appends cv2.imwrite guard if the pipeline doesn't end with writeimage", () => {
    const steps: PipelineStep[] = [{ type: "imageconvertions_grayimage", params: {} }];
    const code = generatePythonCode(steps);

    const lines = code.split("\n");
    const imWriteCount = lines.filter((l) => l.includes("cv2.imwrite")).length;
    expect(imWriteCount).toBe(1);
    expect(lines[lines.length - 3]).toContain('cv2.imwrite("output.jpg", img)');
  });

  it("handles empty/undefined params with safe defaults", () => {
    const steps: PipelineStep[] = [
      { type: "geometric_resizeimage", params: {} }, // no width/height
    ];
    const code = generatePythonCode(steps);

    expect(code).toContain("cv2.resize(img, (640, 480)");
    expect(code).not.toContain("undefined");
  });
});
