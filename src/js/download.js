// Side-effect-at-the-edge module: hands a JSON string to the browser as a
// file download (plan §4 "download" module: Blob -> file-save). No
// validation or serialization logic lives here — main.js supplies an
// already-validated, already-built filename and JSON string, sourced from
// validate.js/derive.js/serialize.js.

/**
 * Builds the download filename per the confirmed convention:
 * DDV_KIR_KPR_<TaxPayerID>_<OBDOBJE_OD>_<OBDOBJE_DO>.json
 */
export function buildDownloadFilename(taxPayerID, obdobjeOd, obdobjeDo) {
  return `DDV_KIR_KPR_${taxPayerID}_${obdobjeOd}_${obdobjeDo}.json`;
}

/**
 * Hands `jsonString` to the browser as a downloadable file named `filename`,
 * via a Blob + object URL + a programmatic <a download> click, then revokes
 * the URL. The only DOM-touching function in this module.
 */
export function downloadJson(filename, jsonString) {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
