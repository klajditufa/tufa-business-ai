import type { TDocumentDefinitions } from "pdfmake/interfaces";

type PdfMake = typeof import("pdfmake/build/pdfmake");
type Fonts = Record<string, string>;

let loading: Promise<{ pdfMake: PdfMake; fonts: Fonts }> | undefined;

// pdfmake and its fonts weigh about 2 MB, so they load the first time a PDF is made.
function load() {
  loading ??= Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")])
    .then(([pdfMake, fonts]) => ({
      pdfMake: (pdfMake as unknown as { default?: PdfMake }).default ?? pdfMake,
      fonts: (fonts as unknown as { default?: Fonts }).default ?? (fonts as unknown as Fonts),
    }))
    .catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

export async function makePdf(definition: TDocumentDefinitions): Promise<Blob> {
  const { pdfMake, fonts } = await load();
  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(definition, undefined, undefined, fonts).getBlob(resolve);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
