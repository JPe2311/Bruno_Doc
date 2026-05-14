export function printReportHTML(html: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Por favor permita ventanas emergentes para imprimir'); return; }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Reporte</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          color: #1e293b;
          line-height: 1.5;
          background: white;
        }
        .report-container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .banner-img { width: 100%; height: auto; max-height: 120px; object-fit: cover; display: block; }
        .report-header { text-align: right; font-size: 14px; color: #64748b; padding: 16px 0 8px; }
        .report-section { border-top: 1px solid #e2e8f0; padding: 12px 0; }
        .report-section h3 { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 6px; }
        .report-section p { font-size: 13px; color: #334155; white-space: pre-wrap; }
        .patient-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 13px; }
        .patient-grid p { white-space: pre-wrap; }
        .patient-grid .label { font-weight: 500; color: #475569; }
        .stamp-container { display: flex; justify-content: flex-end; padding-top: 12px; border-top: 1px solid #e2e8f0; margin-top: 12px; }
        .stamp-container img { height: 80px; object-fit: contain; }
        .stamp-container .no-stamp { text-align: right; }
        .stamp-container .no-stamp .name { font-weight: 600; color: #0f172a; }
        .stamp-container .no-stamp .role { font-size: 13px; color: #64748b; }
        .tipologia-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 500;
          background: #eff6ff;
          color: #1d4ed8;
          margin-bottom: 8px;
        }
        @page { margin: 15mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body><div class="report-container">${html}</div></body>
    </html>
  `);
  printWindow.document.close();

  const imgTags = printWindow.document.querySelectorAll('img');
  let loadedCount = 0;

  if (imgTags.length === 0) {
    printWindow.focus();
    printWindow.print();
  } else {
    imgTags.forEach((img) => {
      if (img.complete) {
        loadedCount++;
        if (loadedCount === imgTags.length) {
          printWindow.focus();
          printWindow.print();
        }
      } else {
        img.onload = () => {
          loadedCount++;
          if (loadedCount === imgTags.length) {
            printWindow.focus();
            printWindow.print();
          }
        };
        img.onerror = () => {
          loadedCount++;
          if (loadedCount === imgTags.length) {
            printWindow.focus();
            printWindow.print();
          }
        };
      }
    });
    if (loadedCount === imgTags.length) {
      printWindow.focus();
      printWindow.print();
    }
  }
}
