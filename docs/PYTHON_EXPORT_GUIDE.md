# ImageLab Python Export Guide

Quickly add "Export to Python" support for new blocks in `src/utils/pythonExport.ts`.

---

## Steps to Add a Block

1. **Find the Block ID:** Look in `src/blocks/definitions/*.blocks.ts` (e.g., `type: "blur_gaussian"`).
2. **Add Case:** Find `blockToPython()` in `pythonExport.ts` and add your block:
   ```typescript
   case "blur_gaussian": {
     const k = p.kernelSize ?? 5; // Get params from 'p'
     return {
       comment: `Gaussian Blur (k=${k})`,
       code: `img = cv2.GaussianBlur(img, (${k}, ${k}), 0)`
     };
   }
   ```
3. **Handle Colors (Optional):** Use `hexToBgr(p.color)` to convert hex `#RRGGBB` to OpenCV `(B, G, R)`.

---

## Adding New Libraries (pip)

If your block needs a new library (e.g. `scikit-image`):

1. **In `blockToPython`:** Add the `requirements` array.
   ```typescript
   return {
     comment: "My advanced filter",
     requirements: ["scikit-image"],
     code: `img = skimage.filters.my_op(img)`
   };
   ```
2. **In `generatePythonCode`:** (Bottom of file) If the **pip name** is different from the **import name**, update `importMap`:
   ```typescript
   const importMap = {
     "scikit-image": "import skimage", // Map pip -> import
   };
   ```

---

## Quick Tips
- **Image Variable:** Always use and return `img` (e.g., `img = cv2.op(img)`).
- **Multiple Lines:** Use `code: [line1, line2].join("\n")`.
- **Default Case:** If not mapped, it shows a `# TODO` comment in the exported file.
